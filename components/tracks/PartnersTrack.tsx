
import React, { useState, useMemo } from 'react';
import { Contact, EmailDraft, PartnershipType, calculateHealthScore, getHealthLevel, daysSince } from '../../types';

interface PartnersTrackProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}

type PartnerTab = 'all' | 'deliverables';

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
          style={{
            width: `${pct}%`,
            background: isComplete ? '#10B981' : '#F59E0B',
          }}
        />
      </div>
    </div>
  );
};

const PartnerCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}> = ({ contact, onContactClick, onComposeEmail }) => {
  const score = calculateHealthScore(contact);
  const daysAgo = daysSince(contact.lastContacted);
  const pd = contact.partnerDetails;

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

      {/* Days since contact */}
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Last contact: <span className="font-mono text-text-secondary">{daysAgo === 9999 ? 'Never' : `${daysAgo}d ago`}</span></span>
      </div>

      {/* Deliverable progress */}
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

      {/* Action */}
      <div onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-partner-light hover:text-white bg-partner-dim hover:bg-partner/25 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Draft Check-in Email
        </button>
      </div>
    </div>
  );
};

export const PartnersTrack: React.FC<PartnersTrackProps> = ({ contacts, onContactClick, onComposeEmail }) => {
  const [activeTab, setActiveTab] = useState<PartnerTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const partners = useMemo(() =>
    contacts.filter(c =>
      c.pipelineStage === 'Closed - Success' && c.partnershipType === PartnershipType.PARTNER
    ),
    [contacts]
  );

  const filteredPartners = useMemo(() =>
    partners.filter(c => !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b)),
    [partners, searchQuery]
  );

  // Aggregate deliverable stats
  const stats = useMemo(() => partners.reduce((acc, p) => {
    const pd = p.partnerDetails;
    if (!pd) return acc;
    acc.drillsTotal += pd.drillVideosAgreed;
    acc.drillsDone += pd.drillVideosDelivered;
    if (pd.testimonialVideoAgreed && !pd.testimonialVideoDelivered) acc.testimonialsOwed++;
    if (pd.socialPostAgreed && !pd.socialPostDelivered) acc.postsOwed++;
    return acc;
  }, { drillsTotal: 0, drillsDone: 0, testimonialsOwed: 0, postsOwed: 0 }), [partners]);

  // Partners with outstanding deliverables
  const withOutstanding = useMemo(() =>
    partners.filter(p => {
      const pd = p.partnerDetails;
      if (!pd) return false;
      return (pd.drillVideosAgreed > pd.drillVideosDelivered) ||
             (pd.testimonialVideoAgreed && !pd.testimonialVideoDelivered) ||
             (pd.socialPostAgreed && !pd.socialPostDelivered);
    }),
    [partners]
  );

  const displayedContacts = activeTab === 'deliverables' ? withOutstanding : filteredPartners;

  return (
    <div className="flex flex-col h-full">
      {/* Track Header */}
      <div className="px-6 py-5 border-b border-base-600" style={{ borderLeft: '3px solid #10B981' }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-text-primary">Active Partners</h1>
          <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-full bg-partner-dim text-partner-light">
            {partners.length}
          </span>
        </div>
        <p className="text-sm text-text-muted">Partners who have delivered value — maintain relationships and track deliverables</p>

        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-4">
          {stats.drillsTotal > 0 && (
            <div className="text-sm">
              <span className="font-mono font-semibold text-text-primary">{stats.drillsDone}/{stats.drillsTotal}</span>
              <span className="text-text-muted ml-1.5">drill videos</span>
            </div>
          )}
          {stats.testimonialsOwed > 0 && (
            <div className="text-sm">
              <span className="font-mono font-semibold text-sold-light">{stats.testimonialsOwed}</span>
              <span className="text-text-muted ml-1.5">testimonials owed</span>
            </div>
          )}
          {stats.postsOwed > 0 && (
            <div className="text-sm">
              <span className="font-mono font-semibold text-sold-light">{stats.postsOwed}</span>
              <span className="text-text-muted ml-1.5">posts owed</span>
            </div>
          )}
          {stats.drillsTotal === 0 && stats.testimonialsOwed === 0 && stats.postsOwed === 0 && (
            <div className="text-sm text-partner-light">✓ All deliverables up to date</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-base-600">
        {([
          { id: 'all', label: 'All Partners', count: partners.length },
          { id: 'deliverables', label: 'Deliverables Due', count: withOutstanding.length },
        ] as { id: PartnerTab; label: string; count: number }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-partner-dim text-partner-light border border-partner/30'
                : 'text-text-muted hover:text-text-secondary hover:bg-base-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`font-mono ${activeTab === tab.id ? 'text-partner-light' : 'text-text-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {activeTab === 'all' && (
        <div className="px-6 py-3">
          <div className="relative max-w-xs">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search partners..."
              className="w-full bg-base-700 border border-base-600 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary outline-none focus:border-partner transition-colors"
            />
          </div>
        </div>
      )}

      {/* Partner Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {displayedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-base-700 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <p className="text-text-muted text-sm">
              {activeTab === 'deliverables' ? 'No outstanding deliverables 🎉' : 'No active partners yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {displayedContacts.map(contact => (
              <PartnerCard
                key={contact.id}
                contact={contact}
                onContactClick={onContactClick}
                onComposeEmail={onComposeEmail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
