
import React, { useState } from 'react';
import { EmailTemplate, TemplateType } from '../types';
import { EmailTemplateModal } from './EmailTemplateModal';

const TYPE_META: Record<TemplateType, { label: string; color: string; bg: string }> = {
  outreach:  { label: 'Outreach',  color: '#6366F1', bg: 'bg-outreach/10' },
  follow_up: { label: 'Follow-up', color: '#F59E0B', bg: 'bg-sold/10' },
  check_in:  { label: 'Check-in',  color: '#10B981', bg: 'bg-partner/10' },
  custom:    { label: 'Custom',    color: '#9BA3AF', bg: 'bg-base-700' },
};

interface EmailTemplateLibraryProps {
  templates: EmailTemplate[];
  onCreateTemplate: (template: Omit<EmailTemplate, 'id'>) => Promise<void>;
  onUpdateTemplate: (template: EmailTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="w-16 h-16 rounded-2xl bg-base-700 flex items-center justify-center mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>
    <h3 className="text-base font-semibold text-text-primary mb-1">No templates yet</h3>
    <p className="text-sm text-text-muted mb-6 max-w-xs">
      Create reusable email templates with personalization variables and A/B testing.
    </p>
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-4 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      Create First Template
    </button>
  </div>
);

interface TemplateCardProps {
  template: EmailTemplate;
  isVariantWinner?: boolean;
  onClick: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({ template, isVariantWinner, onClick }) => {
  const meta = TYPE_META[template.templateType] || TYPE_META.custom;
  const sendCount = template.sendCount || 0;
  const openCount = template.openCount || 0;
  const openRate = sendCount > 0 ? Math.round((openCount / sendCount) * 100) : null;

  return (
    <button
      onClick={onClick}
      className="group w-full bg-base-800 border border-base-600 rounded-xl p-4 text-left hover:border-base-500 transition-all duration-150 flex flex-col gap-2 relative"
    >
      {isVariantWinner && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-xs text-partner-light bg-partner/10 px-2 py-0.5 rounded-full border border-partner/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
          </svg>
          Winner
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-2 pr-16">
        <span
          className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-md ${meta.bg}`}
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
        {template.variantGroup && (
          <span className="text-xs text-text-muted bg-base-700 px-2 py-0.5 rounded-md border border-base-600 font-mono truncate max-w-[8rem]">
            {template.variantGroup}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="text-sm font-semibold text-text-primary group-hover:text-white transition-colors line-clamp-1">
        {template.name}
      </div>

      {/* Subject preview */}
      {template.subject && (
        <div className="text-xs text-text-muted line-clamp-1 font-mono">
          Subject: {template.subject}
        </div>
      )}

      {/* Body preview */}
      {template.body && (
        <div className="text-xs text-text-muted line-clamp-2 leading-relaxed">
          {template.body}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 mt-auto pt-2 border-t border-base-700">
        {sendCount > 0 ? (
          <>
            <span className="text-xs text-text-muted">
              <span className="text-text-secondary font-mono">{sendCount}</span> sent
            </span>
            <span className="text-xs text-text-muted">
              <span className="text-text-secondary font-mono">{openCount}</span> opens
            </span>
            {openRate !== null && (
              <span className="text-xs font-semibold" style={{ color: openRate >= 30 ? '#10B981' : openRate >= 15 ? '#F59E0B' : '#9BA3AF' }}>
                {openRate}% open rate
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-text-muted italic">Not yet sent</span>
        )}
        {/* Open rate bar */}
        {sendCount > 0 && openRate !== null && (
          <div className="ml-auto w-16 h-1 bg-base-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(openRate, 100)}%`,
                background: openRate >= 30 ? '#10B981' : openRate >= 15 ? '#F59E0B' : '#6366F1',
              }}
            />
          </div>
        )}
      </div>
    </button>
  );
};

// Group templates: separate solo templates from variant groups
interface VariantGroup {
  groupName: string;
  templates: EmailTemplate[];
  winnerIndex: number; // index with highest open rate
}

