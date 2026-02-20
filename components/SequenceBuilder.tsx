import React, { useState } from 'react';
import { Sequence, ContactSequence, EmailTemplate } from '../types';
import { SequenceModal } from './SequenceModal';

interface SequenceBuilderProps {
  sequences: Sequence[];
  templates: EmailTemplate[];
  pipelineStages: string[];
  enrollments: ContactSequence[];
  onCreate: (data: Omit<Sequence, 'id' | 'createdAt'>) => Promise<void>;
  onUpdate: (seq: Sequence) => Promise<void>;
  onDelete: (seqId: string) => Promise<void>;
}

export const SequenceBuilder: React.FC<SequenceBuilderProps> = ({
  sequences,
  templates,
  pipelineStages,
  enrollments,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | undefined>(undefined);

  const openCreate = () => {
    setEditingSequence(undefined);
    setIsModalOpen(true);
  };

  const openEdit = (seq: Sequence) => {
    setEditingSequence(seq);
    setIsModalOpen(true);
  };

  const getStepRange = (seq: Sequence): string => {
    if (seq.steps.length === 0) return 'No steps';
    const offsets = seq.steps.map(s => s.dayOffset).sort((a, b) => a - b);
    if (offsets.length === 1) return `Day ${offsets[0]}`;
    return `Day ${offsets[0]}–${offsets[offsets.length - 1]}`;
  };

  const getActiveEnrollmentCount = (seqId: string): number =>
    enrollments.filter(e => e.sequenceId === seqId).length;

  return (
    <div className="flex-1 overflow-auto p-6">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Follow-up Sequences</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Automate time-based outreach steps that trigger when contacts enter a pipeline stage.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-outreach hover:bg-outreach-light rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Sequence
        </button>
      </div>

      {/* Sequence list */}
      {sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-base-700 border border-base-600 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10M16 14l4 4-4 4" />
            </svg>
          </div>
          <p className="text-text-primary font-medium">No sequences yet</p>
          <p className="text-sm text-text-muted mt-1 max-w-xs">
            Create your first sequence to automate follow-ups for contacts as they move through your pipeline.
          </p>
          <button
            onClick={openCreate}
            className="mt-4 px-4 py-2 text-sm font-medium text-outreach-light bg-outreach/10 hover:bg-outreach/20 border border-outreach/20 rounded-lg transition-colors"
          >
            Create first sequence
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const enrollCount = getActiveEnrollmentCount(seq.id);
            return (
              <div
                key={seq.id}
                className="bg-base-800 border border-base-600 rounded-xl p-4 hover:border-base-500 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{seq.name}</span>

                      {/* Trigger badge */}
                      {seq.triggerStage ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: '#7C3AED22', color: '#8B5CF6' }}>
                          ⚡ {seq.triggerStage}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-base-700 text-text-muted">
                          Manual only
                        </span>
                      )}

                      {/* Active/inactive badge */}
                      {!seq.isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-base-700 text-text-muted">
                          Inactive
                        </span>
                      )}
                    </div>

                    {seq.description && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">{seq.description}</p>
                    )}

                    {/* Step + enrollment meta */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-text-muted font-mono">
                        {seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''} · {getStepRange(seq)}
                      </span>
                      {enrollCount > 0 && (
                        <span className="text-xs font-medium text-outreach-light bg-outreach/10 px-2 py-0.5 rounded-md border border-outreach/20">
                          {enrollCount} contact{enrollCount !== 1 ? 's' : ''} active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Step preview chips */}
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                    {seq.steps.slice(0, 4).map((step, i) => (
                      <div key={step.id} className="flex items-center gap-1">
                        {i > 0 && <div className="w-3 h-px bg-base-600" />}
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs border border-base-600"
                          style={{ background: '#1a1d24' }}
                          title={`Day ${step.dayOffset}: ${step.description}`}
                        >
                          {step.actionType === 'email_draft' && '✉'}
                          {step.actionType === 'task' && '✓'}
                          {step.actionType === 'note' && '📝'}
                        </div>
                      </div>
                    ))}
                    {seq.steps.length > 4 && (
                      <span className="text-xs text-text-muted ml-1">+{seq.steps.length - 4}</span>
                    )}
                  </div>

                  {/* Active toggle */}
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...seq, isActive: !seq.isActive })}
                    className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${seq.isActive ? 'bg-outreach' : 'bg-base-600'}`}
                    title={seq.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${seq.isActive ? 'translate-x-4' : ''}`} />
                  </button>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(seq)}
                    className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-base-700 hover:bg-base-600 border border-base-600 rounded-lg transition-colors flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <SequenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sequence={editingSequence}
        templates={templates}
        pipelineStages={pipelineStages}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
};
