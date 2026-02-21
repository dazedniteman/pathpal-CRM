
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Contact, View, PartnershipType } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  contacts: Contact[];
  onNewContact: () => void;
  onImport: () => void;
  onExport: () => void;
  onSelectContact?: (contact: Contact) => void;
  unrepliedCount?: number;
}

// SVG Icons inline
const IconGrid = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const IconArrowUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
);

const IconHandshake = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.25278V19.2528M12 6.25278C10.8321 5.47686 9.24649 5 7.5 5C5.75351 5 4.16789 5.47686 3 6.25278V19.2528C4.16789 18.4769 5.75351 18 7.5 18C9.24649 18 10.8321 18.4769 12 19.2528M12 6.25278C13.1679 5.47686 14.7535 5 16.5 5C18.2465 5 19.8321 5.47686 21 6.25278V19.2528C19.8321 18.4769 18.2465 18 16.5 18C14.7535 18 13.1679 18.4769 12 19.2528" />
  </svg>
);

const IconShoppingBag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconCheckSquare = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const IconBarChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconKanban = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
  </svg>
);

const IconSequence = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10M16 14l4 4-4 4" />
  </svg>
);

const IconSettings = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.096 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const IconDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  view: View;
  currentView: View;
  onViewChange: (view: View) => void;
  badge?: number;
  accentColor?: string;
  activeColor?: string;
  activeBg?: string;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, view, currentView, onViewChange, badge, accentColor, activeColor, activeBg }) => {
  const isActive = currentView === view;

  return (
    <button
      onClick={() => onViewChange(view)}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group ${
        isActive
          ? `${activeBg || 'bg-base-600'} ${activeColor || 'text-text-primary'}`
          : 'text-text-secondary hover:text-text-primary hover:bg-base-700'
      }`}
      style={isActive && accentColor ? { borderLeft: `3px solid ${accentColor}`, paddingLeft: '9px' } : {}}
    >
      <div className="flex items-center gap-2.5">
        <span className={isActive ? (activeColor || 'text-white') : 'text-text-muted group-hover:text-text-secondary'}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span
          className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            background: accentColor ? `${accentColor}22` : '#353848',
            color: accentColor || '#9BA3AF',
          }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 pt-5 pb-1">
    <span className="text-xs font-semibold tracking-widest text-text-muted uppercase">{children}</span>
  </div>
);

const Divider = () => <div className="border-t border-base-600 my-2 mx-3" />;

const CONTACT_TYPE_LABELS: Record<string, string> = {
  instructor: 'Instructor',
  media: 'Media',
  customer: 'Customer',
  other: 'Other',
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentView, onViewChange, contacts, onNewContact, onImport, onExport,
  onSelectContact, unrepliedCount = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    const q = debouncedQuery.toLowerCase();
    return contacts
      .filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.instagramHandle || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q) ||
        (c.notes || '').toLowerCase().includes(q) ||
        (c.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (c.additionalEmails || []).some(e => e.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [debouncedQuery, contacts]);

  const showDropdown = searchFocused && debouncedQuery.trim().length > 0;

  // Track counts (new logic)
  const prospectiveTeachersCount = contacts.filter(c =>
    c.contactType === 'instructor' &&
    !c.partnershipType &&
    c.pipelineStage !== 'Sent Product; Awaiting Feedback'
  ).length;

  const peopleWithProductCount = contacts.filter(c =>
    c.partnershipType === PartnershipType.PARTNER ||
    c.partnershipType === PartnershipType.SALE ||
    c.pipelineStage === 'Sent Product; Awaiting Feedback'
  ).length;

  const otherCount = contacts.filter(c =>
    c.contactType !== 'instructor' &&
    !c.partnershipType &&
    c.pipelineStage !== 'Sent Product; Awaiting Feedback'
  ).length;

  return (
    <div className="sidebar-fixed bg-base-800 border-r border-base-600 flex flex-col">
      {/* Logo / Branding */}
      <div className="px-4 py-5 border-b border-base-600">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-outreach to-outreach-light flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary leading-none">PathPal CRM</div>
            <div className="text-xs text-text-muted mt-0.5">Founder Sales</div>
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div className="px-3 py-3 border-b border-base-600" ref={searchRef}>
        <div className="relative">
          <div className="flex items-center gap-2 bg-base-700 border border-base-600 rounded-lg px-3 py-2 focus-within:border-outreach/50 transition-colors">
            <span className="text-text-muted flex-shrink-0"><IconSearch /></span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={e => {
                if (e.key === 'Escape') { setSearchFocused(false); setSearchQuery(''); }
                if (e.key === 'Enter' && searchResults.length > 0) {
                  onSelectContact?.(searchResults[0]);
                  setSearchFocused(false);
                  setSearchQuery('');
                }
              }}
              placeholder="Search contacts…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none min-w-0"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setDebouncedQuery(''); }}
                className="text-text-muted hover:text-text-secondary flex-shrink-0 text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-base-700 border border-base-600 rounded-lg shadow-xl z-50 overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="px-3 py-3 text-xs text-text-muted text-center">No contacts found</div>
              ) : (
                searchResults.map(contact => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      onSelectContact?.(contact);
                      setSearchFocused(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-base-600 transition-colors text-left"
                  >
                    <img
                      src={contact.avatarUrl}
                      alt={contact.name}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">{contact.name}</span>
                        {contact.stopFollowUp && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-600 text-text-muted">paused</span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted truncate">
                        {CONTACT_TYPE_LABELS[contact.contactType || 'other'] || 'Other'} · {contact.pipelineStage}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        <SectionLabel>Overview</SectionLabel>
        <NavItem
          icon={<IconGrid />}
          label="Command Center"
          view="dashboard"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={unrepliedCount}
          accentColor="#6366F1"
          activeColor="text-white"
          activeBg="bg-base-600"
        />

        <SectionLabel>Tracks</SectionLabel>

        <NavItem
          icon={<IconArrowUp />}
          label="Prospective Teachers"
          view="outreach"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={prospectiveTeachersCount}
          accentColor="#6366F1"
          activeColor="text-outreach-light"
          activeBg="bg-outreach-dim"
        />

        <NavItem
          icon={<IconHandshake />}
          label="People with the Product"
          view="partners"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={peopleWithProductCount}
          accentColor="#10B981"
          activeColor="text-partner-light"
          activeBg="bg-partner-dim"
        />

        <NavItem
          icon={<IconUsers />}
          label="Other"
          view="other"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={otherCount}
          accentColor="#6B7280"
          activeColor="text-gray-300"
          activeBg="bg-gray-800/50"
        />

        <SectionLabel>Tools</SectionLabel>

        <NavItem
          icon={<IconCheckSquare />}
          label="Tasks"
          view="tasks"
          currentView={currentView}
          onViewChange={onViewChange}
        />

        <NavItem
          icon={<IconBarChart />}
          label="Analytics"
          view="analytics"
          currentView={currentView}
          onViewChange={onViewChange}
        />

        <NavItem
          icon={<IconKanban />}
          label="Pipeline Board"
          view="kanban"
          currentView={currentView}
          onViewChange={onViewChange}
        />

        <NavItem
          icon={<IconShoppingBag />}
          label="Products"
          view="products"
          currentView={currentView}
          onViewChange={onViewChange}
        />

        <NavItem
          icon={<IconGrid />}
          label="Templates"
          view="templates"
          currentView={currentView}
          onViewChange={onViewChange}
        />

        <NavItem
          icon={<IconSequence />}
          label="Sequences"
          view="sequences"
          currentView={currentView}
          onViewChange={onViewChange}
          accentColor="#8B5CF6"
          activeColor="text-purple-300"
          activeBg="bg-purple-900/30"
        />

        <Divider />

        <NavItem
          icon={<IconSettings />}
          label="Settings"
          view="settings"
          currentView={currentView}
          onViewChange={onViewChange}
        />
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-base-600 space-y-2">
        <button
          onClick={onNewContact}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors duration-150"
        >
          <IconPlus />
          New Contact
        </button>
        <div className="flex gap-2">
          <button
            onClick={onImport}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-colors duration-150"
          >
            <IconUpload />
            Import
          </button>
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-base-700 hover:bg-base-600 text-text-secondary hover:text-text-primary rounded-lg text-xs font-medium transition-colors duration-150"
          >
            <IconDownload />
            Export
          </button>
        </div>
      </div>
    </div>
  );
};
