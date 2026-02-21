
import React, { useState, useMemo } from 'react';
import { Contact, EmailDraft, Sequence, ContactSequence, calculateHealthScore, getHealthLevel, daysSince } from '../../types';
import { PriorityBanner } from './PriorityBanner';

interface OtherTrackProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
  contactEnrollments?: ContactSequence[];
  sequences?: Sequence[];
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  instructor: 'Instructor',
  media: 'Media',
  customer: 'Customer',
  other: 'Other',
};

const CONTACT_TYPE_COLORS: Record<string, string> = {
  instructor: '#6366F1',
  media: '#F59E0B',
  customer: '#10B981',
  other: '#6B7280',
};

const HealthDot: React.FC<{ score: number }> = ({ score }) => {
  const level = getHealthLevel(score);
  const colors = { warm: '#10B981', cooling: '#F59E0B', cold: '#EF4444' };
  const labels = { warm: 'Warm', cooling: 'Cooling', cold: 'Cold' };
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: colors[level] }} />
      <span className="text-xs" style={{ color: colors[level] }}>{labels[level]}</span>
    </div>
  );
};

const OtherCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}> = ({ contact, onContactClick, onComposeEmail }) => {
  const score = calculateHealthScore(contact);
  const daysAgo = daysSince(contact.lastContacted);
  const typeLabel = CONTACT_TYPE_LABELS[contact.contactType || 'other'] || 'Other';
  const typeColor = CONTACT_TYPE_COLORS[contact.contactType || 'other'] || '#6B7280';

  return (
    <div
      className="card-elevated card-hover cursor-pointer p-4 flex flex-col gap-3"
      onClick={() => onContactClick(contact)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <img src={contact.avatarUrl} alt={contact.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-text-primary">{contact.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: `${typeColor}22`, color: typeColor }}
              >
                {typeLabel}
              </span>
              {contact.location && <span className="text-xs text-text-muted">{contact.location}</span>}
            </div>
          </div>
        </div>
        <HealthDot score={score} />
      </div>

      {contact.email && (
        <div className="text-xs text-text-muted truncate">{contact.email}</div>
      )}

      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span>Last contact: <span className="font-mono text-text-secondary">{daysAgo === 9999 ? 'Never' : `${daysAgo}d ago`}</span></span>
        <span className="ml-auto">{contact.pipelineStage}</span>
      </div>

      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-300 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors border border-gray-700/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Draft Email
        </button>
      </div>
    </div>
  );
};

export const OtherTrack: React.FC<OtherTrackProps> = ({ contacts, onContactClick, onComposeEmail, contactEnrollments = [], sequences = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  // Other = non-instructors who don't have the product
  const otherContacts = useMemo(() =>
    contacts.filter(c =>
      c.contactType !== 'instructor' &&
      !c.partnershipType &&
      c.pipelineStage !== 'Sent Product; Awaiting Feedback' &&
      !c.stopFollowUp
    ).sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b)),
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    let list = otherContacts;
    if (filterType !== 'all') {
      list = list.filter(c => (c.contactType || 'other') === filterType);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [otherContacts, filterType, searchQuery]);

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: otherContacts.length };
    for (const c of otherContacts) {
      const t = c.contactType || 'other';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [otherContacts]);

  return (
    <div className="flex flex-col h-full">
      {/* Track Header */}
      <div className="px-6 py-5 border-b border-base-600" style={{ borderLeft: '3px solid #6B7280' }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-text-primary">Other Contacts</h1>
          <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-full bg-base-700 text-text-secondary">
            {otherContacts.length}
          </span>
        </div>
        <p className="text-sm text-text-muted">Media contacts, customers, and others you're keeping track of</p>
      </div>

      {/* Priority Banner */}
      <PriorityBanner
        contacts={otherContacts}
        contactEnrollments={contactEnrollments}
        sequences={sequences}
        onContactClick={onContactClick}
      />

      {/* Type filter chips */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-base-600 overflow-x-auto">
        {[
          { id: 'all', label: 'All' },
          { id: 'media', label: 'Media' },
          { id: 'customer', label: 'Customer' },
          { id: 'other', label: 'Other' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filterType === f.id
                ? 'bg-base-600 text-text-primary border border-base-500'
                : 'text-text-muted hover:text-text-secondary hover:bg-base-700'
            }`}
          >
            {f.label}
            {typeCounts[f.id] > 0 && (
              <span className="font-mono text-xs text-text-muted">{typeCounts[f.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative max-w-xs">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-base-700 border border-base-600 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary outline-none transition-colors"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-base-700 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-text-muted text-sm">No contacts here yet</p>
            <p className="text-text-muted text-xs mt-1">Contacts with type Media, Customer, or Other will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map(c => (
              <OtherCard key={c.id} contact={c} onContactClick={onContactClick} onComposeEmail={onComposeEmail} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
