
import React, { useState, useCallback } from 'react';
import { Contact, Product, GmailAlias, Interaction, InteractionType, EmailTemplate } from '../types';
import { getFollowUpSuggestion } from '../services/geminiService';
import { sendEmail, saveEmailAsDraft, SendEmailOptions, generateTrackingToken, buildTrackingPixelUrl } from '../services/gmailService';

type OutreachMode = 'ai' | 'template' | 'write';

interface DraftState {
  contactId: string;
  subject: string;
  body: string;
  productId?: string;
  skipped: boolean;
  generating: boolean;
  error?: string;
}

type Step = 'mode' | 'generate' | 'review' | 'send';

interface BatchOutreachModalProps {
  contacts: Contact[];
  products: Product[];
  templates?: EmailTemplate[];
  aliases: GmailAlias[];
  defaultAlias: string;
  defaultModel: string;
  productContext?: string;
  emailTrackingEnabled?: boolean;
  supabaseProjectRef?: string;
  supabaseUserId?: string;
  onSend: (results: { contact: Contact; interaction: Interaction }[]) => void;
  onClose: () => void;
}

// Parse Gemini response into subject + body
function parseGeminiResponse(text: string): { subject: string; body: string } {
  const lines = text.split('\n');
  const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : 'Follow Up';
  const subjectIdx = lines.findIndex(l => l.toLowerCase().startsWith('subject:'));
  const body = lines.slice(subjectIdx + 2).join('\n').trim();
  return { subject, body };
}

// Replace template variables for a given contact
function applyVariables(text: string, contact: Contact): string {
  return text
    .replace(/\{name\}/gi, contact.name.split(' ')[0])
    .replace(/\{fullname\}/gi, contact.name)
    .replace(/\{email\}/gi, contact.email)
    .replace(/\{location\}/gi, contact.location || '')
    .replace(/\{followers\}/gi, contact.followers?.toLocaleString() || '')
    .replace(/\{instagram\}/gi, contact.instagramHandle || '');
}

// Run promises with concurrency limit
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let i = 0;
  const next = async (): Promise<void> => {
    if (i >= items.length) return;
    const idx = i++;
    await fn(items[idx], idx);
    await next();
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
}

