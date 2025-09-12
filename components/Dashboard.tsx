

import React, { useMemo } from 'react';
import { AppSettings, Contact, PartnershipType, TableFilter, View, Task } from '../types';
import { ArrowRightIcon, BellIcon, ChatBubbleLeftRightIcon, GlobeAltIcon, HandshakeIcon, HashtagIcon, UserGroupIcon, UsersIcon, VideoCameraIcon, TasksIcon } from './icons';

interface DashboardProps {
  contacts: Contact[];
  contactsToFollowUp: Contact[];
  partnersToFollowUp: Contact[];
  tasks: Task[];
  settings: AppSettings;
  onSelectContact: (contact: Contact) => void;
  onNavigate: (view: View, filter?: TableFilter) => void;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode, onClick?: () => void, children?: React.ReactNode }> = ({ title, value, icon, onClick, children }) => (
  <div className="bg-secondary p-6 rounded-lg shadow-lg flex flex-col h-full">
    <div 
      className={`flex items-center space-x-4 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="bg-accent p-3 rounded-full">{icon}</div>
      <div>
        <p className="text-sm text-text-secondary font-medium">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
    {children && <div className="mt-4 pt-4 border-t border-accent flex-grow">{children}</div>}
  </div>
);

const FollowUpCard: React.FC<{ contact: Contact; onSelectContact: (contact: Contact) => void }> = ({ contact, onSelectContact }) => (
  <div 
    key={contact.id} 
    className="flex items-center justify-between bg-accent p-4 rounded-md cursor-pointer hover:bg-gray-600 transition-colors"
    onClick={() => onSelectContact(contact)}
  >
    <div className="flex items-center space-x-4">
      <img src={contact.avatarUrl} alt={contact.name} className="w-10 h-10 rounded-full" />
      <div>
        <p className="font-semibold text-white">{contact.name}</p>
        <p className="text-sm text-text-secondary">
            {contact.partnershipType === PartnershipType.PARTNER ? `Partner since ${new Date(contact.lastContacted).toLocaleDateString()}` : `Last contacted: ${new Date(contact.lastContacted).toLocaleDateString()}`}
        </p>
      </div>
    </div>
    <button className="text-highlight hover:text-blue-400">
      <ArrowRightIcon />
    </button>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ contacts, contactsToFollowUp, partnersToFollowUp, onSelectContact, onNavigate, tasks, settings }) => {
  const totalContacts = contacts.length;
  const successfulDeals = contacts.filter(c => c.pipelineStage === 'Closed - Success').length;
  const partners = useMemo(() => contacts.filter(c => c.partnershipType === PartnershipType.PARTNER && c.partnerDetails), [contacts]);
  const contactsMap = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts]);
  
  const partnerStats = useMemo(() => partners.reduce((acc, p) => {
    const details = p.partnerDetails!;
    acc.drillsAgreed += details.drillVideosAgreed;
    acc.drillsDelivered += details.drillVideosDelivered;
    acc.testimonialsAgreed += details.testimonialVideoAgreed ? 1 : 0;
    acc.testimonialsDelivered += details.testimonialVideoDelivered ? 1 : 0;
    acc.linksAgreed += details.websiteLinkAgreed ? 1 : 0;
    acc.linksDelivered += details.websiteLinkDelivered ? 1 : 0;
    acc.postsAgreed += details.socialPostAgreed ? 1 : 0;
    acc.postsDelivered += details.socialPostDelivered ? 1 : 0;
    return acc;
  }, {
    drillsAgreed: 0, drillsDelivered: 0, testimonialsAgreed: 0, testimonialsDelivered: 0,
    linksAgreed: 0, linksDelivered: 0, postsAgreed: 0, postsDelivered: 0
  }), [partners]);

  const outstandingPartners = useMemo(() => ({
    drills: partners.filter(p => p.partnerDetails!.drillVideosAgreed > p.partnerDetails!.drillVideosDelivered),
    testimonials: partners.filter(p => p.partnerDetails!.testimonialVideoAgreed && !p.partnerDetails!.testimonialVideoDelivered),
    links: partners.filter(p => p.partnerDetails!.websiteLinkAgreed && !p.partnerDetails!.websiteLinkDelivered),
    posts: partners.filter(p => p.partnerDetails!.socialPostAgreed && !p.partnerDetails!.socialPostDelivered),
  }), [partners]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(t => !t.completed && new Date(t.dueDate) < today);
  const upcomingTasks = tasks.filter(t => !t.completed && new Date(t.dueDate) >= today);

  const handleTaskClick = (task: Task) => {
    if (task.contactId) {
      const contact = contactsMap.get(task.contactId);
      if (contact) onSelectContact(contact);
    } else {
      onNavigate('tasks');
    }
  };

  const OutstandingList: React.FC<{ partners: Contact[] }> = ({ partners }) => (
    <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
      {partners.length > 0 ? partners.map(p => (
        <button 
          key={p.id} 
          onClick={() => onSelectContact(p)} 
          className="block w-full text-left text-text-secondary hover:text-white hover:bg-accent/50 p-1 rounded"
        >
          {p.name}
        </button>
      )) : <p className="text-xs text-text-secondary italic">All caught up!</p>}
    </div>
  );

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-3xl font-bold text-white mb-6">Leads Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Contacts" value={totalContacts} icon={<UserGroupIcon />} />
          <StatCard title="Successful Deals" value={successfulDeals} icon={<UsersIcon />} />
          <StatCard title="Lead Follow-ups" value={contactsToFollowUp.length} icon={<BellIcon />} />
          <StatCard title="Active Partners" value={partners.length} icon={<HandshakeIcon />} />
        </div>
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-secondary p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <TasksIcon />
              <span className="ml-2">My Tasks</span>
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {overdueTasks.length > 0 && <div className="text-red-400 font-bold text-sm">OVERDUE ({overdueTasks.length})</div>}
              {overdueTasks.map(task => (
                <button key={task.id} onClick={() => handleTaskClick(task)} className="w-full text-left text-sm text-white bg-red-500/20 p-2 rounded hover:bg-red-500/30">{task.title}</button>
              ))}
              <div className="text-blue-400 font-bold text-sm">UPCOMING ({upcomingTasks.length})</div>
              {upcomingTasks.length > 0 ? upcomingTasks.slice(0, 5).map(task => (
                <button key={task.id} onClick={() => handleTaskClick(task)} className="w-full text-left text-sm text-text-secondary hover:text-white hover:bg-accent/50 p-2 rounded">{task.title}</button>
              )) : <p className="text-text-secondary text-sm">No upcoming tasks.</p>}
              <button onClick={() => onNavigate('tasks')} className="text-highlight text-sm font-semibold w-full text-center mt-2 hover:underline">View all tasks</button>
            </div>
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-secondary p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center"><BellIcon /><span className="ml-2">Needs Follow-up (Leads)</span></h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {contactsToFollowUp.length > 0 ? contactsToFollowUp.map(contact => (
                  <FollowUpCard key={contact.id} contact={contact} onSelectContact={onSelectContact} />
                )) : <p className="text-text-secondary">No leads need immediate follow-up.</p>}
              </div>
            </div>
            <div className="bg-secondary p-6 rounded-lg shadow-lg">
              <h3 className="text-xl font-semibold text-white mb-4">Lead Pipeline Overview</h3>
              <div className="space-y-3">{contacts.length > 0 && settings.pipelineStages.map(stage => { const count = contacts.filter(c => c.pipelineStage === stage).length; const percentage = (count / contacts.length) * 100; return (<div key={stage}><div className="flex justify-between text-sm font-medium text-text-secondary mb-1"><span>{stage}</span><span>{count}</span></div><div className="w-full bg-accent rounded-full h-2.5"><div className="bg-highlight h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div></div></div>); })}</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-3xl font-bold text-white mb-6">Partners Overview</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Drills Outstanding" value={`${partnerStats.drillsDelivered} / ${partnerStats.drillsAgreed}`} icon={<VideoCameraIcon />} onClick={outstandingPartners.drills.length > 0 ? () => onNavigate('table', { type: 'outstanding_drills', label: 'Partners with Outstanding Drill Videos' }) : undefined}>
            <OutstandingList partners={outstandingPartners.drills} />
          </StatCard>
          <StatCard title="Testimonials Outstanding" value={`${partnerStats.testimonialsDelivered} / ${partnerStats.testimonialsAgreed}`} icon={<ChatBubbleLeftRightIcon />} onClick={outstandingPartners.testimonials.length > 0 ? () => onNavigate('table', { type: 'outstanding_testimonials', label: 'Partners with Outstanding Testimonials' }) : undefined}>
             <OutstandingList partners={outstandingPartners.testimonials} />
          </StatCard>
          <StatCard title="Links Outstanding" value={`${partnerStats.linksDelivered} / ${partnerStats.linksAgreed}`} icon={<GlobeAltIcon />} onClick={outstandingPartners.links.length > 0 ? () => onNavigate('table', { type: 'outstanding_links', label: 'Partners with Outstanding Website Links' }) : undefined}>
            <OutstandingList partners={outstandingPartners.links} />
          </StatCard>
          <StatCard title="Social Posts Outstanding" value={`${partnerStats.postsDelivered} / ${partnerStats.postsAgreed}`} icon={<HashtagIcon />} onClick={outstandingPartners.posts.length > 0 ? () => onNavigate('table', { type: 'outstanding_posts', label: 'Partners with Outstanding Social Posts' }) : undefined}>
            <OutstandingList partners={outstandingPartners.posts} />
          </StatCard>
        </div>
         <div className="mt-8 bg-secondary p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center"><HandshakeIcon /><span className="ml-2">Partner Follow-ups</span></h3>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {partnersToFollowUp.length > 0 ? partnersToFollowUp.map(contact => (<FollowUpCard key={contact.id} contact={contact} onSelectContact={onSelectContact} />)) : <p className="text-text-secondary">No partners are marked for continuous follow-up.</p>}
            </div>
          </div>
      </section>
    </div>
  );
};
