
import React, { useState, useCallback } from 'react';
import { Contact, Product, GmailAlias, Interaction, InteractionType } from '../types';
import { getFollowUpSuggestion } from '../services/geminiService';
import { sendEmail, SendEmailOptions, generateTrackingToken, buildTrackingPixelUrl } from '../services/gmailService';

interface DraftState {
  contactId: string;
  subject: string;
  body: string;
  productId?: string;
  skipped: boolean;
  generating: boolean;
  error?: string;
}

type Step = 'generate' | 'review' | 'send';

interface BatchOutreachModalProps {
  contacts: Contact[];
  products: Product[];
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
  const [step, setStep] = useState<Step>('generate');
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [alias, setAlias] = useState(defaultAlias);
  const [generating, setGenerating] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendErrors, setSendErrors] = useState<string[]>([]);
  const [allGenerated, setAllGenerated] = useState(false);

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
      updateDraft(contact.id, {
        subject,
        body,
        productId: product?.id,
        generating: false,
      });
    } catch (e: any) {
      updateDraft(contact.id, {
        generating: false,
        error: e.message || 'Failed to generate',
        subject: 'Follow Up',
        body: '',
      });
    }
  }, [contacts, products, productContext, defaultModel, updateDraft]);

  const startGeneration = async () => {
    // Init draft states
    const initial: Record<string, DraftState> = {};
    for (const c of contacts) {
      initial[c.id] = {
        contactId: c.id,
        subject: '',
        body: '',
        skipped: false,
        generating: true,
      };
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
          {
            to: contact.email,
            subject: draft.subject,
            body: draft.body,
            alias,
            contactId: contact.id,
          },
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

  const activeDrafts = contacts.filter(c => drafts[c.id] && !drafts[c.id].skipped);
  const sendableCount = activeDrafts.filter(c => drafts[c.id]?.subject && drafts[c.id]?.body).length;

  // ---- Render ----

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
              d.skipped
                ? 'border-base-700 opacity-50'
                : 'border-base-600 bg-base-800'
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
                <button
                  onClick={() => handleRegenerate(contact)}
                  disabled={d.generating}
                  title="Re-generate"
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
                {/* Product selector */}
                {products.filter(p => p.isActive).length > 0 && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Product (optional)</label>
                    <select
                      value={d.productId || ''}
                      onChange={e => updateDraft(contact.id, { productId: e.target.value || undefined })}
                      className="w-full bg-base-700 border border-base-600 rounded-md px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-outreach"
                    >
                      <option value="">None</option>
                      {products.filter(p => p.isActive).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Subject */}
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

                {/* Body */}
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

  const renderSendStep = () => (
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
            Sending {sendProgress}/{sendableCount}...
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
          <div className="text-lg font-semibold text-text-primary">Batch sent!</div>
          <div className="text-sm text-text-muted mt-1">{sendableCount} emails sent successfully</div>
        </>
      )}
    </div>
  );

  const STEPS: { key: Step; label: string }[] = [
    { key: 'generate', label: 'Generate' },
    { key: 'review', label: 'Review' },
    { key: 'send', label: 'Send' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-600 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Batch Outreach</h2>
            <p className="text-xs text-text-muted mt-0.5">{contacts.length} contacts selected</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, idx) => (
                <React.Fragment key={s.key}>
                  <div className={`text-xs font-medium px-2 py-0.5 rounded-md transition-colors ${
                    step === s.key
                      ? 'bg-outreach/20 text-outreach-light'
                      : STEPS.findIndex(x => x.key === step) > idx
                        ? 'text-text-secondary'
                        : 'text-text-muted'
                  }`}>
                    {s.label}
                  </div>
                  {idx < STEPS.length - 1 && <span className="text-base-600">›</span>}
                </React.Fragment>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* From alias selector (shown on generate step) */}
        {step === 'generate' && aliases.length > 1 && (
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
          {step === 'generate' && renderGenerateStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'send' && renderSendStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-600 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
          >
            {step === 'send' ? 'Close' : 'Cancel'}
          </button>

          <div className="flex gap-2">
            {step === 'generate' && !allGenerated && (
              <button
                onClick={startGeneration}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate {contacts.length} Drafts
                  </>
                )}
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

            {step === 'review' && (
              <>
                <button
                  onClick={() => setStep('generate')}
                  className="px-4 py-2 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleSendAll}
                  disabled={sendableCount === 0}
                  className="flex items-center gap-2 px-5 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send {sendableCount} Email{sendableCount !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
