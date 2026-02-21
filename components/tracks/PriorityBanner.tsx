
import React, { useMemo, useState } from 'react';
import { Contact, InteractionType, Sequence, ContactSequence, PartnershipType } from '../../types';
import { getDueSteps } from '../../services/sequenceService';

interface PriorityBannerProps {
  contacts: Contact[];
  contactEnrollments?: ContactSequence[];
  sequences?: Sequence[];
  onContactClick: (contact: Contact) => void;
}

interface PriorityItem {
  category: 'overdue_followup' | 'outstanding_deliverable' | 'meeting_booked' | 'unanswered_email' | 'sequence_due';
  contact: Contact;
  detail: string;
}

const CATEGORY_CONFIG: Record<PriorityItem['category'], { label: string; color: string; icon: React.ReactNode }> = {
  overdue_followup: {
    label: 'Overdue Follow-up',
    color: '#EF4444',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  outstanding_deliverable: {
    label: 'Outstanding Deliverable',
    color: '#F59E0B',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  meeting_booked: {
    label: 'Meeting Booked',
    color: '#10B981',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  unanswered_email: {
    label: 'Unanswered Email',
    color: '#8B5CF6',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  sequence_due: {
    label: 'Sequence Step Due',
    color: '#6366F1',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
};

function hasOutstandingDeliverables(c: Contact): boolean {
  const pd = c.partnerDetails;
  if (!pd) return false;
  if (pd.drillVideosDelivered < pd.drillVideosAgreed) return true;
  if (pd.testimonialVideoAgreed && !pd.testimonialVideoDelivered) return true;
  if (pd.websiteLinkAgreed && !pd.websiteLinkDelivered) return true;
  if (pd.socialPostAgreed && !pd.socialPostDelivered) return true;
  return false;
}

function getOutstandingDeliverableDetail(c: Contact): string {
  const pd = c.partnerDetails!;
  const issues: string[] = [];
  if (pd.drillVideosDelivered < pd.drillVideosAgreed) {
    issues.push(`${pd.drillVideosAgreed - pd.drillVideosDelivered} drill video${pd.drillVideosAgreed - pd.drillVideosDelivered > 1 ? 's' : ''}`);
  }
  if (pd.testimonialVideoAgreed && !pd.testimonialVideoDelivered) issues.push('testimonial video');
  if (pd.websiteLinkAgreed && !pd.websiteLinkDelivered) issues.push('website link');
  if (pd.socialPostAgreed && !pd.socialPostDelivered) issues.push('social post');
  return issues.join(', ') + ' outstanding';
}

export const PriorityBanner: React.FC<PriorityBannerProps> = ({
  contacts,
  contactEnrollments = [],
  sequences = [],
  onContactClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const items = useMemo((): PriorityItem[] => {
    const result: PriorityItem[] = [];

    for (const c of contacts) {
      // 1. Overdue follow-ups
      if (c.nextFollowUpDate) {
        const due = new Date(c.nextFollowUpDate);
        due.setHours(0, 0, 0, 0);
        if (due < today) {
          const daysOverdue = Math.round((today.getTime() - due.getTime()) / 86400000);
          result.push({
            category: 'overdue_followup',
            contact: c,
            detail: `${daysOverdue}d overdue`,
          });
        }
      }

      // 2. Outstanding deliverables (partners only)
      if (c.partnershipType === PartnershipType.PARTNER && hasOutstandingDeliverables(c)) {
        result.push({
          category: 'outstanding_deliverable',
          contact: c,
          detail: getOutstandingDeliverableDetail(c),
        });
      }

      // 3. Meeting booked
      if (c.pipelineStage === 'Meeting Booked') {
        result.push({
          category: 'meeting_booked',
          contact: c,
          detail: 'Meeting scheduled — prep needed',
        });
      }

      // 4. Unanswered email (sent by you 3+ days ago, no reply since)
      const emails = c.interactions
        .filter(i => i.type === InteractionType.EMAIL)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (emails.length > 0) {
        const lastEmail = emails[0];
        if (lastEmail.isSentByUser === true) {
          const sentDaysAgo = Math.round((today.getTime() - new Date(lastEmail.date).getTime()) / 86400000);
          if (sentDaysAgo >= 3) {
            result.push({
              category: 'unanswered_email',
              contact: c,
              detail: `Sent ${sentDaysAgo}d ago — no reply`,
            });
          }
        }
      }

      // 5. Sequence steps due
      const enrollment = contactEnrollments.find(e => e.contactId === c.id && e.status === 'active');
      if (enrollment) {
        const seq = sequences.find(s => s.id === enrollment.sequenceId);
        if (seq) {
          const dueSteps = getDueSteps(enrollment, seq);
          if (dueSteps.length > 0) {
            result.push({
              category: 'sequence_due',
              contact: c,
              detail: `"${dueSteps[0].description}" due`,
            });
          }
        }
      }
    }

    // Sort: overdue follow-ups first, then outstanding deliverables, etc.
    const order: PriorityItem['category'][] = [
      'overdue_followup', 'outstanding_deliverable', 'meeting_booked', 'unanswered_email', 'sequence_due'
    ];
    return result.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  }, [contacts, contactEnrollments, sequences, today]);

  if (items.length === 0) return null;

  // Count per category for the summary chips
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<PriorityItem['category'], number>> = {};
    for (const item of items) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [items]);

  return (
    <div className="border-b border-base-600 bg-base-750">
      {/* Summary strip — always visible */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-base-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wide mr-1">
            {items.length} {items.length === 1 ? 'item' : 'items'} need attention
          </span>
          {(Object.entries(categoryCounts) as [PriorityItem['category'], number][]).map(([cat, count]) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <span
                key={cat}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: `${cfg.color}18`, color: cfg.color }}
              >
                {cfg.icon}
                {count}
              </span>
            );
          })}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded list */}
      {isExpanded && (
        <div className="px-6 pb-3 max-h-60 overflow-y-auto space-y-1">
          {items.map((item, idx) => {
            const cfg = CATEGORY_CONFIG[item.category];
            return (
              <button
                key={idx}
                onClick={() => onContactClick(item.contact)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-base-700 transition-colors text-left group"
              >
                <img
                  src={item.contact.avatarUrl}
                  alt={item.contact.name}
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                />
                <span className="text-sm font-medium text-text-primary group-hover:text-white transition-colors min-w-0 flex-shrink-0">
                  {item.contact.name}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                  style={{ background: `${cfg.color}18`, color: cfg.color }}
                >
                  {cfg.icon}
                  {cfg.label}
                </span>
                <span className="text-xs text-text-muted truncate ml-auto">{item.detail}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