export const BatchOutreachModal: React.FC<BatchOutreachModalProps> = ({
  contacts,
  products,
  templates = [],
  aliases,
  defaultAlias,
  defaultModel,
  productContext,
  emailTrackingEnabled,
  supabaseProjectRef,
  supabaseUserId,
  onSend,
  onClose,
}) => {
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<OutreachMode>('ai');
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [alias, setAlias] = useState(defaultAlias);
  const [generating, setGenerating] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [allGenerated, setAllGenerated] = useState(false);
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [savedDraftCount, setSavedDraftCount] = useState(0);

  // Template mode state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Write mode state
  const [writeSubject, setWriteSubject] = useState('');
  const [writeBody, setWriteBody] = useState('');

  const updateDraft = useCallback((contactId: string, update: Partial<DraftState>) => {
    setDrafts(prev => ({
      ...prev,
      [contactId]: { ...prev[contactId], ...update },
    }));
  }, []);

  const generateForContact = useCallback(async (contact: Contact) => {
    updateDraft(contact.id, { generating: true, error: undefined });
    try {
      const activeProducts = products.filter(p => p.isActive);
      const product = activeProducts.length === 1 ? activeProducts[0] : undefined;
      const ctx = [productContext, product?.aiContext].filter(Boolean).join('\n\n');
      const raw = await getFollowUpSuggestion(contact, ctx || undefined, contact.tags, defaultModel);
      const { subject, body } = parseGeminiResponse(raw);
      updateDraft(contact.id, { subject, body, productId: product?.id, generating: false });
    } catch (e: any) {
      updateDraft(contact.id, {
        generating: false,
        error: e.message || 'Failed to generate',
        subject: 'Follow Up',
        body: '',
      });
    }
  }, [products, productContext, defaultModel, updateDraft]);

  const startAIGeneration = async () => {
    const initial: Record<string, DraftState> = {};
    for (const c of contacts) {
      initial[c.id] = { contactId: c.id, subject: '', body: '', skipped: false, generating: true };
    }
    setDrafts(initial);
    setGenerating(true);
    setStep('generate');

    await runWithConcurrency(contacts, 5, async (contact) => {
      await generateForContact(contact);
    });

    setGenerating(false);
    setAllGenerated(true);
  };

  const initFromTemplate = () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    const initial: Record<string, DraftState> = {};
    for (const c of contacts) {
      initial[c.id] = {
        contactId: c.id,
        subject: applyVariables(template.subject, c),
        body: applyVariables(template.body, c),
        skipped: false,
        generating: false,
      };
    }
    setDrafts(initial);
    setAllGenerated(true);
    setStep('review');
  };

  const initFromWrite = () => {
    if (!writeSubject.trim() || !writeBody.trim()) return;
    const initial: Record<string, DraftState> = {};
    for (const c of contacts) {
      initial[c.id] = {
        contactId: c.id,
        subject: applyVariables(writeSubject, c),
        body: applyVariables(writeBody, c),
        skipped: false,
        generating: false,
      };
    }
    setDrafts(initial);
    setAllGenerated(true);
    setStep('review');
  };

  const handleRegenerate = async (contact: Contact) => {
    await generateForContact(contact);
  };

  const handleSendAll = async () => {
    const toSend = contacts.filter(c => {
      const d = drafts[c.id];
      return d && !d.skipped && d.subject && d.body;
    });
    if (toSend.length === 0) return;

    setSending(true);
    setSendProgress(0);
    setSendErrors([]);
    setStep('send');

    const results: { contact: Contact; interaction: Interaction }[] = [];
    let completed = 0;

    for (const contact of toSend) {
      const draft = drafts[contact.id];
      try {
        let trackingOpts: SendEmailOptions = {};
        if (emailTrackingEnabled && supabaseProjectRef && supabaseUserId) {
          const interactionId = `batch-${contact.id}-${Date.now()}`;
          const token = generateTrackingToken(supabaseUserId, interactionId, contact.id);
          trackingOpts = { trackingPixelUrl: buildTrackingPixelUrl(supabaseProjectRef, token) };
        }

        const result = await sendEmail(
          { to: contact.email, subject: draft.subject, body: draft.body, alias, contactId: contact.id },
          trackingOpts
        );
        if (!result.success) throw new Error(result.error || 'Send failed');

        const interaction: Interaction = {
          id: `batch-${contact.id}-${Date.now()}`,
          type: InteractionType.EMAIL,
          date: new Date().toISOString(),
          notes: `Subject: ${draft.subject}\n\n${draft.body}`,
          outcome: 'Sent',
          emailSubject: draft.subject,
          emailTo: contact.email,
          emailFrom: alias,
          isSentByUser: true,
          gmailMessageId: result.messageId,
        };
        results.push({ contact, interaction });
      } catch (e: any) {
        setSendErrors(prev => [...prev, `${contact.name}: ${e.message || 'Unknown error'}`]);
      }
      completed++;
      setSendProgress(completed);
    }

    setSending(false);
    onSend(results);
    onClose();
  };

  const handleSaveAsDrafts = async () => {
    const toSave = contacts.filter(c => {
      const d = drafts[c.id];
      return d && !d.skipped && d.subject && d.body;
    });
    if (toSave.length === 0) return;

    setSending(true);
    setSendProgress(0);
    setSendErrors([]);
    setSavedDraftCount(0);
    setStep('send');

    let completed = 0;
    let saved = 0;

    for (const contact of toSave) {
      const draft = drafts[contact.id];
      try {
        const result = await saveEmailAsDraft({
          to: contact.email,
          subject: draft.subject,
          body: draft.body,
          alias,
          contactId: contact.id,
        });
        if (!result.success) throw new Error(result.error || 'Save failed');
        saved++;
      } catch (e: any) {
        setSendErrors(prev => [...prev, `${contact.name}: ${e.message || 'Unknown error'}`]);
      }
      completed++;
      setSendProgress(completed);
    }

    setSending(false);
    setSavedDraftCount(saved);
  };

  const activeDrafts = contacts.filter(c => drafts[c.id] && !drafts[c.id].skipped);
  const sendableCount = activeDrafts.filter(c => drafts[c.id]?.subject && drafts[c.id]?.body).length;

  // ---- Render steps ----

  const renderModeStep = () => (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
      <p className="text-sm text-text-muted mb-2">
        How do you want to compose emails for {contacts.length} contacts?
      </p>

      {/* AI Mode */}
      <div
        onClick={() => setMode('ai')}
        className={`p-4 rounded-xl border cursor-pointer transition-all ${
          mode === 'ai'
            ? 'border-outreach/60 bg-outreach/5'
            : 'border-base-600 bg-base-700 hover:border-base-500'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-outreach/15 border border-outreach/25 flex items-center justify-center text-lg text-outreach-light flex-shrink-0">
            ✦
          </div>
          <div>
            <div className="font-semibold text-text-primary text-sm">AI Personalized</div>
            <div className="text-xs text-text-muted mt-0.5">Gemini writes a unique email for each contact based on their profile and history</div>
          </div>
        </div>
      </div>

      {/* Template Mode */}
      {templates.length > 0 && (
        <div
          onClick={() => setMode('template')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            mode === 'template'
              ? 'border-outreach/60 bg-outreach/5'
              : 'border-base-600 bg-base-700 hover:border-base-500'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-base-600 border border-base-500 flex items-center justify-center text-lg flex-shrink-0">
              📋
            </div>
            <div>
              <div className="font-semibold text-text-primary text-sm">Use a Template</div>
              <div className="text-xs text-text-muted mt-0.5">Pick from your saved templates. <span className="font-mono text-outreach-light">{'{name}'}</span> and other variables are auto-filled per contact.</div>
            </div>
          </div>

          {mode === 'template' && (
            <div className="mt-3 border-t border-base-600 pt-3 space-y-1.5" onClick={e => e.stopPropagation()}>
              {templates.map(t => (
                <label key={t.id} className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-base-600 transition-colors">
                  <input
                    type="radio"
                    name="template"
                    checked={selectedTemplateId === t.id}
                    onChange={() => setSelectedTemplateId(t.id)}
                    className="mt-0.5 accent-outreach"
                  />
                  <div>
                    <div className="text-sm font-medium text-text-primary">{t.name}</div>
                    <div className="text-xs text-text-muted truncate max-w-sm">{t.subject}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Write Mode */}
      <div
        onClick={() => setMode('write')}
        className={`p-4 rounded-xl border cursor-pointer transition-all ${
          mode === 'write'
            ? 'border-outreach/60 bg-outreach/5'
            : 'border-base-600 bg-base-700 hover:border-base-500'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-base-600 border border-base-500 flex items-center justify-center text-lg flex-shrink-0">
            ✏️
          </div>
          <div>
            <div className="font-semibold text-text-primary text-sm">Write Your Own</div>
            <div className="text-xs text-text-muted mt-0.5">Compose one email sent to all contacts. Use <span className="font-mono text-outreach-light">{'{name}'}</span> for personalization.</div>
          </div>
        </div>

        {mode === 'write' && (
          <div className="mt-3 border-t border-base-600 pt-3 space-y-2" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              value={writeSubject}
              onChange={e => setWriteSubject(e.target.value)}
              placeholder="Subject — e.g. Hey {name}, quick question about your content"
              className="w-full bg-base-600 border border-base-500 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach"
            />
            <textarea
              value={writeBody}
              onChange={e => setWriteBody(e.target.value)}
              rows={7}
              placeholder={`Hi {name},\n\nI came across your profile and loved your content...\n\n— Your name`}
              className="w-full bg-base-600 border border-base-500 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach resize-none"
            />
            <div className="flex gap-3 text-[11px] text-text-muted font-mono">
              <span>{'{name}'} = first name</span>
              <span>{'{fullname}'} = full name</span>
              <span>{'{location}'} = location</span>
              <span>{'{instagram}'} = IG handle</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderGenerateStep = () => (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      <p className="text-sm text-text-muted mb-4">
        Generating personalized drafts for {contacts.length} contacts using Gemini AI...
      </p>
      {contacts.map(contact => {
        const d = drafts[contact.id];
        const isGenerating = d?.generating ?? true;
        const isDone = d && !d.generating && !d.error;
        const hasError = d?.error;
        return (
          <div key={contact.id} className="flex items-center gap-3 p-3 bg-base-700 rounded-lg border border-base-600">
            <img
              src={contact.avatarUrl}
              alt={contact.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-base-600"
              onError={e => (e.currentTarget.style.display = 'none')}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{contact.name}</div>
              <div className="text-xs text-text-muted truncate">{contact.email}</div>
            </div>
            <div className="flex-shrink-0">
              {isGenerating && (
                <div className="flex items-center gap-1.5 text-xs text-outreach-light">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </div>
              )}
              {isDone && (
                <div className="flex items-center gap-1 text-xs text-partner-light">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Draft ready
                </div>
              )}
              {hasError && (
                <div className="text-xs text-red-400 max-w-[12rem] truncate" title={d.error}>
                  ⚠ {d.error}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderReviewStep = () => (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {contacts.map(contact => {
        const d = drafts[contact.id];
        if (!d) return null;
        return (
          <div
            key={contact.id}
            className={`border rounded-xl p-4 transition-all ${
              d.skipped ? 'border-base-700 opacity-50' : 'border-base-600 bg-base-800'
            }`}
          >
            {/* Card header */}
            <div className="flex items-center gap-3 mb-3">
              <img
                src={contact.avatarUrl}
                alt={contact.name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-base-600"
                onError={e => (e.currentTarget.style.display = 'none')}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-text-primary truncate">{contact.name}</div>
                <div className="text-xs text-text-muted truncate">{contact.email} · {contact.pipelineStage}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {mode === 'ai' && (
                  <button
                    onClick={() => handleRegenerate(contact)}
                    disabled={d.generating}
                    title="Re-generate with AI"
                    className="text-xs text-text-muted hover:text-outreach-light transition-colors p-1 rounded"
                  >
                    {d.generating ? (
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                  </button>
                )}
                <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={d.skipped}
                    onChange={e => updateDraft(contact.id, { skipped: e.target.checked })}
                    className="accent-red-500"
                  />
                  Skip
                </label>
              </div>
            </div>

            {!d.skipped && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Subject</label>
                  <input
                    type="text"
                    value={d.subject}
                    onChange={e => updateDraft(contact.id, { subject: e.target.value })}
                    className="w-full bg-base-700 border border-base-600 rounded-md px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-outreach"
                    placeholder="Subject line..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Body</label>
                  <textarea
                    value={d.body}
                    onChange={e => updateDraft(contact.id, { body: e.target.value })}
                    rows={6}
                    className="w-full bg-base-700 border border-base-600 rounded-md px-2 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach resize-none"
                    placeholder="Email body..."
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderSendStep = () => {
    const isSavedDrafts = saveAsDraft;
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        {sending ? (
          <>
            <div className="w-16 h-16 rounded-full bg-outreach/10 border border-outreach/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-outreach-light animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="text-lg font-semibold text-text-primary mb-1">
              {isSavedDrafts ? `Saving ${sendProgress}/${sendableCount} drafts...` : `Sending ${sendProgress}/${sendableCount}...`}
            </div>
            <div className="w-48 h-1.5 bg-base-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-outreach rounded-full transition-all"
                style={{ width: `${(sendProgress / sendableCount) * 100}%` }}
              />
            </div>
            {sendErrors.length > 0 && (
              <div className="mt-4 text-xs text-red-400 space-y-1">
                {sendErrors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-partner/10 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-partner-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            {isSavedDrafts ? (
              <>
                <div className="text-lg font-semibold text-text-primary">{savedDraftCount} Gmail drafts saved!</div>
                <div className="text-sm text-text-muted mt-1">Open Gmail to review and send each draft when ready.</div>
              </>
            ) : (
              <>
                <div className="text-lg font-semibold text-text-primary">Batch sent!</div>
                <div className="text-sm text-text-muted mt-1">{sendableCount} emails sent successfully</div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const STEPS: { key: Step; label: string }[] = [
    { key: 'mode', label: 'Compose' },
    { key: 'generate', label: 'Generate' },
    { key: 'review', label: 'Review' },
    { key: 'send', label: 'Send' },
  ];
  const visibleSteps = mode === 'ai'
    ? STEPS
    : STEPS.filter(s => s.key !== 'generate');

  const getModeLabel = () => {
    if (mode === 'ai') return 'AI';
    if (mode === 'template') return 'Template';
    return 'Write';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-600 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Batch Outreach</h2>
            <p className="text-xs text-text-muted mt-0.5">{contacts.length} contacts · {getModeLabel()} mode</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {visibleSteps.map((s, idx) => (
                <React.Fragment key={s.key}>
                  <div className={`text-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
                    step === s.key
                      ? 'bg-outreach/20 text-outreach-light'
                      : visibleSteps.findIndex(x => x.key === step) > idx
                        ? 'text-text-secondary'
                        : 'text-text-muted'
                  }`}>
                    {s.label}
                  </div>
                  {idx < visibleSteps.length - 1 && <span className="text-base-600">›</span>}
                </React.Fragment>
              ))}
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* From alias selector (shown on mode/generate step) */}
        {(step === 'mode' || step === 'generate') && aliases.length > 1 && (
          <div className="px-6 py-3 border-b border-base-700 flex items-center gap-3 flex-shrink-0">
            <span className="text-xs text-text-muted">Send from:</span>
            <select
              value={alias}
              onChange={e => setAlias(e.target.value)}
              className="bg-base-700 border border-base-600 rounded-md px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-outreach"
            >
              {aliases.map(a => (
                <option key={a.sendAsEmail} value={a.sendAsEmail}>
                  {a.displayName ? `${a.displayName} <${a.sendAsEmail}>` : a.sendAsEmail}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 'mode' && renderModeStep()}
          {step === 'generate' && renderGenerateStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'send' && renderSendStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-600 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={step === 'send' ? onClose : onClose}
            className="px-4 py-2 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
          >
            {step === 'send' ? 'Close' : 'Cancel'}
          </button>

          <div className="flex items-center gap-3">
            {/* Mode step actions */}
            {step === 'mode' && mode === 'ai' && (
              <button
                onClick={startAIGeneration}
                className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate {contacts.length} AI Drafts
              </button>
            )}

            {step === 'mode' && mode === 'template' && (
              <button
                onClick={initFromTemplate}
                disabled={!selectedTemplateId}
                className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Template
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {step === 'mode' && mode === 'write' && (
              <button
                onClick={initFromWrite}
                disabled={!writeSubject.trim() || !writeBody.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply to All Contacts
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Generate step (AI only) */}
            {step === 'generate' && !allGenerated && (
              <button disabled className="flex items-center gap-2 px-5 py-2 bg-outreach/50 text-white/70 rounded-lg text-sm font-semibold cursor-not-allowed">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </button>
            )}

            {step === 'generate' && allGenerated && (
              <button
                onClick={() => setStep('review')}
                className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Review Drafts
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            {/* Review step */}
            {step === 'review' && (
              <>
                <button
                  onClick={() => setStep(mode === 'ai' ? 'generate' : 'mode')}
                  className="px-4 py-2 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
                >
                  ← Back
                </button>
                {/* Save as Draft toggle */}
                <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsDraft}
                    onChange={e => setSaveAsDraft(e.target.checked)}
                    className="accent-outreach"
                  />
                  Save as Gmail Draft
                </label>
                <button
                  onClick={saveAsDraft ? handleSaveAsDrafts : handleSendAll}
                  disabled={sendableCount === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {saveAsDraft ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    )}
                  </svg>
                  {saveAsDraft
                    ? `Save ${sendableCount} Draft${sendableCount !== 1 ? 's' : ''} in Gmail`
                    : `Send ${sendableCount} Email${sendableCount !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
