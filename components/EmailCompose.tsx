
import React, { useState, useEffect, useRef } from 'react';
import { Contact, EmailDraft, GmailAlias, AppSettings, EmailTemplate, resolveTemplateVariables, InteractionType } from '../types';
import { sendEmail, SendEmailOptions, generateTrackingToken, buildTrackingPixelUrl } from '../services/gmailService';
import { getFollowUpSuggestion, getRelationshipSummary } from '../services/geminiService';

interface EmailComposeProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: Partial<EmailDraft>;
  contact?: Contact;
  aliases: GmailAlias[];
  settings: AppSettings;
  onSent: (draft: EmailDraft, contact?: Contact) => void;
  isGmailConnected: boolean;
  templates?: EmailTemplate[];
  supabaseUserId?: string;
}

export const EmailCompose: React.FC<EmailComposeProps> = ({
  isOpen,
  onClose,
  initialDraft,
  contact,
  aliases,
  settings,
  onSent,
  isGmailConnected,
  templates = [],
  supabaseUserId,
}) => {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedAlias, setSelectedAlias] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const templatePickerRef = useRef<HTMLDivElement>(null);
  const [contextSummary, setContextSummary] = useState('');
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [showContext, setShowContext] = useState(true);

  // Default alias: prefer the pathpalgolf.com alias
  const defaultAlias = aliases.find(a =>
    a.sendAsEmail.toLowerCase().includes('pathpalgolf') || a.isDefault
  ) || aliases[0];

  useEffect(() => {
    if (isOpen) {
      setTo(initialDraft?.to || contact?.email || '');
      setSubject(initialDraft?.subject || '');
      setBody(initialDraft?.body || '');
      setSelectedAlias(initialDraft?.alias || defaultAlias?.sendAsEmail || '');
      setActiveTemplateId(initialDraft?.templateId);
      setError('');
      setSendSuccess(false);
      setShowTemplatePicker(false);
      setContextSummary('');

      // Auto-load relationship context if contact has email interactions
      if (contact) {
        const hasEmails = contact.interactions.some(i => i.type === InteractionType.EMAIL);
        if (hasEmails) {
          setIsLoadingContext(true);
          getRelationshipSummary(contact, settings.defaultAiModel)
            .then(s => setContextSummary(s))
            .catch(() => {})
            .finally(() => setIsLoadingContext(false));
        }
      }
    }
  }, [isOpen, initialDraft, contact?.id, defaultAlias?.sendAsEmail]);

  const applyTemplate = (template: EmailTemplate) => {
    const resolvedSubject = resolveTemplateVariables(template.subject, contact);
    const resolvedBody = resolveTemplateVariables(template.body, contact);
    setSubject(resolvedSubject);
    setBody(resolvedBody);
    setActiveTemplateId(template.id);
    setShowTemplatePicker(false);
  };

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const model = settings.geminiModel || 'gemini-3-flash-preview';
      const result = await getFollowUpSuggestion(
        contact || {
          id: '',
          name: to,
          email: to,
          pipelineStage: 'To Reach Out',
          status: 'New',
          lastContacted: new Date().toISOString(),
          interactions: [],
          avatarUrl: '',
        },
        settings.productContext,
        contact?.tags,
        model
      );

      // Parse subject and body from result
      const lines = result.split('\n');
      const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
      const parsedSubject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : '';
      const subjectIdx = lines.findIndex(l => l.toLowerCase().startsWith('subject:'));
      const parsedBody = lines.slice(subjectIdx + 2).join('\n').trim();

      if (parsedSubject) setSubject(parsedSubject);
      if (parsedBody) setBody(parsedBody);
    } catch (err) {
      setError('Failed to generate email. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Please fill in all fields before sending.');
      return;
    }
    if (!isGmailConnected) {
      setError('Gmail is not connected. Please connect Gmail in Settings.');
      return;
    }

    setIsSending(true);
    setError('');

    const draft: EmailDraft = {
      to: to.trim(),
      subject: subject.trim(),
      body: body.trim(),
      alias: selectedAlias,
      contactId: contact?.id,
      threadId: initialDraft?.threadId,
      replyToMessageId: initialDraft?.replyToMessageId,
      templateId: activeTemplateId,
    };

    // Build tracking options if enabled
    let trackingOpts: SendEmailOptions = {};
    if (settings.emailTrackingEnabled && settings.supabaseProjectRef && supabaseUserId && contact?.id) {
      const interactionId = `compose-${contact.id}-${Date.now()}`;
      const token = generateTrackingToken(supabaseUserId, interactionId, contact.id);
      trackingOpts = { trackingPixelUrl: buildTrackingPixelUrl(settings.supabaseProjectRef, token) };
    }

    const result = await sendEmail(draft, trackingOpts);

    if (result.success) {
      setSendSuccess(true);
      onSent(draft, contact);
      setTimeout(() => {
        onClose();
        setSendSuccess(false);
      }, 1500);
    } else {
      setError(result.error || 'Failed to send email. Please try again.');
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-base-600 shadow-2xl flex flex-col"
        style={{ background: '#111318', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-600">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              {initialDraft?.threadId ? 'Reply' : 'New Email'}
              {contact && <span className="text-text-secondary font-normal"> → {contact.name}</span>}
            </h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Context Panel (relationship summary + recent emails) */}
        {contact && (
          <div className="border-b border-base-700 flex-shrink-0">
            <button
              onClick={() => setShowContext(v => !v)}
              className="w-full flex items-center justify-between px-5 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <span className="flex items-center gap-1.5 font-medium uppercase tracking-wide">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Context
                {isLoadingContext && <span className="w-3 h-3 rounded-full border border-t-outreach animate-spin" />}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 transition-transform ${showContext ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showContext && (
              <div className="px-5 pb-3 space-y-2">
                {/* Relationship summary */}
                {(contextSummary || isLoadingContext) && (
                  <div className="bg-base-700/50 border border-base-600 rounded-lg p-2.5">
                    <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Relationship Overview</p>
                    {isLoadingContext
                      ? <p className="text-xs text-text-muted italic">Analyzing relationship...</p>
                      : <p className="text-xs text-text-secondary leading-relaxed">{contextSummary}</p>
                    }
                  </div>
                )}
                {/* Recent emails */}
                {(() => {
                  const recentEmails = contact.interactions
                    .filter(i => i.type === InteractionType.EMAIL)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 3);
                  if (recentEmails.length === 0) return null;
                  return (
                    <div>
                      <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Recent Emails</p>
                      <div className="space-y-1">
                        {recentEmails.map(i => (
                          <div key={i.id} className="flex items-start gap-2 text-xs">
                            <span className={`flex-shrink-0 mt-0.5 text-[10px] font-medium px-1 rounded ${i.isSentByUser ? 'bg-outreach/20 text-outreach-light' : 'bg-base-600 text-text-muted'}`}>
                              {i.isSentByUser ? 'Sent' : 'Recv'}
                            </span>
                            <div className="min-w-0">
                              <span className="text-text-secondary truncate block">{i.emailSubject || i.notes?.split('\n')[0]?.replace('Subject: ', '') || 'Email'}</span>
                              <span className="text-text-muted">{new Date(i.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {!isLoadingContext && !contextSummary && contact.interactions.filter(i => i.type === InteractionType.EMAIL).length === 0 && (
                  <p className="text-xs text-text-muted italic">No email history yet. Sync Gmail to load context.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* From alias */}
          {aliases.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-text-muted w-12 flex-shrink-0">From</label>
              <select
                value={selectedAlias}
                onChange={e => setSelectedAlias(e.target.value)}
                className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
              >
                {aliases.map(alias => (
                  <option key={alias.sendAsEmail} value={alias.sendAsEmail}>
                    {alias.displayName ? `${alias.displayName} <${alias.sendAsEmail}>` : alias.sendAsEmail}
                    {alias.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* To */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-text-muted w-12 flex-shrink-0">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
              placeholder="recipient@email.com"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-text-muted w-12 flex-shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-3 text-sm text-text-primary outline-none focus:border-outreach transition-colors resize-none leading-relaxed"
              placeholder="Write your email here, or use a template / Generate with AI below..."
              rows={12}
              style={{ minHeight: '240px' }}
            />
            <div className="flex items-center justify-between mt-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-mono">{body.length} chars</span>
                {activeTemplateId && (
                  <span className="text-xs text-outreach-light bg-outreach/10 px-2 py-0.5 rounded-md border border-outreach/20">
                    Template applied
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Template picker */}
                {templates.length > 0 && (
                  <div className="relative" ref={templatePickerRef}>
                    <button
                      onClick={() => setShowTemplatePicker(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-base-700 hover:bg-base-600 border border-base-600 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                      Use Template
                    </button>
                    {showTemplatePicker && (
                      <div className="absolute right-0 bottom-full mb-2 w-72 bg-base-800 border border-base-600 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-base-700">
                          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Choose Template</span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {templates.map(t => (
                            <button
                              key={t.id}
                              onClick={() => applyTemplate(t)}
                              className="w-full text-left px-3 py-2.5 hover:bg-base-700 transition-colors border-b border-base-700/50 last:border-0"
                            >
                              <div className="text-sm font-medium text-text-primary line-clamp-1">{t.name}</div>
                              <div className="text-xs text-text-muted mt-0.5 line-clamp-1">{t.subject}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-outreach-light hover:text-white bg-outreach-dim hover:bg-outreach/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.293 2.293a1 1 0 01.293.707V10a1 1 0 01-1 1h-1a1 1 0 01-1-1V6.707a1 1 0 01.293-.707L11 3z" />
                  </svg>
                  {isGenerating ? 'Generating...' : 'Generate with Gemini'}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Success */}
          {sendSuccess && (
            <div className="px-3 py-2 bg-partner-dim border border-partner/30 rounded-lg text-sm text-partner-light flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Email sent successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-base-600">
          <div className="text-xs text-text-muted">
            {!isGmailConnected && (
              <span className="text-sold-light">⚠ Gmail not connected</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending || sendSuccess || !isGmailConnected}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-outreach hover:bg-outreach-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
