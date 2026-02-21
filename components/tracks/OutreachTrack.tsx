
import React, { useState, useMemo } from 'react';
import { Contact, EmailDraft, OutreachBucket, calculateHealthScore, getHealthLevel, daysSince, ContactSequence, Sequence } from '../../types';
import { PriorityBanner } from './PriorityBanner';

interface OutreachTrackProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
  onBatchOutreach?: (contacts: Contact[]) => void;
  contactEnrollments?: ContactSequence[];
  sequences?: Sequence[];
}

const BUCKETS: { id: OutreachBucket; label: string; stage: string; color: string; description: string }[] = [
  { id: 'to_contact', label: 'To Contact', stage: 'To Reach Out', color: '#6366F1', description: 'Not yet reached out' },
  { id: 'awaiting_response', label: 'Awaiting Response', stage: 'Contacted', color: '#8B5CF6', description: 'Email sent, no reply yet' },
  { id: 'in_conversation', label: 'In Conversation', stage: 'Responded', color: '#10B981', description: 'Actively corresponding' },
  { id: 'meeting_booked', label: 'Meeting Booked', stage: 'Meeting Booked', color: '#F59E0B', description: 'Call or meeting scheduled' },
  { id: 'on_hold', label: 'On Hold', stage: 'On Hold', color: '#6B7280', description: 'Paused for now' },
  { id: 'closed', label: 'Closed', stage: 'Closed - Unsuccessful', color: '#374151', description: 'No outcome, no follow-up' },
];

