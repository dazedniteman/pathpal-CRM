import React, { useState, useEffect } from 'react';
import { Sequence, SequenceStep, SequenceStepActionType, EmailTemplate } from '../types';

interface SequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sequence?: Sequence;  // undefined = create mode
  templates: EmailTemplate[];
  pipelineStages: string[];
  onCreate: (data: Omit<Sequence, 'id' | 'createdAt'>) => Promise<void>;
  onUpdate: (seq: Sequence) => Promise<void>;
  onDelete: (seqId: string) => Promise<void>;
}

const makeStep = (dayOffset = 0): SequenceStep => ({
  id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  dayOffset,
  actionType: 'email_draft',
  description: 'Send follow-up email',
});

const autoDescription = (step: SequenceStep, templates: EmailTemplate[]): string => {
  if (step.actionType === 'email_draft') {
    if (step.templateId) {
      const t = templates.find(t => t.id === step.templateId);
      return t ? `Send "${t.name}"` : 'Send email from template';
    }
    return 'Send follow-up email';
  }
  if (step.actionType === 'task') return step.taskTitle || 'Complete task';
  if (step.actionType === 'note') return (step.noteText || '').slice(0, 50) || 'Add note';
  return '';
};

export const SequenceModal: React.FC<SequenceModalProps> = ({
  isOpen,
  onClose,
  sequence,
  templates,
  pipelineStages,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const isEdit = !!sequence;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerStage, setTriggerStage] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<SequenceStep[]>([makeStep(0)]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(sequence?.name || '');
      setDescription(sequence?.description || '');
      setTriggerStage(sequence?.triggerStage || '');
      setIsActive(sequence?.isActive ?? true);
      setSteps(sequence?.steps?.length ? sequence.steps : [makeStep(0)]);
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, sequence]);

  if (!isOpen) return null;

  // --- Step helpers ---
  const updateStep = (idx: number, patch: Partial<SequenceStep>) => {
    setSteps(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      const updated = { ...s, ...patch };
      // Auto-update description when key fields change (unless user manually typed it)
      const autoDesc = autoDescription({ ...updated }, templates);
      return { ...updated, description: autoDesc };
    }));
  };

  const addStep = () => {
    const lastOffset = steps.length > 0 ? steps[steps.length - 1].dayOffset : 0;
    setSteps(prev => [...prev, makeStep(lastOffset + 5)]);
  };

  const removeStep = (idx: number) => {
    setSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= steps.length) return;
    setSteps(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  // --- Validation & Save ---
  const validate = (): string => {
    if (!name.trim()) return 'Sequence name is required.';
    if (steps.length === 0) return 'At least one step is required.';
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.dayOffset < 0 || !Number.isInteger(s.dayOffset)) return `Step ${i + 1}: Day offset must be a non-negative integer.`;
      if (s.actionType === 'task' && !s.taskTitle?.trim()) return `Step ${i + 1}: Task steps require a task title.`;
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setIsSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        triggerStage: triggerStage || undefined,
        isActive,
        steps,
      };
      if (isEdit && sequence) {
        await onUpdate({ ...sequence, ...payload });
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save sequence. Please try again.');
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sequence) return;
    if (!window.confirm(`Delete "${sequence.name}"? This will also remove all contact enrollments.`)) return;
    try {
      await onDelete(sequence.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete sequence.');
    }
  };

  const actionLabel: Record<SequenceStepActionType, string> = {
    email_draft: 'Email',
    task: 'Task',
    note: 'Note',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onKeyDown={e => e.key === 'Escape' && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-base-600 shadow-2xl flex flex-col"
        style={{ background: '#111318', maxHeight: '92vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-600 flex-shrink-0">
          <h2 className="text-base font-semibold text-text-primary">
            {isEdit ? 'Edit Sequence' : 'New Sequence'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Metadata */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-text-muted mb-1 block">Sequence Name <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Cold Outreach, Partnership Follow-up"
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-muted mb-1 block">Description</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description of this sequence's purpose"
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-text-muted mb-1 block">Auto-enroll trigger</label>
                <select
                  value={triggerStage}
                  onChange={e => setTriggerStage(e.target.value)}
                  className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach transition-colors"
                >
                  <option value="">No trigger (manual enroll only)</option>
                  {pipelineStages.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsActive(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${isActive ? 'bg-outreach' : 'bg-base-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-xs text-text-muted">{isActive ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
          </div>

          {/* Step Builder */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Steps</label>
              <span className="text-xs text-text-muted font-mono">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="bg-base-700 border border-base-600 rounded-xl p-4 space-y-3"
                >
                  {/* Step header row */}
                  <div className="flex items-center gap-2">
                    {/* Day offset */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs text-text-muted">Day</span>
                      <input
                        type="number"
                        min={0}
                        value={step.dayOffset}
                        onChange={e => updateStep(idx, { dayOffset: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-14 bg-base-800 border border-base-600 rounded px-2 py-1 text-xs text-text-primary text-center outline-none focus:border-outreach"
                      />
                    </div>

                    {/* Action type */}
                    <div className="flex items-center gap-1 flex-1">
                      {(['email_draft', 'task', 'note'] as SequenceStepActionType[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateStep(idx, { actionType: type })}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                            step.actionType === type
                              ? 'bg-outreach text-white'
                              : 'bg-base-800 text-text-muted hover:text-text-primary border border-base-600'
                          }`}
                        >
                          {actionLabel[type]}
                        </button>
                      ))}
                    </div>

                    {/* Reorder & remove */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => moveStep(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                        title="Move up"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStep(idx, 1)}
                        disabled={idx === steps.length - 1}
                        className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                        title="Move down"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(idx)}
                        className="p-1 text-text-muted hover:text-red-400 transition-colors"
                        title="Remove step"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Conditional fields */}
                  {step.actionType === 'email_draft' && (
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Template (optional)</label>
                      <select
                        value={step.templateId || ''}
                        onChange={e => updateStep(idx, { templateId: e.target.value || undefined })}
                        className="w-full bg-base-800 border border-base-600 rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-outreach transition-colors"
                      >
                        <option value="">No template — compose fresh</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {step.actionType === 'task' && (
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Task title <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={step.taskTitle || ''}
                        onChange={e => updateStep(idx, { taskTitle: e.target.value })}
                        placeholder="e.g. Call to discuss collaboration"
                        className="w-full bg-base-800 border border-base-600 rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-outreach transition-colors"
                      />
                    </div>
                  )}

                  {step.actionType === 'note' && (
                    <div>
                      <label className="text-xs text-text-muted mb-1 block">Note / reminder text</label>
                      <textarea
                        value={step.noteText || ''}
                        onChange={e => updateStep(idx, { noteText: e.target.value })}
                        placeholder="Reminder or note to review before contacting..."
                        rows={2}
                        className="w-full bg-base-800 border border-base-600 rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-outreach transition-colors resize-none"
                      />
                    </div>
                  )}

                  {/* Description (editable label) */}
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Step label</label>
                    <input
                      type="text"
                      value={step.description}
                      onChange={e => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                      placeholder="Short label shown in dashboard..."
                      className="w-full bg-base-800 border border-base-600 rounded-lg px-3 py-1.5 text-xs text-text-primary outline-none focus:border-outreach transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Step */}
            <button
              type="button"
              onClick={addStep}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-base-600 rounded-xl text-sm text-text-muted hover:text-text-primary hover:border-base-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Step
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-base-600 flex-shrink-0">
          <div>
            {isEdit && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary bg-base-700 hover:bg-base-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-sm font-semibold text-white bg-outreach hover:bg-outreach-light rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Sequence'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
