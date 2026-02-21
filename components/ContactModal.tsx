
import React, { useState, useEffect } from 'react';
import { Contact, Interaction, InteractionType, AppSettings, PartnershipType, PartnerDetails, Task, EmailDraft, GmailAlias, ContactType, Product, ContactProduct, Sequence, ContactSequence, Project, ContactProject, DrillVideoLink, calculateHealthScore, getHealthLevel, daysSince } from '../types';
import { getFollowUpSuggestion, summarizeEmail, getRelationshipSummary } from '../services/geminiService';
import { getSequenceProgress, getNextStep, getStepDueDate } from '../services/sequenceService';
import { ContactTimeline } from './ContactTimeline';
import { AtSymbolIcon, CalendarIcon, CloseIcon, LinkIcon, LocationMarkerIcon, PencilAltIcon, PhoneIcon, RefreshIcon, SparklesIcon, UsersIcon, TagIcon, PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from './icons';

interface ContactModalProps {
  contact: Contact;
  onClose: () => void;
  onUpdate: (contact: Contact) => void;
  onAddInteraction: (contactId: string, interaction: Interaction) => void;
  onSyncGmail: (contact: Contact) => Promise<void>;
  isGmailConnected: boolean;
  settings: AppSettings;
  tasks: Task[];
  onTaskAdd: (task: Omit<Task, 'id'>) => void;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onDelete: (contactId: string) => void;
  onComposeEmail?: (draft: Partial<EmailDraft>, contact?: Contact) => void;
  aliases?: GmailAlias[];
  products?: Product[];
  contactProducts?: ContactProduct[];
  onLinkProduct?: (link: Omit<ContactProduct, 'id'>) => Promise<void>;
  onUnlinkProduct?: (linkId: string) => Promise<void>;
  onUpdateContactProduct?: (link: ContactProduct) => Promise<void>;
  // Phase 3: Sequences
  sequences?: Sequence[];
  contactEnrollments?: ContactSequence[];
  onEnrollContact?: (sequenceId: string) => Promise<void>;
  onCompleteStep?: (enrollmentId: string, stepId: string, sequence: Sequence) => Promise<void>;
  onUnenrollContact?: (enrollmentId: string) => Promise<void>;
  // Phase 4: Projects
  projects?: Project[];
  contactProjects?: ContactProject[];
  onLinkProject?: (projectId: string) => Promise<void>;
  onUnlinkProject?: (linkId: string) => Promise<void>;
}

const DEFAULT_PARTNER_DETAILS: PartnerDetails = {
  contractSigned: false, continueFollowUp: false,
  drillVideosAgreed: 0, drillVideosDelivered: 0, drillVideoLinks: [],
  testimonialVideoAgreed: false, testimonialVideoDelivered: false, testimonialVideoLink: '',
  websiteLinkAgreed: false, websiteLinkDelivered: false, websiteLinkUrl: '',
  socialPostAgreed: false, socialPostDelivered: false, socialPostLink: '',
};

type ActiveTab = 'timeline' | 'tasks' | 'ai' | 'partnership';

const TabBtn: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; badge?: number }> = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active
        ? 'border-outreach text-outreach-light'
        : 'border-transparent text-text-muted hover:text-text-secondary'
    }`}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${active ? 'bg-outreach-dim text-outreach-light' : 'bg-base-600 text-text-muted'}`}>
        {badge}
      </span>
    )}
  </button>
);

const DeliverableRow: React.FC<{
  label: string; agreed: boolean; delivered: boolean;
  onAgreedChange: (v: boolean) => void; onDeliveredChange: (v: boolean) => void;
  dueDate?: string; onDueDateChange?: (v: string) => void;
}> = ({ label, agreed, delivered, onAgreedChange, onDeliveredChange, dueDate, onDueDateChange }) => {
  const isOverdue = dueDate && !delivered && new Date(dueDate) < new Date();
  return (
    <div className="p-3 bg-base-700 rounded-lg space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium text-text-primary text-sm">{label}</span>
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted">
            <input type="checkbox" checked={agreed} onChange={e => onAgreedChange(e.target.checked)} className="accent-partner" />
            Agreed
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted">
            <input type="checkbox" checked={delivered} onChange={e => onDeliveredChange(e.target.checked)} disabled={!agreed} className="accent-partner disabled:opacity-50" />
            Delivered
          </label>
        </div>
      </div>
      {agreed && !delivered && onDueDateChange && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted flex-shrink-0">Due date:</label>
          <input
            type="date"
            value={dueDate ? dueDate.split('T')[0] : ''}
            onChange={e => onDueDateChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
            className={`flex-1 bg-base-600 border rounded px-2 py-1 text-xs font-mono text-text-primary outline-none focus:border-partner/50 transition-colors ${isOverdue ? 'border-red-500/50 text-red-400' : 'border-base-500'}`}
          />
          {isOverdue && <span className="text-xs text-red-400 flex-shrink-0">Overdue</span>}
        </div>
      )}
    </div>
  );
};