function groupTemplates(templates: EmailTemplate[]): {
  groups: VariantGroup[];
  solos: EmailTemplate[];
} {
  const byGroup: Record<string, EmailTemplate[]> = {};
  const solos: EmailTemplate[] = [];

  for (const t of templates) {
    if (t.variantGroup?.trim()) {
      const k = t.variantGroup.trim();
      byGroup[k] = byGroup[k] || [];
      byGroup[k].push(t);
    } else {
      solos.push(t);
    }
  }

  const groups: VariantGroup[] = Object.entries(byGroup).map(([groupName, ts]) => {
    let winnerIndex = 0;
    let bestRate = -1;
    ts.forEach((t, i) => {
      const sends = t.sendCount || 0;
      if (sends === 0) return;
      const rate = (t.openCount || 0) / sends;
      if (rate > bestRate) { bestRate = rate; winnerIndex = i; }
    });
    return { groupName, templates: ts, winnerIndex };
  });

  return { groups, solos };
}

const TYPE_ORDER: TemplateType[] = ['outreach', 'follow_up', 'check_in', 'custom'];

export const EmailTemplateLibrary: React.FC<EmailTemplateLibraryProps> = ({
  templates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}) => {
  const [modalTemplate, setModalTemplate] = useState<EmailTemplate | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<TemplateType | 'all'>('all');

  const openCreate = () => {
    setModalTemplate(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setModalTemplate(t);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalTemplate(undefined);
  };

  const handleSave = async (payload: Omit<EmailTemplate, 'id'> | EmailTemplate) => {
    if ('id' in payload) {
      await onUpdateTemplate(payload as EmailTemplate);
    } else {
      await onCreateTemplate(payload as Omit<EmailTemplate, 'id'>);
    }
  };

  const filtered = filterType === 'all' ? templates : templates.filter(t => t.templateType === filterType);
  const { groups, solos } = groupTemplates(filtered);

  // Sort solos by type order
  const sortedSolos = [...solos].sort((a, b) => {
    const ai = TYPE_ORDER.indexOf(a.templateType);
    const bi = TYPE_ORDER.indexOf(b.templateType);
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-600 flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Email Templates</h1>
          <p className="text-xs text-text-muted mt-0.5">
            {templates.length} template{templates.length !== 1 ? 's' : ''} · Reusable with A/B testing
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-outreach hover:bg-outreach-light text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Filter chips */}
      {templates.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-3 border-b border-base-700 flex-shrink-0">
          <button
            onClick={() => setFilterType('all')}
            className={`text-xs px-3 py-1 rounded-full transition-colors font-medium ${
              filterType === 'all'
                ? 'bg-base-600 text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            All ({templates.length})
          </button>
          {TYPE_ORDER.map(type => {
            const count = templates.filter(t => t.templateType === type).length;
            if (count === 0) return null;
            const meta = TYPE_META[type];
            return (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs px-3 py-1 rounded-full transition-colors font-medium ${
                  filterType === type
                    ? `${meta.bg} border`
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                style={filterType === type ? { color: meta.color, borderColor: `${meta.color}40` } : {}}
              >
                {meta.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {templates.length === 0 ? (
          <EmptyState onAdd={openCreate} />
        ) : (
          <div className="space-y-6">
            {/* A/B Variant groups */}
            {groups.map(group => (
              <div key={group.groupName}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">A/B Group</span>
                  <span className="text-xs font-mono text-outreach-light bg-outreach/10 px-2 py-0.5 rounded-md border border-outreach/20">
                    {group.groupName}
                  </span>
                  <div className="flex-1 h-px bg-base-700" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.templates.map((t, i) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      isVariantWinner={i === group.winnerIndex && (t.sendCount || 0) > 0}
                      onClick={() => openEdit(t)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Solo templates */}
            {sortedSolos.length > 0 && (
              <div>
                {groups.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold tracking-wider text-text-muted uppercase">Other Templates</span>
                    <div className="flex-1 h-px bg-base-700" />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedSolos.map(t => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      onClick={() => openEdit(t)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <EmailTemplateModal
          template={modalTemplate}
          onSave={handleSave}
          onDelete={modalTemplate ? onDeleteTemplate : undefined}
          onClose={closeModal}
        />
      )}
    </div>
  );
};
