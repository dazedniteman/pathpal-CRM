
import React, { useState, useMemo } from 'react';
import { Contact, EmailDraft, PartnershipType, Sequence, ContactSequence, calculateHealthScore, getHealthLevel, daysSince, daysSinceContact } from '../../types';
import { PriorityBanner } from './PriorityBanner';

interface PeopleWithProductTrackProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
  contactEnrollments?: ContactSequence[];
  sequences?: Sequence[];
}

type ProductTab = 'awaiting' | 'free' | 'purchased';

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

const FanStars: React.FC<{ score?: number }> = ({ score }) => {
  if (!score) return null;
  const labels = ['','Neutral','Warm','Enjoys it','Big fan','Raving fan'];
  return (
    <div className="flex items-center gap-0.5" title={labels[score]}>
      {[1,2,3,4,5].map(s => (
        <svg key={s} xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24"
          fill={s <= score ? '#F59E0B' : 'none'}
          stroke={s <= score ? '#F59E0B' : '#4A4D5E'}
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
};

const DeliverableBar: React.FC<{ agreed: number; delivered: number; label: string }> = ({ agreed, delivered, label }) => {
  if (agreed === 0) return null;
  const pct = Math.round((delivered / agreed) * 100);
  const isComplete = delivered >= agreed;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className={`font-mono font-medium ${isComplete ? 'text-partner-light' : 'text-sold-light'}`}>
          {delivered}/{agreed}
        </span>
      </div>
      <div className="h-1.5 bg-base-600 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: isComplete ? '#10B981' : '#F59E0B' }}
        />
      </div>
    </div>
  );
};

const hasOutstandingDeliverables = (c: Contact): boolean => {
  const pd = c.partnerDetails;
  if (!pd) return false;
  return (
    pd.drillVideosAgreed > pd.drillVideosDelivered ||
    (pd.testimonialVideoAgreed && !pd.testimonialVideoDelivered) ||
    (pd.socialPostAgreed && !pd.socialPostDelivered) ||
    (pd.websiteLinkAgreed && !pd.websiteLinkDelivered)
  );
};

const FreeCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}> = ({ contact, onContactClick, onComposeEmail }) => {
  const score = calculateHealthScore(contact);
  const daysAgo = daysSinceContact(contact);
  const pd = contact.partnerDetails;
  const outstanding = hasOutstandingDeliverables(contact);

  return (
    <div
      className={`card-elevated card-hover cursor-pointer p-4 flex flex-col gap-3 ${outstanding ? 'ring-1 ring-sold/30' : ''}`}
      onClick={() => onContactClick(contact)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <img src={contact.avatarUrl} alt={contact.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-text-primary">{contact.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted">{contact.location || 'No location'}</span>
              {outstanding && (
                <span className="text-xs font-semibold text-sold-light px-1.5 py-0.5 bg-sold-dim rounded">owes deliverables</span>
              )}
            </div>
          </div>
        </div>
        <HealthDot score={score} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">Last contact: <span className="font-mono text-text-secondary">{daysAgo === 9999 ? 'Never' : `${daysAgo}d ago`}</span></span>
        <FanStars score={contact.fanScore} />
      </div>

      {pd && (
        <div className="space-y-2">
          <DeliverableBar agreed={pd.drillVideosAgreed} delivered={pd.drillVideosDelivered} label="Drill Videos" />
          {pd.testimonialVideoAgreed && (
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Testimonial</span>
              <span className={`font-medium ${pd.testimonialVideoDelivered ? 'text-partner-light' : 'text-sold-light'}`}>
                {pd.testimonialVideoDelivered ? '✓ Done' : 'Pending'}
              </span>
            </div>
          )}
          {pd.socialPostAgreed && (
            <div className="flex justify-between text-xs">
              <span className="text-text-muted">Social Post</span>
              <span className={`font-medium ${pd.socialPostDelivered ? 'text-partner-light' : 'text-sold-light'}`}>
                {pd.socialPostDelivered ? '✓ Done' : 'Pending'}
              </span>
            </div>
          )}
        </div>
      )}

      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-partner-light hover:text-white bg-partner-dim hover:bg-partner/25 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          {outstanding ? '⚡ Follow Up (deliverables owed)' : 'Draft Check-in Email'}
        </button>
      </div>
    </div>
  );
};

const PurchasedCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}> = ({ contact, onContactClick, onComposeEmail }) => {
  const score = calculateHealthScore(contact);
  const daysAgo = daysSinceContact(contact);
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
            <div className="text-xs text-text-muted mt-0.5">{contact.location || 'No location'}</div>
          </div>
        </div>
        <HealthDot score={score} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">Last contact: <span className="font-mono text-text-secondary">{daysAgo === 9999 ? 'Never' : `${daysAgo}d ago`}</span></span>
        <FanStars score={contact.fanScore} />
      </div>
      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-sold-light hover:text-white bg-sold-dim hover:bg-sold/25 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Draft Follow-up Email
        </button>
      </div>
    </div>
  );
};

const AwaitingCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}> = ({ contact, onContactClick, onComposeEmail }) => {
  const daysAgo = daysSinceContact(contact);
  return (
    <div
      className="card-elevated card-hover cursor-pointer p-4 flex flex-col gap-3"
      onClick={() => onContactClick(contact)}
    >
      <div className="flex items-start gap-3">
        <img src={contact.avatarUrl} alt={contact.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text-primary">{contact.name}</div>
          <div className="text-xs text-text-muted mt-0.5">{contact.location || 'No location'}</div>
          <div className="text-xs text-amber-400/80 mt-1">⏳ Awaiting feedback — {daysAgo === 9999 ? 'never contacted' : `${daysAgo}d since last contact`}</div>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/40 rounded-lg transition-colors border border-amber-500/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Follow Up for Feedback
        </button>
      </div>
    </div>
  );
};

export const PeopleWithProductTrack: React.FC<PeopleWithProductTrackProps> = ({ contacts, onContactClick, onComposeEmail, contactEnrollments = [], sequences = [] }) => {
  const [activeTab, setActiveTab] = useState<ProductTab>('free');
  const [searchQuery, setSearchQuery] = useState('');

  // Everyone with product: free recipients, purchasers, or awaiting feedback stage
  const freeRecipients = useMemo(() =>
    contacts.filter(c => c.partnershipType === PartnershipType.PARTNER && c.pipelineStage !== 'Sent Product; Awaiting Feedback')
      .sort((a, b) => {
        // Outstanding deliverables first
        const aOwes = hasOutstandingDeliverables(a) ? 1 : 0;
        const bOwes = hasOutstandingDeliverables(b) ? 1 : 0;
        if (bOwes !== aOwes) return bOwes - aOwes;
        // Then by health score ascending (worse relationship = needs attention)
        return calculateHealthScore(a) - calculateHealthScore(b);
      }),
    [contacts]
  );

  const purchasers = useMemo(() =>
    contacts.filter(c => c.partnershipType === PartnershipType.SALE && c.pipelineStage !== 'Sent Product; Awaiting Feedback')
      .sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b)),
    [contacts]
  );

  // Anyone in the awaiting stage, regardless of partnershipType
  const awaitingFeedback = useMemo(() =>
    contacts.filter(c => c.pipelineStage === 'Sent Product; Awaiting Feedback')
      .sort((a, b) => new Date(a.lastContacted).getTime() - new Date(b.lastContacted).getTime()),
    [contacts]
  );

  const totalCount = freeRecipients.length + purchasers.length + awaitingFeedback.length;

  const freeFiltered = useMemo(() =>
    freeRecipients.filter(c => !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [freeRecipients, searchQuery]
  );

  const purchasersFiltered = useMemo(() =>
    purchasers.filter(c => !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [purchasers, searchQuery]
  );

  // Aggregate stats
  const drillStats = useMemo(() => freeRecipients.reduce((acc, c) => {
    const pd = c.partnerDetails;
    if (!pd) return acc;
    acc.agreed += pd.drillVideosAgreed;
    acc.delivered += pd.drillVideosDelivered;
    return acc;
  }, { agreed: 0, delivered: 0 }), [freeRecipients]);

  const outstandingDeliverableCount = useMemo(() =>
    freeRecipients.filter(hasOutstandingDeliverables).length,
    [freeRecipients]
  );

  const allProductContacts = useMemo(() =>
    [...freeRecipients, ...purchasers, ...awaitingFeedback],
    [freeRecipients, purchasers, awaitingFeedback]
  );

  const tabs: { id: ProductTab; label: string; count: number; color: string }[] = [
    { id: 'awaiting', label: 'Sent Product; Awaiting Feedback', count: awaitingFeedback.length, color: '#F59E0B' },
    { id: 'free', label: 'Received for Free', count: freeRecipients.length, color: '#10B981' },
    { id: 'purchased', label: 'Purchased', count: purchasers.length, color: '#6366F1' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Track Header */}
      <div className="px-6 py-5 border-b border-base-600" style={{ borderLeft: '3px solid #10B981' }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-text-primary">People with the Product</h1>
          <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-full bg-partner-dim text-partner-light">
            {totalCount}
          </span>
          {outstandingDeliverableCount > 0 && (
            <span className="text-xs font-semibold text-sold-light px-2 py-0.5 bg-sold-dim rounded-full">
              ⚡ {outstandingDeliverableCount} owe deliverables
            </span>
          )}
        </div>
        <p className="text-sm text-text-muted">Everyone who has your product — track deliverables, feedback, and relationships</p>

        {/* Drill video aggregate stats */}
        {drillStats.agreed > 0 && (
          <div className="flex items-center gap-6 mt-3">
            <div className="text-sm">
              <span className="font-mono font-semibold text-text-primary">{drillStats.delivered}</span>
              <span className="text-text-muted ml-1">/ {drillStats.agreed} drill videos received</span>
            </div>
            {drillStats.delivered < drillStats.agreed && (
              <div className="text-sm">
                <span className="font-mono font-semibold text-sold-light">{drillStats.agreed - drillStats.delivered}</span>
                <span className="text-text-muted ml-1">still owed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Priority Banner */}
      <PriorityBanner
        contacts={allProductContacts}
        contactEnrollments={contactEnrollments}
        sequences={sequences}
        onContactClick={onContactClick}
      />

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-base-600 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-text-muted hover:text-text-secondary hover:bg-base-700'
            }`}
            style={activeTab === tab.id ? { background: `${tab.color}22`, color: tab.color, border: `1px solid ${tab.color}40` } : {}}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="font-mono text-xs" style={activeTab === tab.id ? { color: tab.color } : { color: '#6B7280' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab !== 'awaiting' && (
        <div className="px-6 py-3">
          <div className="relative max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-base-700 border border-base-600 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary outline-none focus:border-partner transition-colors"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === 'awaiting' && (
          <>
            {awaitingFeedback.length === 0 ? (
              <EmptyState message="No contacts waiting for feedback" />
            ) : (
              <>
                <p className="text-xs text-amber-400/70 mt-2 mb-4">
                  These contacts have been sent the product but haven't been classified yet. Follow up to get their feedback and decide if they're a partner or customer.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {awaitingFeedback.map(c => (
                    <AwaitingCard key={c.id} contact={c} onContactClick={onContactClick} onComposeEmail={onComposeEmail} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
        {activeTab === 'free' && (
          <>
            {outstandingDeliverableCount > 0 && (
              <div className="flex items-center gap-2 mt-2 mb-4 px-3 py-2 bg-sold-dim border border-sold/20 rounded-lg">
                <span className="text-sold-light text-xs font-semibold">⚡ {outstandingDeliverableCount} partner{outstandingDeliverableCount !== 1 ? 's' : ''} owe deliverables</span>
                <span className="text-text-muted text-xs">— sorted to the top</span>
              </div>
            )}
            {freeFiltered.length === 0 ? (
              <EmptyState message="No partners who received free product" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {freeFiltered.map(c => (
                  <FreeCard key={c.id} contact={c} onContactClick={onContactClick} onComposeEmail={onComposeEmail} />
                ))}
              </div>
            )}
          </>
        )}
        {activeTab === 'purchased' && (
          <>
            {purchasersFiltered.length === 0 ? (
              <EmptyState message="No customers who purchased" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {purchasersFiltered.map(c => (
                  <PurchasedCard key={c.id} contact={c} onContactClick={onContactClick} onComposeEmail={onComposeEmail} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-14 h-14 rounded-full bg-base-700 flex items-center justify-center mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    </div>
    <p className="text-text-muted text-sm">{message}</p>
  </div>
);
