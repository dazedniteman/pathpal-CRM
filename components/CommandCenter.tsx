
import React, { useMemo } from 'react';
import {
  Contact, EmailDraft, AppSettings, Task,
  PartnershipType, calculateHealthScore, getHealthLevel, daysSince, formatTimeAgo, getTrack,
  Sequence, ContactSequence, SequenceStep,
} from '../types';
import { UnrepliedEmail } from '../services/gmailService';
import { getDueSteps, stepDaysOverdue } from '../services/sequenceService';

interface CommandCenterProps {
  contacts: Contact[];
  tasks: Task[];
  settings: AppSettings;
  googleAuthState: { isAuthenticated: boolean; profile?: { name: string; email: string; picture: string } };
  unrepliedEmails: UnrepliedEmail[];
  isSyncingGmail: boolean;
  onContactClick: (contact: Contact) => void;
  onComposeEmail: (draft: Partial<EmailDraft>, contact?: Contact) => void;
  onViewChange: (view: string) => void;
  onSyncGmail: () => void;
  onTaskUpdate: (task: Task) => void;
  // Phase 3: Sequences
  sequences?: Sequence[];
  enrollments?: ContactSequence[];
  onCompleteStep?: (enrollmentId: string, stepId: string, sequence: Sequence) => Promise<void>;
}

// --- Section Card ---
const SectionCard: React.FC<{ title: string; count: number; accentColor: string; icon: React.ReactNode; children: React.ReactNode; emptyMessage: string }> = ({
  title, count, accentColor, icon, children, emptyMessage,
}) => (
  <div className="card-elevated flex flex-col" style={{ borderTop: `2px solid ${accentColor}` }}>
    <div className="flex items-center justify-between px-4 py-3 border-b border-base-600">
      <div className="flex items-center gap-2">
        <span style={{ color: accentColor }}>{icon}</span>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      {count > 0 && (
        <span
          className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
          style={{ background: `${accentColor}20`, color: accentColor }}
        >
          {count}
        </span>
      )}
    </div>
    <div className="divide-y divide-base-600 flex-1 overflow-y-auto max-h-72">
      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
          <p className="text-text-muted text-xs">{emptyMessage}</p>
        </div>
      ) : children}
    </div>
  </div>
);

// --- Email Reply Item ---
const EmailReplyItem: React.FC<{
  item: UnrepliedEmail;
  onContactClick: (c: Contact) => void;
  onReply: (item: UnrepliedEmail) => void;
}> = ({ item, onContactClick, onReply }) => (
  <div className="flex items-start gap-3 px-4 py-3 hover:bg-base-700 transition-colors group">
    <img
      src={item.contact.avatarUrl}
      alt={item.contact.name}
      className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5 cursor-pointer"
      onClick={() => onContactClick(item.contact)}
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <button
          onClick={() => onContactClick(item.contact)}
          className="text-sm font-semibold text-text-primary hover:text-outreach-light transition-colors truncate"
        >
          {item.contact.name}
        </button>
        <span className="text-xs text-text-muted flex-shrink-0 font-mono">{formatTimeAgo(item.date)}</span>
      </div>
      <p className="text-xs text-text-secondary truncate">{item.subject}</p>
      {item.snippet && (
        <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{item.snippet}</p>
      )}
    </div>
    <button
      onClick={() => onReply(item)}
      className="opacity-0 group-hover:opacity-100 flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-outreach-dim text-outreach-light text-xs font-medium transition-all hover:bg-outreach/20"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
      Reply
    </button>
  </div>
);

