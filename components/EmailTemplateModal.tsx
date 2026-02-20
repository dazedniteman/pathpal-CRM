
import React, { useState } from 'react';
import { EmailTemplate, TemplateType, resolveTemplateVariables } from '../types';

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: 'outreach', label: 'Outreach' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'check_in', label: 'Check-in' },
  { value: 'custom', label: 'Custom' },
];

const VARIABLE_CHIPS = [
  { tag: '{name}', hint: 'Contact name' },
  { tag: '{location}', hint: 'Location' },
  { tag: '{instagram}', hint: 'Instagram handle' },
  { tag: '{followers}', hint: 'Follower count' },
  { tag: '{product}', hint: 'Product name' },
];

const PREVIEW_CONTACT = {
  name: 'Sarah Chen',
  location: 'Austin, TX',
  instagramHandle: '@sarahgolfs',
  followers: 12400,
};

interface EmailTemplateModalProps {
  template?: EmailTemplate;
  onSave: (template: Omit<EmailTemplate, 'id'> | EmailTemplate) => Promise<void>;
  onDelete?: (templateId: string) => Promise<void>;
  onClose: () => void;
}

export const EmailTemplateModal: React.FC<EmailTemplateModalProps> = ({
  template,
  onSave,
  onDelete,
  onClose,
}) => {
  const isEdit = !!template;

  const [name, setName] = useState(template?.name || '');
  const [templateType, setTemplateType] = useState<TemplateType>(template?.templateType || 'outreach');
  const [variantGroup, setVariantGroup] = useState(template?.variantGroup || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [body, setBody] = useState(template?.body || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required.'); return; }
    if (!subject.trim()) { setError('Subject line is required.'); return; }
    if (!body.trim()) { setError('Email body is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Omit<EmailTemplate, 'id'> = {
        name: name.trim(),
        templateType,
        variantGroup: variantGroup.trim() || undefined,
        subject: subject.trim(),
        body: body.trim(),
        sendCount: template?.sendCount ?? 0,
        openCount: template?.openCount ?? 0,
      };
      if (isEdit && template) {
        await onSave({ ...template, ...payload });
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(template.id);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to delete template.');
      setDeleting(false);
    }
  };

  const insertVariable = (tag: string) => {
    setBody(prev => prev + tag);
  };

  const previewSubject = resolveTemplateVariables(subject, PREVIEW_CONTACT, 'PathPal');
  const previewBody = resolveTemplateVariables(body, PREVIEW_CONTACT, 'PathPal');

  const openRate = template && (template.sendCount || 0) > 0
    ? Math.round(((template.openCount || 0) / (template.sendCount || 1)) * 100)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-600">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-primary">
              {isEdit ? 'Edit Template' : 'New Template'}
            </h2>
            {openRate !== null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-partner/10 text-partner-light border border-partner/20">
                {openRate}% open rate
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                showPreview
                  ? 'bg-outreach/10 border-outreach/30 text-outreach-light'
                  : 'border-base-600 text-text-muted hover:text-text-primary'
              }`}
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>
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

        <div className="flex-1 overflow-hidden flex">
          {/* Form */}
          <div className={`flex flex-col overflow-y-auto ${showPreview ? 'w-1/2 border-r border-base-600' : 'w-full'}`}>
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Template Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Cold Outreach - Instructor v1"
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Type</label>
                <div className="flex gap-2 flex-wrap">
                  {TEMPLATE_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTemplateType(t.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                        templateType === t.value
                          ? 'bg-outreach/20 border-outreach/40 text-outreach-light'
                          : 'bg-base-700 border-base-600 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variant group */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  A/B Variant Group
                  <span className="ml-1.5 text-text-muted font-normal">(optional — same string groups templates for A/B testing)</span>
                </label>
                <input
                  type="text"
                  value={variantGroup}
                  onChange={e => setVariantGroup(e.target.value)}
                  placeholder="e.g. cold-outreach-q1"
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Subject *</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. {name}, quick idea for your students"
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors"
                />
              </div>

              {/* Variables */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Insert Variable</label>
                <div className="flex gap-1.5 flex-wrap">
                  {VARIABLE_CHIPS.map(v => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertVariable(v.tag)}
                      title={v.hint}
                      className="px-2 py-0.5 bg-base-700 hover:bg-base-600 border border-base-600 hover:border-base-500 rounded-md text-xs font-mono text-outreach-light transition-colors"
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Body *</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write your email template here. Use {name}, {location}, {instagram}, {followers}, {product} for personalization."
                  rows={12}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-outreach transition-colors resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Stats (edit mode) */}
              {isEdit && template && (
                <div className="flex gap-4 text-xs text-text-muted border-t border-base-700 pt-3">
                  <span>Sent: <span className="text-text-secondary font-mono">{template.sendCount || 0}</span></span>
                  <span>Opens: <span className="text-text-secondary font-mono">{template.openCount || 0}</span></span>
                  {openRate !== null && <span>Open rate: <span className="text-partner-light font-semibold">{openRate}%</span></span>}
                </div>
              )}
            </div>
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="w-1/2 flex flex-col overflow-y-auto bg-base-900">
              <div className="px-5 py-4 border-b border-base-700">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Preview</div>
                <div className="text-xs text-text-muted mt-0.5">Using: Sarah Chen · Austin, TX · @sarahgolfs · 12,400 followers · PathPal</div>
              </div>
              <div className="px-5 py-4 space-y-3 flex-1">
                <div>
                  <div className="text-xs font-medium text-text-muted mb-1">Subject</div>
                  <div className="text-sm font-semibold text-text-primary">{previewSubject || <span className="text-text-muted italic">No subject</span>}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-text-muted mb-1">Body</div>
                  <div className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed bg-base-800 rounded-lg p-3 border border-base-700">
                    {previewBody || <span className="text-text-muted italic">No body content</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-600 flex items-center justify-between gap-3">
          <div>
            {isEdit && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">Delete this template?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 bg-base-700 hover:bg-base-600 text-text-secondary rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Delete template
                </button>
              )
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !subject.trim() || !body.trim()}
              className="px-4 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