export const ContactModal: React.FC<ContactModalProps> = ({
  contact, onClose, onUpdate, onAddInteraction, onSyncGmail,
  isGmailConnected, settings, tasks, onTaskAdd, onTaskUpdate, onTaskDelete,
  onDelete, onComposeEmail, aliases = [],
  products = [], contactProducts = [], onLinkProduct, onUnlinkProduct, onUpdateContactProduct,
  sequences = [], contactEnrollments = [], onEnrollContact, onCompleteStep, onUnenrollContact,
  projects = [], contactProjects = [], onLinkProject, onUnlinkProject,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('timeline');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingDealType, setIsEditingDealType] = useState(false);
  const [error, setError] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [editableContact, setEditableContact] = useState<Contact>(contact);
  const [tagInput, setTagInput] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [relationshipSummary, setRelationshipSummary] = useState('');
  const [isLoadingRelSummary, setIsLoadingRelSummary] = useState(false);

  useEffect(() => {
    setEditableContact(contact);
    setIsEditingDealType(false);
    setActiveTab(contact.partnershipType === PartnershipType.PARTNER ? 'partnership' : 'timeline');
  }, [contact]);

  useEffect(() => {
    setIsDirty(JSON.stringify(contact) !== JSON.stringify(editableContact));
  }, [contact, editableContact]);

  const handleUpdate = (updatedData: Partial<Contact>) => {
    setEditableContact(prev => ({ ...prev, ...updatedData }));
  };

  const handlePartnerDetailChange = (field: keyof PartnerDetails, value: any) => {
    handleUpdate({ partnerDetails: { ...(editableContact.partnerDetails || DEFAULT_PARTNER_DETAILS), [field]: value } });
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') finalValue = value ? parseInt(value, 10) : undefined;
    else if (type === 'date') finalValue = value ? new Date(value).toISOString() : undefined;
    handleUpdate({ [name]: finalValue });
  };

  const classifyDeal = (type: PartnershipType) => {
    const update: Partial<Contact> = { partnershipType: type };
    if (type === PartnershipType.PARTNER && !contact.partnerDetails) {
      update.partnerDetails = DEFAULT_PARTNER_DETAILS;
    }
    handleUpdate(update);
    setIsEditingDealType(false);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (newTag) {
        handleUpdate({ tags: Array.from(new Set([...(editableContact.tags || []), newTag])) });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleUpdate({ tags: (editableContact.tags || []).filter(t => t !== tagToRemove) });
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !newTaskDueDate) return;
    onTaskAdd({ title: newTaskTitle, dueDate: newTaskDueDate, completed: false, contactId: contact.id });
    setNewTaskTitle('');
    setNewTaskDueDate('');
  };

  const handleDelete = () => {
    if (window.confirm(`Delete ${contact.name}? This cannot be undone.`)) {
      onDelete(contact.id);
    }
  };

  const handleGetRelationshipSummary = async () => {
    setIsLoadingRelSummary(true);
    try {
      const s = await getRelationshipSummary(contact, settings.defaultAiModel);
      setRelationshipSummary(s);
    } finally {
      setIsLoadingRelSummary(false);
    }
  };

  const handleSummarizeEmail = (body: string) =>
    summarizeEmail(body, settings.defaultAiModel);

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes. Discard them?")) onClose();
    } else {
      onClose();
    }
  };

  const handleSave = () => onUpdate(editableContact);

  const handleGmailSync = async () => {
    setIsSyncing(true);
    await onSyncGmail(contact);
    setIsSyncing(false);
  };

  const handleGenerateSuggestion = async () => {
    setIsLoadingAi(true);
    setError('');
    setAiSuggestion('');
    try {
      // Build project context from assigned projects
      const projectContext = contactProjects.length > 0
        ? contactProjects
            .map(cp => projects.find(p => p.id === cp.projectId)?.goal)
            .filter(Boolean)
            .join('\n')
        : undefined;
      const s = await getFollowUpSuggestion(contact, settings.productContext, contact.tags, settings.defaultAiModel, projectContext);
      setAiSuggestion(s);
    } catch {
      setError('Failed to generate suggestion. Check your Gemini API key.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleUseSuggestion = () => {
    if (!aiSuggestion || !onComposeEmail) return;
    const lines = aiSuggestion.split('\n');
    const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '') : 'Follow-up';
    const body = lines.filter(l => !l.toLowerCase().startsWith('subject:')).join('\n').trim();
    onComposeEmail({ to: contact.email, subject, body, alias: '' }, contact);
  };

  // Quick-set follow-up date helpers
  const setFollowUpQuick = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    handleUpdate({ nextFollowUpDate: d.toISOString() });
  };

  const followUpInfo = (() => {
    if (!editableContact.nextFollowUpDate) return null;
    const date = new Date(editableContact.nextFollowUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
    const isOverdue = diffDays < 0;
    const dayMonth = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const relText = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : diffDays < 0 ? `${Math.abs(diffDays)}d overdue` : `in ${diffDays}d`;
    return { dayMonth, relText, isOverdue };
  })();

  // Drill video helpers
  const addDrillVideo = () => {
    const existing = editableContact.partnerDetails?.drillVideoLinks || [];
    const updated = [...existing, { url: '' }];
    handlePartnerDetailChange('drillVideoLinks', updated);
    handlePartnerDetailChange('drillVideosAgreed', updated.length);
  };

  const updateDrillVideo = (idx: number, updated: DrillVideoLink) => {
    const existing = [...(editableContact.partnerDetails?.drillVideoLinks || [])];
    existing[idx] = updated;
    const delivered = existing.filter(v => v.deliveredAt).length;
    handlePartnerDetailChange('drillVideoLinks', existing);
    handlePartnerDetailChange('drillVideosDelivered', delivered);
    handlePartnerDetailChange('drillVideosAgreed', existing.length);
  };

  const removeDrillVideo = (idx: number) => {
    const existing = (editableContact.partnerDetails?.drillVideoLinks || []).filter((_, i) => i !== idx);
    const delivered = existing.filter(v => v.deliveredAt).length;
    handlePartnerDetailChange('drillVideoLinks', existing);
    handlePartnerDetailChange('drillVideosDelivered', delivered);
    handlePartnerDetailChange('drillVideosAgreed', existing.length);
  };

  // Additional emails helpers
  const addAdditionalEmail = () => {
    const trimmed = newEmailInput.trim();
    if (!trimmed || !trimmed.includes('@')) return;
    const existing = editableContact.additionalEmails || [];
    if (!existing.includes(trimmed)) {
      handleUpdate({ additionalEmails: [...existing, trimmed] });
    }
    setNewEmailInput('');
  };

  const removeAdditionalEmail = (email: string) => {
    handleUpdate({ additionalEmails: (editableContact.additionalEmails || []).filter(e => e !== email) });
  };

  // Health score
  const score = calculateHealthScore(contact);
  const level = getHealthLevel(score);
  const healthColors = { warm: '#10B981', cooling: '#F59E0B', cold: '#EF4444' };
  const healthColor = healthColors[level];
  const daysAgo = daysSince(contact.lastContacted);

  const contactTypeOptions: { value: ContactType; label: string }[] = [
    { value: 'instructor', label: 'Instructor' },
    { value: 'media', label: 'Media' },
    { value: 'customer', label: 'Customer' },
    { value: 'other', label: 'Other' },
  ];

  // --- Left column: contact info ---
  const renderLeftColumn = () => (
    <div className="md:col-span-1 flex flex-col gap-4 overflow-y-auto pr-1">
      {/* Avatar + name + stage */}
      <div className="flex items-start gap-4">
        <img src={contact.avatarUrl} alt={contact.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <input
            type="text"
            name="name"
            value={editableContact.name}
            onChange={handleFieldChange}
            className="bg-transparent text-lg font-bold text-text-primary w-full rounded px-1 py-0.5 focus:ring-1 focus:ring-outreach/50 outline-none"
          />
          <select
            name="pipelineStage"
            value={editableContact.pipelineStage}
            onChange={handleFieldChange}
            className="mt-1 bg-base-700 border border-base-600 text-text-secondary text-xs rounded-full px-2 py-1 outline-none focus:ring-1 focus:ring-outreach/50 w-full"
          >
            {settings.pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {/* Health dot */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: healthColor }} />
            <span className="text-xs" style={{ color: healthColor }}>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
            <span className="text-xs text-text-muted">· {daysAgo === 9999 ? 'Never contacted' : `${daysAgo}d since contact`}</span>
          </div>
        </div>
      </div>

      {/* Deal type */}
      {editableContact.pipelineStage === 'Closed - Success' && !editableContact.partnershipType && !isEditingDealType && (
        <div className="bg-outreach-dim border border-outreach/30 p-3 rounded-lg text-center">
          <p className="text-xs text-text-secondary mb-2 font-medium">Classify this deal:</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => classifyDeal(PartnershipType.SALE)} className="text-xs px-3 py-1.5 rounded-lg bg-sold-dim text-sold-light border border-sold/30 hover:bg-sold/20">Sale</button>
            <button onClick={() => classifyDeal(PartnershipType.PARTNER)} className="text-xs px-3 py-1.5 rounded-lg bg-partner-dim text-partner-light border border-partner/30 hover:bg-partner/20">Partnership</button>
          </div>
        </div>
      )}
      {editableContact.partnershipType && (
        <div className={`flex items-center justify-between p-2 rounded-lg border ${editableContact.partnershipType === PartnershipType.PARTNER ? 'bg-partner-dim border-partner/30 text-partner-light' : 'bg-sold-dim border-sold/30 text-sold-light'}`}>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {editableContact.partnershipType === PartnershipType.PARTNER ? '🤝 Partner' : '💰 Customer'}
          </span>
          <button onClick={() => setIsEditingDealType(true)} className="text-text-muted hover:text-text-secondary">
            <PencilAltIcon />
          </button>
        </div>
      )}
      {isEditingDealType && (
        <div className="bg-base-700 border border-base-600 p-3 rounded-lg text-center">
          <p className="text-xs text-text-secondary mb-2">Change deal type:</p>
          <div className="flex justify-center gap-2">
            <button onClick={() => classifyDeal(PartnershipType.SALE)} className="text-xs px-3 py-1.5 rounded-lg bg-sold-dim text-sold-light">Sale</button>
            <button onClick={() => classifyDeal(PartnershipType.PARTNER)} className="text-xs px-3 py-1.5 rounded-lg bg-partner-dim text-partner-light">Partnership</button>
          </div>
        </div>
      )}

      {/* Contact type */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">Contact Type</label>
        <select
          name="contactType"
          value={editableContact.contactType || 'instructor'}
          onChange={handleFieldChange}
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
        >
          {contactTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Fields */}
      <div className="space-y-2">
        {[
          { name: 'email' as const, label: 'Email', type: 'email' },
          { name: 'phone' as const, label: 'Phone', type: 'tel' },
          { name: 'location' as const, label: 'Location (State)', type: 'text' },
          { name: 'website' as const, label: 'Website', type: 'url' },
          { name: 'instagramHandle' as const, label: 'Instagram Handle', type: 'text' },
        ].map(f => (
          <div key={f.name}>
            <label className="text-xs text-text-muted">{f.label}</label>
            <input
              type={f.type}
              name={f.name}
              value={(editableContact[f.name] as string) || ''}
              onChange={handleFieldChange}
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-outreach/50 mt-0.5"
            />
          </div>
        ))}
      </div>

      {/* Social stats */}
      <div className="grid grid-cols-3 gap-2">
        {(['followers', 'following', 'posts'] as const).map(f => (
          <div key={f}>
            <label className="text-xs text-text-muted capitalize">{f}</label>
            <input
              type="number"
              name={f}
              value={editableContact[f] || ''}
              onChange={handleFieldChange}
              className="w-full bg-base-700 border border-base-600 rounded-lg px-2 py-1.5 text-sm text-text-primary text-center font-mono outline-none focus:border-outreach/50 mt-0.5"
            />
          </div>
        ))}
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">Tags</label>
        <div className="bg-base-700 border border-base-600 rounded-lg p-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(editableContact.tags || []).map(tag => (
              <span key={tag} className="flex items-center bg-outreach-dim text-outreach-light text-xs px-2 py-0.5 rounded-full">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1.5 hover:text-white">×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagInputKeyDown}
            placeholder="Add tag, press Enter…"
            className="w-full bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
          />
        </div>
      </div>

      {/* Next follow-up date */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">Next Follow-up Date</label>
        {followUpInfo && (
          <div className={`flex items-center gap-2 mb-1.5 px-2 py-1 rounded-md ${followUpInfo.isOverdue ? 'bg-red-500/10' : 'bg-base-700'}`}>
            <span className={`text-sm font-medium ${followUpInfo.isOverdue ? 'text-red-400' : 'text-text-primary'}`}>
              {followUpInfo.dayMonth}
            </span>
            <span className={`text-xs font-mono ${followUpInfo.isOverdue ? 'text-red-400' : 'text-text-muted'}`}>
              · {followUpInfo.relText}
            </span>
            {followUpInfo.isOverdue && <span className="text-xs">⚠</span>}
          </div>
        )}
        <input
          type="date"
          name="nextFollowUpDate"
          value={editableContact.nextFollowUpDate ? editableContact.nextFollowUpDate.split('T')[0] : ''}
          onChange={handleFieldChange}
          className={`w-full bg-base-700 border rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50 ${followUpInfo?.isOverdue ? 'border-red-500/50' : 'border-base-600'}`}
        />
        <div className="flex gap-1.5 mt-1.5">
          {[{ label: '+1 Wk', days: 7 }, { label: '+2 Wks', days: 14 }, { label: '+1 Mo', days: 30 }].map(({ label, days }) => (
            <button
              key={label}
              type="button"
              onClick={() => setFollowUpQuick(days)}
              className="flex-1 py-1 text-xs font-medium text-text-muted hover:text-text-secondary bg-base-700 hover:bg-base-600 border border-base-600 rounded-md transition-colors"
            >
              {label}
            </button>
          ))}
          {editableContact.nextFollowUpDate && (
            <button
              type="button"
              onClick={() => handleUpdate({ nextFollowUpDate: undefined })}
              className="px-2 py-1 text-xs text-text-muted hover:text-red-400 bg-base-700 hover:bg-red-500/10 border border-base-600 rounded-md transition-colors"
              title="Clear date"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">Notes</label>
        <textarea
          name="richNotes"
          value={editableContact.richNotes || editableContact.notes || ''}
          onChange={e => handleUpdate({ richNotes: e.target.value })}
          placeholder="Private notes about this contact…"
          className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50 resize-none"
          rows={4}
        />
      </div>

      {/* Additional Emails */}
      <div>
        <label className="text-xs text-text-muted mb-1 block">Additional Emails</label>
        <div className="space-y-1">
          {(editableContact.additionalEmails || []).map(email => (
            <div key={email} className="flex items-center gap-2 bg-base-700 border border-base-600 rounded-lg px-3 py-1.5">
              <span className="flex-1 text-sm text-text-primary truncate">{email}</span>
              <button onClick={() => removeAdditionalEmail(email)} className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0 text-sm">×</button>
            </div>
          ))}
          <div className="flex gap-1.5">
            <input
              type="email"
              value={newEmailInput}
              onChange={e => setNewEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAdditionalEmail(); } }}
              placeholder="Add another email…"
              className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-outreach/50"
            />
            <button
              onClick={addAdditionalEmail}
              className="px-3 py-1.5 text-xs font-medium text-outreach-light bg-outreach-dim border border-outreach/30 hover:bg-outreach/20 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Stop Follow-up */}
      <div className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${editableContact.stopFollowUp ? 'bg-amber-950/30 border-amber-500/30' : 'bg-base-700 border-base-600'}`}>
        <div>
          <p className="text-sm font-medium text-text-primary">Stop Follow-up</p>
          <p className="text-xs text-text-muted">Pause outreach without deleting this contact</p>
        </div>
        <button
          type="button"
          onClick={() => handleUpdate({ stopFollowUp: !editableContact.stopFollowUp })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${editableContact.stopFollowUp ? 'bg-amber-500' : 'bg-base-500'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editableContact.stopFollowUp ? 'translate-x-[1.125rem]' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* Biography (read-only from Instagram) */}
      {contact.biography && (
        <div>
          <label className="text-xs text-text-muted mb-1 block">Bio (from Instagram)</label>
          <p className="text-xs text-text-secondary bg-base-700 border border-base-600 rounded-lg px-3 py-2 whitespace-pre-wrap">{contact.biography}</p>
        </div>
      )}

      {/* Products section */}
      {products.length > 0 && onLinkProduct && (
        <div>
          <label className="text-xs text-text-muted mb-2 block">Products</label>
          <div className="space-y-2">
            {contactProducts.map(cp => {
              const product = products.find(p => p.id === cp.productId);
              if (!product) return null;
              return (
                <div key={cp.id} className="flex items-start gap-2 p-2 bg-base-700 border border-base-600 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-text-primary">{product.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cp.receivedFree}
                          onChange={e => onUpdateContactProduct?.({ ...cp, receivedFree: e.target.checked })}
                          className="accent-partner"
                        />
                        Free
                      </label>
                      {!cp.receivedFree && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={cp.quantityPurchased || ''}
                            onChange={e => onUpdateContactProduct?.({ ...cp, quantityPurchased: parseInt(e.target.value) || 0 })}
                            placeholder="Qty"
                            className="w-12 bg-base-800 border border-base-600 rounded px-1 py-0.5 text-xs text-text-primary text-center outline-none"
                          />
                          <span className="text-xs text-text-muted">purchased</span>
                        </div>
                      )}
                    </div>
                    {cp.notes !== undefined && (
                      <input
                        type="text"
                        value={cp.notes || ''}
                        onChange={e => onUpdateContactProduct?.({ ...cp, notes: e.target.value })}
                        placeholder="Notes..."
                        className="mt-1 w-full bg-transparent text-xs text-text-secondary placeholder-text-muted outline-none border-b border-base-600 pb-0.5"
                      />
                    )}
                  </div>
                  {onUnlinkProduct && (
                    <button
                      onClick={() => onUnlinkProduct(cp.id)}
                      className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
            {/* Add product picker */}
            {products.filter(p => p.isActive && !contactProducts.find(cp => cp.productId === p.id)).length > 0 && (
              <select
                value=""
                onChange={e => {
                  if (e.target.value) {
                    onLinkProduct({ contactId: contact.id, productId: e.target.value, receivedFree: false, notes: '' });
                  }
                }}
                className="w-full bg-base-700 border border-base-600 border-dashed rounded-lg px-2 py-1.5 text-xs text-text-muted focus:outline-none focus:border-outreach transition-colors cursor-pointer"
              >
                <option value="">+ Link a product...</option>
                {products
                  .filter(p => p.isActive && !contactProducts.find(cp => cp.productId === p.id))
                  .map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Sequences section */}
      {sequences.length > 0 && (
        <div>
          <label className="text-xs text-text-muted mb-2 block">Sequences</label>
          <div className="space-y-2">
            {/* Active enrollments */}
            {contactEnrollments.map(enrollment => {
              const seq = sequences.find(s => s.id === enrollment.sequenceId);
              if (!seq) return null;
              const progress = getSequenceProgress(enrollment, seq);
              const nextStep = getNextStep(enrollment, seq);
              const nextDueDate = nextStep ? getStepDueDate(nextStep, enrollment.enrolledAt) : null;
              const isOverdue = nextDueDate ? nextDueDate <= new Date() : false;
              return (
                <div key={enrollment.id} className="p-2.5 bg-base-700 border border-base-600 rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-text-primary truncate">{seq.name}</span>
                        <span className="text-xs text-text-muted font-mono flex-shrink-0">
                          {progress.completed}/{progress.total}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 w-full h-1 bg-base-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${progress.percentComplete}%`, background: '#6366F1' }}
                        />
                      </div>
                      {nextStep && nextDueDate && (
                        <p className="text-xs text-text-muted mt-1.5 truncate">
                          Next: {nextStep.description}
                          {' · '}
                          <span className={isOverdue ? 'text-red-400' : ''}>
                            {isOverdue ? 'Overdue' : nextDueDate.toLocaleDateString()}
                          </span>
                        </p>
                      )}
                      {!nextStep && (
                        <p className="text-xs text-partner-light mt-1">✓ All steps complete</p>
                      )}
                    </div>
                    {onUnenrollContact && (
                      <button
                        onClick={() => onUnenrollContact(enrollment.id)}
                        className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none mt-0.5"
                        title="Unenroll from sequence"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Enroll dropdown */}
            {onEnrollContact && sequences.filter(s => s.isActive && !contactEnrollments.find(e => e.sequenceId === s.id)).length > 0 && (
              <select
                value=""
                onChange={e => {
                  if (e.target.value) onEnrollContact(e.target.value);
                }}
                className="w-full bg-base-700 border border-base-600 border-dashed rounded-lg px-2 py-1.5 text-xs text-text-muted focus:outline-none focus:border-outreach transition-colors cursor-pointer"
              >
                <option value="">+ Enroll in sequence...</option>
                {sequences
                  .filter(s => s.isActive && !contactEnrollments.find(e => e.sequenceId === s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Projects section */}
      {(contactProjects.length > 0 || (projects.filter(p => p.isActive && !contactProjects.find(cp => cp.projectId === p.id)).length > 0)) && (
        <div className="border-t border-base-600 pt-4 space-y-2">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Projects</h4>
          {contactProjects.map(cp => {
            const project = projects.find(p => p.id === cp.projectId);
            if (!project) return null;
            return (
              <div key={cp.id} className="flex items-start gap-2 p-2 bg-base-700 border border-base-600 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{project.name}</p>
                  <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{project.goal}</p>
                </div>
                {onUnlinkProject && (
                  <button
                    onClick={() => onUnlinkProject(cp.id)}
                    className="text-text-muted hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none mt-0.5"
                    title="Remove from project"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {onLinkProject && projects.filter(p => p.isActive && !contactProjects.find(cp => cp.projectId === p.id)).length > 0 && (
            <select
              value=""
              onChange={e => { if (e.target.value) onLinkProject(e.target.value); }}
              className="w-full bg-base-700 border border-base-600 border-dashed rounded-lg px-2 py-1.5 text-xs text-text-muted focus:outline-none focus:border-outreach transition-colors cursor-pointer"
            >
              <option value="">+ Assign to project...</option>
              {projects
                .filter(p => p.isActive && !contactProjects.find(cp => cp.projectId === p.id))
                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Compose email button */}
      {onComposeEmail && (
        <button
          onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-outreach-light bg-outreach-dim border border-outreach/30 hover:bg-outreach/20 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Compose Email
        </button>
      )}

      {/* Delete */}
      <div className="border-t border-base-600 pt-4">
        <button
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
        >
          <TrashIcon />
          Delete Contact
        </button>
      </div>
    </div>
  );

  // --- Right column: tabs ---
  const renderRightColumn = () => (
    <div className="md:col-span-2 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-base-600 mb-4">
        <TabBtn active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} badge={contact.interactions.length}>
          Timeline
        </TabBtn>
        <TabBtn active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} badge={tasks.length}>
          Tasks
        </TabBtn>
        {editableContact.partnershipType === PartnershipType.PARTNER && (
          <TabBtn active={activeTab === 'partnership'} onClick={() => setActiveTab('partnership')}>
            Partnership
          </TabBtn>
        )}
        <TabBtn active={activeTab === 'ai'} onClick={() => setActiveTab('ai')}>
          AI Assistant
        </TabBtn>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-4 h-full">
            {/* Gmail sync button */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">Emails, calls, meetings, notes — newest first</p>
              <button
                onClick={handleGmailSync}
                disabled={!isGmailConnected || isSyncing}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-base-700 border border-base-600 text-text-muted hover:text-text-secondary hover:border-outreach/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isSyncing ? 'Syncing…' : 'Sync Gmail'}
              </button>
            </div>

            {/* Relationship summary card */}
            <div className="bg-base-700 border border-base-600 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wide flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-outreach-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Relationship Overview
                </span>
                <button
                  onClick={handleGetRelationshipSummary}
                  disabled={isLoadingRelSummary}
                  className="text-xs text-outreach-light hover:text-outreach transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {isLoadingRelSummary ? (
                    <><div className="w-3 h-3 rounded-full border border-t-outreach animate-spin" /> Analyzing…</>
                  ) : (
                    <>{relationshipSummary ? 'Refresh' : 'Analyze'}</>
                  )}
                </button>
              </div>
              {relationshipSummary ? (
                <p className="text-xs text-text-secondary leading-relaxed">{relationshipSummary}</p>
              ) : (
                <p className="text-xs text-text-muted italic">Click "Analyze" for an AI-powered relationship snapshot and next action.</p>
              )}
            </div>

            <ContactTimeline
              interactions={contact.interactions}
              tasks={tasks}
              onReply={onComposeEmail ? (i) => onComposeEmail({
                to: contact.email,
                alias: '',
                subject: i.emailSubject ? `Re: ${i.emailSubject}` : '',
                threadId: i.gmailThreadId,
                replyToMessageId: i.gmailMessageId,
              }, contact) : undefined}
              onTaskUpdate={onTaskUpdate}
              onSummarizeEmail={handleSummarizeEmail}
            />

            {/* Log note */}
            <div className="border-t border-base-600 pt-3 mt-auto">
              <p className="text-xs text-text-muted mb-2">Log a note, call, or meeting:</p>
              <div className="flex gap-2">
                <textarea
                  placeholder="What happened? Notes from a call, meeting…"
                  id="new-interaction-notes"
                  className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-outreach/50 resize-none"
                  rows={2}
                />
                <button
                  onClick={() => {
                    const el = document.getElementById('new-interaction-notes') as HTMLTextAreaElement;
                    if (!el?.value.trim()) return;
                    onAddInteraction(contact.id, {
                      id: `int-${Date.now()}`,
                      type: InteractionType.NOTE,
                      date: new Date().toISOString(),
                      notes: el.value,
                    });
                    el.value = '';
                  }}
                  className="px-3 py-2 bg-outreach-dim border border-outreach/30 text-outreach-light text-xs font-medium rounded-lg hover:bg-outreach/20 transition-colors self-end"
                >
                  Log
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-4 h-full">
            <div className="space-y-2 flex-1 overflow-y-auto">
              {tasks.length > 0 ? tasks.map(task => {
                const isOverdue = !task.completed && new Date(task.dueDate) < new Date();
                return (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-base-700 border border-base-600 rounded-lg">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={e => onTaskUpdate({ ...task, completed: e.target.checked })}
                      className="accent-outreach"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{task.title}</p>
                      <p className={`text-xs font-mono ${isOverdue ? 'text-red-400' : 'text-text-muted'}`}>
                        {isOverdue ? '⚠ Overdue · ' : ''}Due {new Date(task.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => onTaskDelete(task.id)} className="text-text-muted hover:text-red-400 transition-colors">
                      <TrashIcon />
                    </button>
                  </div>
                );
              }) : (
                <p className="text-text-muted text-sm py-4">No tasks for this contact.</p>
              )}
            </div>

            <div className="border-t border-base-600 pt-4 mt-auto">
              <p className="text-xs text-text-muted mb-2">Add task:</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="Task description…"
                  className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
                />
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={e => setNewTaskDueDate(e.target.value)}
                  className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
                />
                <button
                  onClick={handleAddTask}
                  className="px-4 py-2 bg-outreach-dim border border-outreach/30 text-outreach-light text-sm font-medium rounded-lg hover:bg-outreach/20 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                Model: <span className="font-mono text-text-secondary">{settings.defaultAiModel || 'gemini-3-flash-preview'}</span>
              </p>
            </div>
            <div className="flex-1 bg-base-700 border border-base-600 rounded-lg p-4 text-sm text-text-secondary overflow-y-auto whitespace-pre-wrap min-h-[200px]">
              {isLoadingAi ? (
                <div className="flex items-center gap-2 text-text-muted">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-outreach" />
                  Generating…
                </div>
              ) : error ? (
                <p className="text-red-400">{error}</p>
              ) : aiSuggestion ? (
                aiSuggestion
              ) : (
                <p className="text-text-muted italic">Click "Generate" to get a personalized follow-up email suggestion for {contact.name}.</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleGenerateSuggestion}
                disabled={isLoadingAi}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium bg-outreach-dim border border-outreach/30 text-outreach-light hover:bg-outreach/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <SparklesIcon />
                {isLoadingAi ? 'Generating…' : 'Generate Suggestion'}
              </button>
              {aiSuggestion && onComposeEmail && (
                <button
                  onClick={handleUseSuggestion}
                  className="px-4 py-2 text-sm font-medium bg-partner-dim border border-partner/30 text-partner-light hover:bg-partner/20 rounded-lg transition-colors"
                >
                  Use in Email
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'partnership' && editableContact.partnerDetails && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-base-700 border border-base-600 rounded-lg text-sm text-text-secondary">
                <input type="checkbox" checked={editableContact.partnerDetails.contractSigned} onChange={e => handlePartnerDetailChange('contractSigned', e.target.checked)} className="accent-partner" />
                Contract Signed
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-base-700 border border-base-600 rounded-lg text-sm text-text-secondary">
                <input type="checkbox" checked={editableContact.partnerDetails.continueFollowUp} onChange={e => handlePartnerDetailChange('continueFollowUp', e.target.checked)} className="accent-partner" />
                Continue Follow-ups
              </label>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-text-primary mb-2">Deliverables</h5>
              <div className="space-y-2">
                <div className="p-3 bg-base-700 border border-base-600 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary font-medium">Drill Videos</span>
                    <span className="text-xs font-mono text-text-muted">
                      {(editableContact.partnerDetails.drillVideoLinks || []).filter(v => v.deliveredAt).length}
                      {' / '}
                      {(editableContact.partnerDetails.drillVideoLinks || []).length} delivered
                    </span>
                  </div>

                  {/* Per-video rows */}
                  {(editableContact.partnerDetails.drillVideoLinks || []).map((video, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5 p-2 bg-base-600 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted font-mono w-5 flex-shrink-0">#{idx + 1}</span>
                        <input
                          type="url"
                          value={video.url}
                          onChange={e => updateDrillVideo(idx, { ...video, url: e.target.value })}
                          placeholder="Video URL…"
                          className="flex-1 bg-base-700 border border-base-500 rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-partner/50"
                        />
                        <button
                          onClick={() => removeDrillVideo(idx)}
                          className="text-text-muted hover:text-red-400 transition-colors text-sm flex-shrink-0"
                          title="Remove video"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <input
                          type="text"
                          value={video.title || ''}
                          onChange={e => updateDrillVideo(idx, { ...video, title: e.target.value })}
                          placeholder="Title (optional)…"
                          className="flex-1 bg-base-700 border border-base-500 rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-partner/50"
                        />
                        <label className="text-xs text-text-muted flex-shrink-0">Delivered:</label>
                        <input
                          type="date"
                          value={video.deliveredAt ? video.deliveredAt.split('T')[0] : ''}
                          onChange={e => updateDrillVideo(idx, { ...video, deliveredAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                          className={`bg-base-700 border rounded px-1.5 py-0.5 text-xs font-mono text-text-primary outline-none focus:border-partner/50 transition-colors ${video.deliveredAt ? 'border-partner/40 text-partner-light' : 'border-base-500'}`}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addDrillVideo}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-text-muted hover:text-text-secondary bg-base-600 hover:bg-base-500 rounded-lg border border-dashed border-base-500 hover:border-base-400 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Drill Video
                  </button>

                  {/* Progress bar */}
                  {(editableContact.partnerDetails.drillVideoLinks || []).length > 0 && (
                    <div className="h-1.5 bg-base-600 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(
                            ((editableContact.partnerDetails.drillVideoLinks || []).filter(v => v.deliveredAt).length /
                            (editableContact.partnerDetails.drillVideoLinks || []).length) * 100
                          ))}%`,
                          background: (editableContact.partnerDetails.drillVideoLinks || []).filter(v => v.deliveredAt).length >= (editableContact.partnerDetails.drillVideoLinks || []).length ? '#10B981' : '#F59E0B',
                        }}
                      />
                    </div>
                  )}
                </div>
                <DeliverableRow
                  label="Testimonial Video"
                  agreed={editableContact.partnerDetails.testimonialVideoAgreed}
                  delivered={editableContact.partnerDetails.testimonialVideoDelivered}
                  onAgreedChange={v => handlePartnerDetailChange('testimonialVideoAgreed', v)}
                  onDeliveredChange={v => handlePartnerDetailChange('testimonialVideoDelivered', v)}
                  dueDate={editableContact.partnerDetails.testimonialDueDate}
                  onDueDateChange={v => handlePartnerDetailChange('testimonialDueDate', v)}
                />
                <DeliverableRow
                  label="Website Link"
                  agreed={editableContact.partnerDetails.websiteLinkAgreed}
                  delivered={editableContact.partnerDetails.websiteLinkDelivered}
                  onAgreedChange={v => handlePartnerDetailChange('websiteLinkAgreed', v)}
                  onDeliveredChange={v => handlePartnerDetailChange('websiteLinkDelivered', v)}
                  dueDate={editableContact.partnerDetails.websiteLinkDueDate}
                  onDueDateChange={v => handlePartnerDetailChange('websiteLinkDueDate', v)}
                />
                <DeliverableRow
                  label="Social Post"
                  agreed={editableContact.partnerDetails.socialPostAgreed}
                  delivered={editableContact.partnerDetails.socialPostDelivered}
                  onAgreedChange={v => handlePartnerDetailChange('socialPostAgreed', v)}
                  onDeliveredChange={v => handlePartnerDetailChange('socialPostDelivered', v)}
                  dueDate={editableContact.partnerDetails.socialPostDueDate}
                  onDueDateChange={v => handlePartnerDetailChange('socialPostDueDate', v)}
                />
              </div>
            </div>

            <div>
              <h5 className="text-sm font-semibold text-text-primary mb-2">Deliverable Links</h5>
              <div className="space-y-2">
                {[
                  { field: 'testimonialVideoLink' as const, placeholder: 'Testimonial Video URL' },
                  { field: 'websiteLinkUrl' as const, placeholder: 'Website Link URL' },
                  { field: 'socialPostLink' as const, placeholder: 'Social Post URL' },
                ].map(({ field, placeholder }) => (
                  <input
                    key={field}
                    type="url"
                    value={editableContact.partnerDetails![field]}
                    onChange={e => handlePartnerDetailChange(field, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-partner/50"
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-600 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-text-primary">Contact Details</h2>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary transition-colors p-1">
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          {renderLeftColumn()}
          {renderRightColumn()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-base-700 border-t border-base-600 flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
          <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-text-secondary bg-base-600 hover:bg-base-500 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="px-4 py-2 text-sm font-medium text-white bg-outreach hover:bg-outreach-light rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