// --- Follow-up Item ---
const FollowUpItem: React.FC<{
  contact: Contact;
  onContactClick: (c: Contact) => void;
  onDraftEmail: (contact: Contact) => void;
  accentColor: string;
}> = ({ contact, onContactClick, onDraftEmail, accentColor }) => {
  const daysAgo = daysSince(contact.lastContacted);
  const score = calculateHealthScore(contact);
  const level = getHealthLevel(score);
  const dotColor = level === 'warm' ? '#10B981' : level === 'cooling' ? '#F59E0B' : '#EF4444';

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-base-700 transition-colors group">
      <img
        src={contact.avatarUrl}
        alt={contact.name}
        className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
        onClick={() => onContactClick(contact)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
          <button
            onClick={() => onContactClick(contact)}
            className="text-sm font-medium text-text-primary hover:text-text-primary transition-colors truncate"
          >
            {contact.name}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Last contact: <span className="font-mono">{daysAgo === 9999 ? 'Never' : `${daysAgo}d ago`}</span>
          {contact.location && ` · ${contact.location}`}
        </p>
      </div>
      <button
        onClick={() => onDraftEmail(contact)}
        className="opacity-0 group-hover:opacity-100 flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
        style={{ background: `${accentColor}20`, color: accentColor }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Email
      </button>
    </div>
  );
};

// --- Task Item ---
const TaskItem: React.FC<{
  task: Task;
  contact?: Contact;
  onContactClick: (c: Contact) => void;
  onTaskUpdate: (task: Task) => void;
}> = ({ task, contact, onContactClick, onTaskUpdate }) => {
  const isOverdue = !task.completed && new Date(task.dueDate) < new Date();

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-base-700 transition-colors">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={e => onTaskUpdate({ ...task, completed: e.target.checked })}
        className="flex-shrink-0 w-4 h-4 rounded accent-outreach"
        onClick={e => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{task.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs font-mono ${isOverdue ? 'text-red-400' : 'text-text-muted'}`}>
            {isOverdue ? '⚠ ' : ''}Due {new Date(task.dueDate).toLocaleDateString()}
          </span>
          {contact && (
            <button
              onClick={() => onContactClick(contact)}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              · {contact.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Sequence Step Item ---
const SequenceStepItem: React.FC<{
  contact: Contact;
  sequenceName: string;
  step: SequenceStep;
  daysOverdue: number;
  onContactClick: (c: Contact) => void;
  onExecute: () => void;
  onSkip: () => void;
}> = ({ contact, sequenceName, step, daysOverdue, onContactClick, onExecute, onSkip }) => (
  <div className="flex items-center gap-3 px-4 py-3 hover:bg-base-700 transition-colors group">
    <img
      src={contact.avatarUrl}
      alt={contact.name}
      className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
      onClick={() => onContactClick(contact)}
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => onContactClick(contact)}
          className="text-sm font-medium text-text-primary hover:text-text-primary transition-colors truncate"
        >
          {contact.name}
        </button>
        {daysOverdue > 0 ? (
          <span className="text-xs font-mono text-red-400 flex-shrink-0">⚠ {daysOverdue}d overdue</span>
        ) : (
          <span className="text-xs font-mono flex-shrink-0" style={{ color: '#10B981' }}>Due today</span>
        )}
      </div>
      <p className="text-xs text-text-muted truncate">
        <span className="font-medium" style={{ color: '#8B5CF6' }}>{sequenceName}</span>
        {' · '}
        {step.description}
      </p>
    </div>
    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
      <button
        onClick={onExecute}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
        style={{ background: '#7C3AED22', color: '#8B5CF6' }}
      >
        {step.actionType === 'email_draft' ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Done
          </>
        )}
      </button>
      <button
        onClick={onSkip}
        className="px-2 py-1 rounded-lg text-xs text-text-muted hover:text-text-secondary bg-base-700 hover:bg-base-600 transition-colors"
      >
        Skip
      </button>
    </div>
  </div>
);

export const CommandCenter: React.FC<CommandCenterProps> = ({
  contacts, tasks, settings, googleAuthState,
  unrepliedEmails, isSyncingGmail,
  onContactClick, onComposeEmail, onViewChange, onSyncGmail, onTaskUpdate,
  sequences = [], enrollments = [], onCompleteStep,
}) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Contacts due for outreach follow-up
  const outreachFollowUps = useMemo(() => {
    return contacts.filter(c => {
      if (c.pipelineStage === 'Closed - Success' || c.pipelineStage === 'Closed - Unsuccessful') return false;
      if (c.nextFollowUpDate) return new Date(c.nextFollowUpDate) <= today;
      if (!c.lastContacted) return true;
      const threshold = new Date(c.lastContacted);
      threshold.setDate(threshold.getDate() + (settings.defaultFollowUpDays || 30));
      return threshold <= today;
    }).sort((a, b) => daysSince(b.lastContacted) - daysSince(a.lastContacted)).slice(0, 10);
  }, [contacts, settings.defaultFollowUpDays, today]);

  // Partners needing check-in (health cooling or cold)
  const partnersNeedingCheckIn = useMemo(() =>
    contacts.filter(c => {
      if (c.pipelineStage !== 'Closed - Success') return false;
      if (c.partnershipType !== PartnershipType.PARTNER) return false;
      return getHealthLevel(calculateHealthScore(c)) !== 'warm';
    }).sort((a, b) => calculateHealthScore(a) - calculateHealthScore(b)).slice(0, 8),
    [contacts]
  );

  // Tasks due today or overdue
  const dueTasks = useMemo(() =>
    tasks.filter(t => !t.completed && new Date(t.dueDate) <= today)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10),
    [tasks, today]
  );

  // Contacts to first reach out to (highest followers in To Reach Out bucket)
  const toContact = useMemo(() =>
    contacts.filter(c => c.pipelineStage === 'To Reach Out')
      .sort((a, b) => (b.followers || 0) - (a.followers || 0))
      .slice(0, 6),
    [contacts]
  );

  // Geographic proximity: map location -> first partner/customer name
  const partnerLocationMap = useMemo(() => {
    const map = new Map<string, string>();
    contacts
      .filter(c => c.pipelineStage === 'Closed - Success' && c.location?.trim())
      .forEach(c => {
        const loc = c.location!.trim().toLowerCase();
        if (!map.has(loc)) map.set(loc, c.name);
      });
    return map;
  }, [contacts]);

  // Deliverables due soon (overdue or within 7 days, not yet delivered)
  const deliverablesDueSoon = useMemo(() => {
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
    const items: Array<{ contact: Contact; label: string; dueDate: Date; daysUntil: number }> = [];

    contacts
      .filter(c => c.pipelineStage === 'Closed - Success' && c.partnershipType === PartnershipType.PARTNER && c.partnerDetails)
      .forEach(c => {
        const pd = c.partnerDetails!;
        const checks: Array<{ dueDate?: string; label: string; delivered: boolean }> = [
          { dueDate: pd.drillVideosDueDate, label: `Drill videos (${pd.drillVideosDelivered}/${pd.drillVideosAgreed})`, delivered: pd.drillVideosDelivered >= pd.drillVideosAgreed && pd.drillVideosAgreed > 0 },
          { dueDate: pd.testimonialDueDate, label: 'Testimonial video', delivered: pd.testimonialVideoDelivered },
          { dueDate: pd.websiteLinkDueDate, label: 'Website link', delivered: pd.websiteLinkDelivered },
          { dueDate: pd.socialPostDueDate, label: 'Social post', delivered: pd.socialPostDelivered },
        ];
        for (const { dueDate, label, delivered } of checks) {
          if (!dueDate || delivered) continue;
          const due = new Date(dueDate);
          due.setHours(0, 0, 0, 0);
          if (due <= sevenDaysOut) {
            const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            items.push({ contact: c, label, dueDate: due, daysUntil });
          }
        }
      });

    return items.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 8);
  }, [contacts, today]);

  // Weekly stats (last 7 days)
  const weeklyStats = useMemo(() => {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    let emailsSent = 0, repliesReceived = 0;
    for (const c of contacts) {
      for (const i of c.interactions) {
        const d = new Date(i.date);
        if (d < sevenDaysAgo) continue;
        if (i.isSentByUser) emailsSent++;
        else if (i.type === 'Email') repliesReceived++;
      }
    }
    const coldContacts = contacts.filter(c =>
      c.pipelineStage !== 'Closed - Unsuccessful' &&
      calculateHealthScore(c) < 35 &&
      daysSince(c.lastContacted) > 14
    ).length;
    const overdueDeliverables = contacts.filter(c => {
      if (c.pipelineStage !== 'Closed - Success' || !c.partnerDetails) return false;
      const pd = c.partnerDetails;
      const now = new Date();
      const checks = [
        { date: pd.drillVideosDueDate, done: pd.drillVideosDelivered >= pd.drillVideosAgreed && pd.drillVideosAgreed > 0 },
        { date: pd.testimonialDueDate, done: pd.testimonialVideoDelivered },
        { date: pd.websiteLinkDueDate, done: pd.websiteLinkDelivered },
        { date: pd.socialPostDueDate, done: pd.socialPostDelivered },
      ];
      return checks.some(({ date, done }) => date && !done && new Date(date) < now);
    }).length;
    return { emailsSent, repliesReceived, coldContacts, overdueDeliverables };
  }, [contacts, today]);

  // Sequence steps due today or overdue
  const dueSequenceSteps = useMemo(() => {
    const items: Array<{
      contact: Contact;
      enrollment: ContactSequence;
      sequence: Sequence;
      step: SequenceStep;
      daysOverdue: number;
    }> = [];

    for (const enrollment of enrollments) {
      const sequence = sequences.find(s => s.id === enrollment.sequenceId);
      if (!sequence) continue;
      const contact = contacts.find(c => c.id === enrollment.contactId);
      if (!contact) continue;
      const dueSteps = getDueSteps(enrollment, sequence);
      for (const step of dueSteps) {
        items.push({
          contact,
          enrollment,
          sequence,
          step,
          daysOverdue: stepDaysOverdue(step, enrollment.enrolledAt),
        });
      }
    }

    return items
      .sort((a, b) => b.daysOverdue - a.daysOverdue) // most overdue first
      .slice(0, 10);
  }, [enrollments, sequences, contacts]);

  const totalActions = unrepliedEmails.length + outreachFollowUps.length + partnersNeedingCheckIn.length + dueTasks.length + dueSequenceSteps.length + deliverablesDueSoon.length;

  const handleReply = (item: UnrepliedEmail) => {
    onComposeEmail({
      to: item.contact.email,
      alias: '',
      subject: item.subject.startsWith('Re:') ? item.subject : `Re: ${item.subject}`,
      threadId: item.threadId,
      replyToMessageId: item.messageId,
    }, item.contact);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-base-600">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-text-primary">Command Center</h1>
              {totalActions > 0 && (
                <span className="font-mono text-sm font-semibold px-2 py-0.5 rounded-full bg-outreach-dim text-outreach-light">
                  {totalActions} actions
                </span>
              )}
            </div>
            <p className="text-sm text-text-muted">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {googleAuthState.isAuthenticated ? (
              <button
                onClick={onSyncGmail}
                disabled={isSyncingGmail}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-base-700 border border-base-600 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-outreach/50 transition-all disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 ${isSyncingGmail ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isSyncingGmail ? 'Syncing…' : 'Sync Gmail'}
              </button>
            ) : (
              <button
                onClick={() => onViewChange('settings')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-outreach-dim border border-outreach/30 text-xs font-medium text-outreach-light hover:bg-outreach/20 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Connect Gmail
              </button>
            )}
          </div>
        </div>

        {/* Quick stats row */}
        <div className="flex items-center gap-6 mt-4">
          <button onClick={() => onViewChange('outreach')} className="text-center hover:opacity-80 transition-opacity">
            <div className="text-lg font-bold font-mono text-outreach-light">{contacts.filter(c => getTrack(c) === 'outreach').length}</div>
            <div className="text-xs text-text-muted">In outreach</div>
          </button>
          <div className="w-px h-8 bg-base-600" />
          <button onClick={() => onViewChange('partners')} className="text-center hover:opacity-80 transition-opacity">
            <div className="text-lg font-bold font-mono text-partner-light">{contacts.filter(c => getTrack(c) === 'partner').length}</div>
            <div className="text-xs text-text-muted">Partners</div>
          </button>
          <div className="w-px h-8 bg-base-600" />
          <button onClick={() => onViewChange('sold')} className="text-center hover:opacity-80 transition-opacity">
            <div className="text-lg font-bold font-mono text-sold-light">{contacts.filter(c => getTrack(c) === 'sold').length}</div>
            <div className="text-xs text-text-muted">Customers</div>
          </button>
          <div className="w-px h-8 bg-base-600" />
          <div className="text-center">
            <div className="text-lg font-bold font-mono text-text-primary">{contacts.length}</div>
            <div className="text-xs text-text-muted">Total contacts</div>
          </div>
        </div>

        {/* Weekly digest strip */}
        <div className="mt-4 pt-4 border-t border-base-600 flex items-center gap-6 flex-wrap">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">This Week</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-mono font-bold text-outreach-light">{weeklyStats.emailsSent}</span>
            <span className="text-xs text-text-muted">emails sent</span>
          </div>
          <div className="w-px h-4 bg-base-600" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-mono font-bold text-partner-light">{weeklyStats.repliesReceived}</span>
            <span className="text-xs text-text-muted">replies received</span>
          </div>
          <div className="w-px h-4 bg-base-600" />
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-mono font-bold ${weeklyStats.coldContacts > 0 ? 'text-red-400' : 'text-text-secondary'}`}>{weeklyStats.coldContacts}</span>
            <span className="text-xs text-text-muted">contacts gone cold</span>
          </div>
          <div className="w-px h-4 bg-base-600" />
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-mono font-bold ${weeklyStats.overdueDeliverables > 0 ? 'text-sold-light' : 'text-text-secondary'}`}>{weeklyStats.overdueDeliverables}</span>
            <span className="text-xs text-text-muted">deliverables overdue</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Emails needing reply */}
        <SectionCard
          title="Emails Needing Reply"
          count={unrepliedEmails.length}
          accentColor="#6366F1"
          emptyMessage={googleAuthState.isAuthenticated ? "You're all caught up ✓" : "Connect Gmail to see emails needing reply"}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        >
          {unrepliedEmails.map(item => (
            <EmailReplyItem
              key={`${item.contact.id}-${item.messageId || item.date}`}
              item={item}
              onContactClick={onContactClick}
              onReply={handleReply}
            />
          ))}
        </SectionCard>

        {/* Outreach follow-ups due */}
        <SectionCard
          title="Outreach Follow-ups Due"
          count={outreachFollowUps.length}
          accentColor="#6366F1"
          emptyMessage="No follow-ups due — great work!"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          {outreachFollowUps.map(contact => (
            <FollowUpItem
              key={contact.id}
              contact={contact}
              onContactClick={onContactClick}
              onDraftEmail={c => onComposeEmail({ to: c.email, alias: '' }, c)}
              accentColor="#818CF8"
            />
          ))}
        </SectionCard>

        {/* Sequence Steps Due */}
        <SectionCard
          title="Sequence Steps Due"
          count={dueSequenceSteps.length}
          accentColor="#8B5CF6"
          emptyMessage="No sequence steps due — you're on track!"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10M16 14l4 4-4 4" />
            </svg>
          }
        >
          {dueSequenceSteps.map(({ contact, enrollment, sequence, step, daysOverdue }) => (
            <SequenceStepItem
              key={`${enrollment.id}-${step.id}`}
              contact={contact}
              sequenceName={sequence.name}
              step={step}
              daysOverdue={daysOverdue}
              onContactClick={onContactClick}
              onExecute={() => {
                if (step.actionType === 'email_draft') {
                  onComposeEmail(
                    { to: contact.email, alias: '', templateId: step.templateId },
                    contact
                  );
                }
                onCompleteStep?.(enrollment.id, step.id, sequence);
              }}
              onSkip={() => onCompleteStep?.(enrollment.id, step.id, sequence)}
            />
          ))}
        </SectionCard>

        {/* Partners needing check-in */}
        <SectionCard
          title="Partners Needing Check-in"
          count={partnersNeedingCheckIn.length}
          accentColor="#10B981"
          emptyMessage="All partners are warm — keep it up!"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          }
        >
          {partnersNeedingCheckIn.map(contact => (
            <FollowUpItem
              key={contact.id}
              contact={contact}
              onContactClick={onContactClick}
              onDraftEmail={c => onComposeEmail({ to: c.email, alias: '' }, c)}
              accentColor="#34D399"
            />
          ))}
        </SectionCard>

        {/* Deliverables due soon */}
        <SectionCard
          title="Deliverables Due Soon"
          count={deliverablesDueSoon.length}
          accentColor="#F59E0B"
          emptyMessage="No deliverables due in the next 7 days"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
        >
          {deliverablesDueSoon.map(({ contact, label, daysUntil }, idx) => (
            <div key={`${contact.id}-${label}-${idx}`} className="flex items-center gap-3 px-4 py-3 hover:bg-base-700 transition-colors group">
              <img
                src={contact.avatarUrl}
                alt={contact.name}
                className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
                onClick={() => onContactClick(contact)}
              />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => onContactClick(contact)}
                  className="text-sm font-medium text-text-primary hover:text-text-primary transition-colors block truncate text-left w-full"
                >
                  {contact.name}
                </button>
                <p className="text-xs text-text-muted truncate">{label}</p>
              </div>
              <span className={`text-xs font-mono flex-shrink-0 font-semibold ${daysUntil < 0 ? 'text-red-400' : daysUntil === 0 ? 'text-sold-light' : 'text-text-muted'}`}>
                {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : daysUntil === 0 ? 'Due today' : `Due in ${daysUntil}d`}
              </span>
            </div>
          ))}
        </SectionCard>

        {/* Tasks due */}
        <SectionCard
          title="Tasks Due"
          count={dueTasks.length}
          accentColor="#F59E0B"
          emptyMessage="No tasks due — you're on top of it!"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
        >
          {dueTasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              contact={contacts.find(c => c.id === task.contactId)}
              onContactClick={onContactClick}
              onTaskUpdate={onTaskUpdate}
            />
          ))}
        </SectionCard>

        {/* Suggested first outreach */}
        {toContact.length > 0 && (
          <div className="lg:col-span-2">
            <SectionCard
              title="Suggested First Outreach"
              count={toContact.length}
              accentColor="#6366F1"
              emptyMessage="No contacts awaiting first reach out"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-base-600">
                {toContact.map(contact => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-base-700 transition-colors group"
                  >
                    <img
                      src={contact.avatarUrl}
                      alt={contact.name}
                      className="w-8 h-8 rounded-full flex-shrink-0 cursor-pointer"
                      onClick={() => onContactClick(contact)}
                    />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onContactClick(contact)}
                        className="text-sm font-medium text-text-primary hover:text-outreach-light transition-colors block truncate w-full text-left"
                      >
                        {contact.name}
                      </button>
                      <p className="text-xs text-text-muted">
                        {contact.followers ? (
                          <span className="font-mono">{contact.followers >= 1000 ? `${(contact.followers / 1000).toFixed(1)}k` : contact.followers} followers</span>
                        ) : contact.location || 'No info'}
                      </p>
                      {contact.location && partnerLocationMap.has(contact.location.trim().toLowerCase()) && (
                        <p className="text-xs text-partner-light mt-0.5">
                          📍 Near {partnerLocationMap.get(contact.location.trim().toLowerCase())}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => onComposeEmail({ to: contact.email, alias: '' }, contact)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-outreach-dim text-outreach-light text-xs font-medium transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
};
