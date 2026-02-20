
import React, { useState, useMemo } from 'react';
import { Contact, EmailDraft, PartnershipType, calculateHealthScore, getHealthLevel, daysSince } from '../../types';

interface CustomersTrackProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}

type CustomerTab = 'all' | 'followup';

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

const CustomerCard: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
}> = ({ contact, onContactClick, onComposeEmail }) => {
  const score = calculateHealthScore(contact);
  const daysAgo = daysSince(contact.lastContacted);
  const typeLabel = contact.contactType === 'media' ? 'Media' : contact.contactType === 'other' ? 'Other' : 'Instructor';

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
              <span className="text-xs text-text-muted">{contact.location || 'No location'}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-base-600 text-text-muted">{typeLabel}</span>
            </div>
          </div>
        </div>
        <HealthDot score={score} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        {contact.followers ? (
          <div className="flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-mono">{contact.followers >= 1000 ? `${(contact.followers / 1000).toFixed(1)}k` : contact.followers}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Last: <span className="font-mono text-text-secondary">{daysAgo === 9999 ? 'Never' : `${daysAgo}d ago`}</span></span>
        </div>
      </div>

      {/* Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {contact.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-sold-dim text-sold-light font-medium">{tag}</span>
          ))}
          {contact.tags.length > 3 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-base-600 text-text-muted">+{contact.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Notes preview */}
      {(contact.richNotes || contact.notes) && (
        <p className="text-xs text-text-muted line-clamp-2 bg-base-700 rounded-lg px-2.5 py-1.5 italic">
          {(contact.richNotes || contact.notes || '').substring(0, 100)}
          {(contact.richNotes || contact.notes || '').length > 100 ? '…' : ''}
        </p>
      )}

      {/* Action */}
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

export const CustomersTrack: React.FC<CustomersTrackProps> = ({ contacts, onContactClick, onComposeEmail }) => {
  const [activeTab, setActiveTab] = useState<CustomerTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'health' | 'recent' | 'followers'>('health');

  const customers = useMemo(() =>
    contacts.filter(c =>
      c.pipelineStage === 'Closed - Success' && c.partnershipType === PartnershipType.SALE
    ),
    [contacts]
  );

  // Customers who need follow-up (health cooling or cold, or not contacted in >30 days)
  const needingFollowUp = useMemo(() =>
    customers.filter(c => {
      const score = calculateHealthScore(c);
      return score < 70; // cooling or cold
    }),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const base = activeTab === 'followup' ? needingFollowUp : customers;
    const filtered = base.filter(c => !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.location || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      if (sortBy === 'health') return calculateHealthScore(a) - calculateHealthScore(b);
      if (sortBy === 'recent') return daysSince(a.lastContacted) - daysSince(b.lastContacted);
      if (sortBy === 'followers') return (b.followers || 0) - (a.followers || 0);
      return 0;
    });
  }, [customers, needingFollowUp, activeTab, searchQuery, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const warm = customers.filter(c => getHealthLevel(calculateHealthScore(c)) === 'warm').length;
    const cooling = customers.filter(c => getHealthLevel(calculateHealthScore(c)) === 'cooling').length;
    const cold = customers.filter(c => getHealthLevel(calculateHealthScore(c)) === 'cold').length;
    return { warm, cooling, cold };
  }, [customers]);

  return (
    <div className="flex flex-col h-full">
      {/* Track Header */}
      <div className="px-6 py-5 border-b border-base-600" style={{ borderLeft: '3px solid #F59E0B' }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold text-text-primary">Customers</h1>
          <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-full bg-sold-dim text-sold-light">
            {customers.length}
          </span>
        </div>
        <p className="text-sm text-text-muted">Sold contacts — keep relationships warm for referrals and upsells</p>

        {/* Health distribution */}
        <div className="flex items-center gap-6 mt-4">
          {stats.warm > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
              <span className="font-mono font-semibold text-text-primary">{stats.warm}</span>
              <span className="text-text-muted">warm</span>
            </div>
          )}
          {stats.cooling > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-mono font-semibold text-sold-light">{stats.cooling}</span>
              <span className="text-text-muted">cooling</span>
            </div>
          )}
          {stats.cold > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
              <span className="font-mono font-semibold" style={{ color: '#EF4444' }}>{stats.cold}</span>
              <span className="text-text-muted">cold</span>
            </div>
          )}
          {customers.length === 0 && (
            <div className="text-sm text-text-muted">No customers yet</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-base-600">
        {([
          { id: 'all', label: 'All Customers', count: customers.length },
          { id: 'followup', label: 'Need Follow-up', count: needingFollowUp.length },
        ] as { id: CustomerTab; label: string; count: number }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-sold-dim text-sold-light border border-sold/30'
                : 'text-text-muted hover:text-text-secondary hover:bg-base-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`font-mono ${activeTab === tab.id ? 'text-sold-light' : 'text-text-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Sort */}
      <div className="px-6 py-3 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search customers..."
            className="w-full bg-base-700 border border-base-600 rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary outline-none focus:border-sold transition-colors"
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-xs text-text-secondary outline-none focus:border-sold transition-colors"
        >
          <option value="health">Sort: Coldest first</option>
          <option value="recent">Sort: Most recent</option>
          <option value="followers">Sort: Most followers</option>
        </select>
      </div>

      {/* Customer Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-base-700 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-text-muted text-sm">
              {activeTab === 'followup' ? 'All customers are well-engaged 🎉' : 'No customers yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredCustomers.map(contact => (
              <CustomerCard
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
