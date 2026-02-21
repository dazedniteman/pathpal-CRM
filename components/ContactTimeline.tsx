
import React, { useState } from 'react';
import { Interaction, InteractionType, Task, formatTimeAgo } from '../types';

interface ContactTimelineProps {
  interactions: Interaction[];
  tasks: Task[];
  onReply?: (interaction: Interaction) => void;
  onTaskUpdate?: (task: Task) => void;
  onSummarizeEmail?: (body: string) => Promise<string>;
}

const TypeIcon: React.FC<{ type: InteractionType }> = ({ type }) => {
  const cls = "w-4 h-4";
  switch (type) {
    case InteractionType.EMAIL:
      return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
    case InteractionType.CALL:
      return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>;
    case InteractionType.MEETING:
      return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.653-.124-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.653.124-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    default:
      return <svg xmlns="http://www.w3.org/2000/svg" className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
  }
};

function dotColor(type: InteractionType): string {
  switch (type) {
    case InteractionType.EMAIL: return '#6366F1';
    case InteractionType.CALL: return '#F59E0B';
    case InteractionType.MEETING: return '#10B981';
    default: return '#4A4D5E';
  }
}

interface TimelineEntry {
  id: string;
  date: string;
  kind: 'interaction' | 'task';
  interaction?: Interaction;
  task?: Task;
}

export const ContactTimeline: React.FC<ContactTimelineProps> = ({ interactions, tasks, onReply, onTaskUpdate, onSummarizeEmail }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [emailSummaries, setEmailSummaries] = useState<Record<string, string>>({});
  const [loadingSummaries, setLoadingSummaries] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleSummarize = async (id: string, body: string) => {
    if (!onSummarizeEmail || emailSummaries[id] || loadingSummaries.has(id)) return;
    setLoadingSummaries(prev => new Set([...prev, id]));
    try {
      const summary = await onSummarizeEmail(body);
      if (summary) setEmailSummaries(prev => ({ ...prev, [id]: summary }));
    } finally {
      setLoadingSummaries(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const entries: TimelineEntry[] = [
    ...interactions.map(i => ({ id: i.id, date: i.date, kind: 'interaction' as const, interaction: i })),
    ...tasks.map(t => ({ id: t.id, date: t.dueDate, kind: 'task' as const, task: t })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-base-700 flex items-center justify-center mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-text-muted text-sm">No activity yet</p>
        <p className="text-text-muted text-xs mt-1">Sync Gmail or log an interaction to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 relative overflow-y-auto flex-1">
      {/* Vertical track line */}
      <div className="absolute left-[15px] top-4 bottom-4 w-px bg-base-600 z-0" />

      {entries.map(entry => {
        if (entry.kind === 'task' && entry.task) {
          const t = entry.task;
          const overdue = !t.completed && new Date(t.dueDate) < new Date();
          return (
            <div key={entry.id} className="flex gap-3 pb-5 relative">
              <div className="w-8 h-8 flex-shrink-0 rounded-full bg-base-700 border border-base-600 flex items-center justify-center z-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="flex-1 pt-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className={`text-sm ${t.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}>{t.title}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-text-muted">Task</span>
                      <span className="text-xs text-text-muted">·</span>
                      <span className={`text-xs font-mono ${overdue ? 'text-red-400' : 'text-text-muted'}`}>
                        {overdue ? '⚠ ' : ''}Due {new Date(t.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {onTaskUpdate && (
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={e => onTaskUpdate({ ...t, completed: e.target.checked })}
                      className="mt-1 accent-outreach flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (entry.kind === 'interaction' && entry.interaction) {
          const i = entry.interaction;
          const color = dotColor(i.type);
          const expanded = expandedIds.has(i.id);
          const hasBody = !!(i.emailBody?.trim());
          const isSent = i.isSentByUser;

          return (
            <div key={entry.id} className="flex gap-3 pb-5 relative">
              {/* Icon dot */}
              <div
                className="w-8 h-8 flex-shrink-0 rounded-full border flex items-center justify-center z-10"
                style={{ background: `${color}18`, borderColor: `${color}40`, color }}
              >
                <TypeIcon type={i.type} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs font-semibold" style={{ color }}>{i.type}</span>
                  {i.type === InteractionType.EMAIL && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      isSent ? 'bg-outreach/10 text-outreach-light' : 'bg-partner/10 text-partner-light'
                    }`}>
                      {isSent ? '↑ Sent' : '↓ Received'}
                    </span>
                  )}
                  <span className="text-xs text-text-muted font-mono ml-auto">{formatTimeAgo(i.date)}</span>
                </div>

                {i.emailSubject && (
                  <div className="text-sm font-medium text-text-primary mb-1 truncate">{i.emailSubject}</div>
                )}

                {/* AI one-liner summary */}
                {hasBody && (
                  <div className="mb-1">
                    {emailSummaries[i.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-text-muted italic">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-outreach-light flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
                        </svg>
                        {emailSummaries[i.id]}
                      </span>
                    ) : loadingSummaries.has(i.id) ? (
                      <span className="text-xs text-text-muted italic animate-pulse">Summarizing…</span>
                    ) : onSummarizeEmail ? (
                      <button
                        onClick={() => handleSummarize(i.id, i.emailBody!)}
                        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-outreach-light transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Summarize
                      </button>
                    ) : null}
                  </div>
                )}

                {/* Body or notes */}
                <div className={`text-sm text-text-secondary leading-relaxed ${!expanded ? 'line-clamp-2' : ''}`}>
                  {expanded && hasBody ? (
                    <div className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary bg-base-900 rounded-lg p-3 mt-1 border border-base-600 max-h-56 overflow-y-auto">
                      {i.emailBody}
                    </div>
                  ) : (
                    <span>
                      {(i.notes || '').replace(`Subject: ${i.emailSubject}\n\n`, '') || i.notes}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-1.5">
                  {hasBody && (
                    <button
                      onClick={() => toggle(i.id)}
                      className="text-xs text-outreach-light hover:text-outreach transition-colors"
                    >
                      {expanded ? 'Collapse' : 'Read full email'}
                    </button>
                  )}
                  {i.type === InteractionType.EMAIL && i.gmailThreadId && onReply && !isSent && (
                    <button
                      onClick={() => onReply(i)}
                      className="text-xs text-partner-light hover:text-partner transition-colors flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Reply
                    </button>
                  )}
                  {i.outcome && i.outcome !== 'Synced from Gmail' && i.outcome !== 'Sent' && (
                    <span className="text-xs text-text-muted">· {i.outcome}</span>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