const ContactTypeTag: React.FC<{ type?: string }> = ({ type }) => {
  const labels: Record<string, { label: string; color: string }> = {
    instructor: { label: 'Instructor', color: '#6366F1' },
    media: { label: 'Media', color: '#F59E0B' },
    other: { label: 'Other', color: '#6B7280' },
  };
  const config = labels[type || 'instructor'] || labels.instructor;
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${config.color}18`, color: config.color }}
    >
      {config.label}
    </span>
  );
};

const HealthDot: React.FC<{ score: number }> = ({ score }) => {
  const level = getHealthLevel(score);
  const colors = { warm: '#10B981', cooling: '#F59E0B', cold: '#EF4444' };
  const titles = { warm: 'Warm relationship', cooling: 'Cooling — needs attention', cold: 'Cold — overdue' };
  return (
    <span
      title={titles[level]}
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: colors[level] }}
    />
  );
};

const ContactCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (c: Contact) => void;
  hasActiveSequence?: boolean;
}> = ({ contact, onContactClick, onComposeEmail, selectionMode, isSelected, onToggleSelect, hasActiveSequence }) => {
  const score = calculateHealthScore(contact);
  const daysAgo = daysSince(contact.lastContacted);

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect?.(contact);
    } else {
      onContactClick(contact);
    }
  };

  return (
    <div
      className={`card-elevated cursor-pointer p-4 flex flex-col gap-3 transition-all ${
        selectionMode
          ? isSelected
            ? 'border-outreach/60 ring-1 ring-outreach/40 bg-outreach/5'
            : 'hover:border-base-500'
          : 'card-hover'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <img src={contact.avatarUrl} alt={contact.name} className="w-9 h-9 rounded-full object-cover" />
          {selectionMode && (
            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected ? 'bg-outreach border-outreach' : 'bg-base-800 border-base-500'
            }`}>
              {isSelected && (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary truncate">{contact.name}</span>
            <HealthDot score={score} />
            {hasActiveSequence && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                style={{ background: '#7C3AED22', color: '#8B5CF6' }}
                title="Active sequence"
              >
                SEQ
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <ContactTypeTag type={contact.contactType} />
            {contact.location && (
              <span className="text-xs text-text-muted">{contact.location}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs">
        {contact.followers ? (
          <div>
            <span className="font-mono font-medium text-text-primary">{contact.followers.toLocaleString()}</span>
            <span className="text-text-muted ml-1">followers</span>
          </div>
        ) : null}
        {contact.instagramHandle && (
          <span className="text-text-muted">{contact.instagramHandle}</span>
        )}
        <span className="text-text-muted ml-auto">{daysAgo === 0 ? 'today' : daysAgo === 9999 ? 'never' : `${daysAgo}d ago`}</span>
      </div>

      {/* Action — hidden in selection mode */}
      {!selectionMode && (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-outreach-light hover:text-white bg-outreach-dim hover:bg-outreach/25 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Draft Email
          </button>
          <button
            onClick={() => onContactClick(contact)}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
          >
            View
          </button>
        </div>
      )}
    </div>
  );
};

export const OutreachTrack: React.FC<OutreachTrackProps> = ({ contacts, onContactClick, onComposeEmail, onBatchOutreach, contactEnrollments = [], sequences = [] }) => {
  const [activeBucket, setActiveBucket] = useState<OutreachBucket>('in_conversation');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (contact: Contact) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(contact.id)) next.delete(contact.id);
      else next.add(contact.id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDraft = () => {
    const selected = bucketContacts.filter(c => selectedIds.has(c.id));
    if (selected.length > 0 && onBatchOutreach) {
      onBatchOutreach(selected);
      exitSelectionMode();
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(bucketContacts.map(c => c.id)));
  };

  // Prospective Teachers = instructors not yet in the product track
  const outreachContacts = useMemo(() =>
    contacts.filter(c =>
      c.contactType === 'instructor' &&
      !c.partnershipType &&
      c.pipelineStage !== 'Sent Product; Awaiting Feedback' &&
      !c.stopFollowUp
    ),
    [contacts]
  );

  // Warm leads: actively engaged instructors (needs attention NOW)
  const warmLeads = useMemo(() =>
    outreachContacts.filter(c =>
      c.pipelineStage === 'Responded' || c.pipelineStage === 'Meeting Booked'
    ).sort((a, b) => {
      // Meeting Booked first, then by last contacted
      if (a.pipelineStage === 'Meeting Booked' && b.pipelineStage !== 'Meeting Booked') return -1;
      if (b.pipelineStage === 'Meeting Booked' && a.pipelineStage !== 'Meeting Booked') return 1;
      return new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime();
    }),
    [outreachContacts]
  );

  const bucketContacts = useMemo(() => {
    const bucket = BUCKETS.find(b => b.id === activeBucket);
    if (!bucket) return [];
    return outreachContacts
      .filter(c => c.pipelineStage === bucket.stage)
      .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.email.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => (b.followers || 0) - (a.followers || 0));
  }, [outreachContacts, activeBucket, searchQuery]);

  const getBucketCount = (bucket: typeof BUCKETS[0]) =>
    outreachContacts.filter(c => c.pipelineStage === bucket.stage).length;

  const activeBucketConfig = BUCKETS.find(b => b.id === activeBucket)!;

  return (
    <div className="flex flex-col h-full relative">
      {/* Track Header */}
      <div className="px-6 py-5 border-b border-base-600" style={{ borderLeft: '3px solid #6366F1' }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-text-primary">Prospective Teachers</h1>
          <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-full bg-outreach-dim text-outreach-light">
            {outreachContacts.length}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-base-700 text-text-muted border border-base-600">Instructors only</span>
          <div className="ml-auto flex items-center gap-2">
            {selectionMode ? (
              <>
                <button
                  onClick={selectAll}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Select all ({bucketContacts.length})
                </button>
                <button
                  onClick={exitSelectionMode}
                  className="text-xs px-3 py-1.5 bg-base-700 hover:bg-base-600 text-text-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              onBatchOutreach && (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg transition-colors border border-base-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Batch Outreach
                </button>
              )
            )}
          </div>
        </div>
        <p className="text-sm text-text-muted">Golf instructors you're building a relationship with — manage and nurture your pipeline</p>
      </div>

      {/* Warm Leads Section — shown when there are active leads */}
      {warmLeads.length > 0 && (
        <div className="px-6 py-3 bg-amber-950/30 border-b border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">🔥 Warm Leads — Need Attention</span>
            <span className="text-xs font-mono text-amber-500/70">{warmLeads.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {warmLeads.map(c => {
              const score = calculateHealthScore(c);
              const level = getHealthLevel(score);
              const colors = { warm: '#10B981', cooling: '#F59E0B', cold: '#EF4444' };
              const dayCount = daysSince(c.lastContacted);
              return (
                <button
                  key={c.id}
                  onClick={() => onContactClick(c)}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-base-800 hover:bg-base-700 border border-amber-500/20 hover:border-amber-500/40 rounded-lg transition-all text-left"
                >
                  <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[level] }} />
                  <div>
                    <div className="text-xs font-semibold text-text-primary whitespace-nowrap">{c.name}</div>
                    <div className="text-xs text-text-muted whitespace-nowrap">
                      {c.pipelineStage === 'Meeting Booked' ? '📅 Meeting' : '💬 Responded'} · {dayCount === 9999 ? 'never' : `${dayCount}d ago`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority Banner */}
      <PriorityBanner
        contacts={outreachContacts}
        contactEnrollments={contactEnrollments}
        sequences={sequences}
        onContactClick={onContactClick}
      />

      {/* Sub-bucket Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-base-600 overflow-x-auto">
        {BUCKETS.map(bucket => {
          const count = getBucketCount(bucket);
          const isActive = activeBucket === bucket.id;
          return (
            <button
              key={bucket.id}
              onClick={() => setActiveBucket(bucket.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-text-muted hover:text-text-secondary hover:bg-base-700'
              }`}
              style={isActive ? { background: `${bucket.color}22`, color: bucket.color, border: `1px solid ${bucket.color}40` } : {}}
            >
              {bucket.label}
              {count > 0 && (
                <span
                  className="font-mono text-xs"
                  style={isActive ? { color: bucket.color } : { color: '#6B7280' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Info bar */}
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        <div className="relative flex-1 max-w-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-base-700 border border-base-600 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
          />
        </div>
        <p className="text-xs text-text-muted flex-shrink-0">{activeBucketConfig.description} · {bucketContacts.length} shown</p>
      </div>

      {/* Contact Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {bucketContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-base-700 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-text-muted text-sm">No contacts in {activeBucketConfig.label}</p>
            {activeBucket === 'to_contact' && (
              <p className="text-text-muted text-xs mt-1">Import contacts to get started</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bucketContacts.map(contact => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onContactClick={onContactClick}
                onComposeEmail={onComposeEmail}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(contact.id)}
                onToggleSelect={toggleSelect}
                hasActiveSequence={contactEnrollments.some(e => e.contactId === contact.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating batch action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 bg-base-800 border border-outreach/40 rounded-2xl shadow-2xl z-20">
          <span className="text-sm font-medium text-text-primary">
            {selectedIds.size} contact{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <div className="w-px h-4 bg-base-600" />
          <button
            onClick={handleBatchDraft}
            className="flex items-center gap-2 px-4 py-1.5 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Draft Batch Emails
          </button>
        </div>
      )}
    </div>
  );
};
