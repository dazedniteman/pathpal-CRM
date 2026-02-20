
import React from 'react';
import { Contact, View, getTrack, PartnershipType } from '../types';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  contacts: Contact[];
  onNewContact: () => void;
  onImport: () => void;
  onExport: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, contacts, onNewContact, onImport, onExport, unrepliedCount = 0 }) => {
  const outreachCount = contacts.filter(c => c.pipelineStage !== 'Closed - Success').length;
  const partnerCount = contacts.filter(c => c.pipelineStage === 'Closed - Success' && c.partnershipType === PartnershipType.PARTNER).length;
  const soldCount = contacts.filter(c => c.pipelineStage === 'Closed - Success' && c.partnershipType === PartnershipType.SALE).length;

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
          label="Net New Outreach"
          view="outreach"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={outreachCount}
          accentColor="#6366F1"
          activeColor="text-outreach-light"
          activeBg="bg-outreach-dim"
        />

        <NavItem
          icon={<IconHandshake />}
          label="Active Partners"
          view="partners"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={partnerCount}
          accentColor="#10B981"
          activeColor="text-partner-light"
          activeBg="bg-partner-dim"
        />

        <NavItem
          icon={<IconShoppingBag />}
          label="Sold / Customers"
          view="sold"
          currentView={currentView}
          onViewChange={onViewChange}
          badge={soldCount}
          accentColor="#F59E0B"
          activeColor="text-sold-light"
          activeBg="bg-sold-dim"
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
