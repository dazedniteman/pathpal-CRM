
import React, { useState, useEffect } from 'react';
import { AppSettings, GoogleAuthState, KanbanView, GmailIgnoreEntry, Project } from '../types';
import { TrashIcon, PlusIcon, PencilAltIcon, XCircleIcon, CheckCircleIcon } from './icons';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  googleAuthState: GoogleAuthState;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  // Phase 4: Project Flags
  projects?: Project[];
  onCreateProject?: (data: Omit<Project, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateProject?: (project: Project) => Promise<void>;
  onDeleteProject?: (projectId: string) => Promise<void>;
}

const Section: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="card-elevated p-6 space-y-4">
    <div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
    </div>
    {children}
  </div>
);

const AI_MODELS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini Flash (Fast · Recommended)', description: 'Best for everyday email drafts and quick suggestions' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini Pro (Powerful)', description: 'For complex outreach requiring deeper context and nuance' },
];

export const Settings: React.FC<SettingsProps> = ({
  settings, onSettingsChange, googleAuthState, onGoogleSignIn, onGoogleSignOut,
  projects = [], onCreateProject, onUpdateProject, onDeleteProject,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [editingView, setEditingView] = useState<Partial<KanbanView> | null>(null);

  // Project editing state
  type EditingProject = Partial<Omit<Project, 'id' | 'createdAt'>> & { id?: string };
  const [editingProject, setEditingProject] = useState<EditingProject | null>(null);

  // Gmail ignore list state
  const [newIgnoreValue, setNewIgnoreValue] = useState('');
  const [newIgnoreType, setNewIgnoreType] = useState<'email' | 'domain'>('email');

  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') finalValue = parseInt(value, 10);
    else if (type === 'checkbox') finalValue = (e.target as HTMLInputElement).checked;
    setLocalSettings(prev => ({ ...prev, [name]: finalValue }));
    setSaveStatus('idle');
  };

  const handlePipelineChange = (index: number, value: string) => {
    const newStages = [...localSettings.pipelineStages];
    newStages[index] = value;
    setLocalSettings(prev => ({ ...prev, pipelineStages: newStages }));
    setSaveStatus('idle');
  };

  const addPipelineStage = () => {
    setLocalSettings(prev => ({ ...prev, pipelineStages: [...prev.pipelineStages, 'New Stage'] }));
    setSaveStatus('idle');
  };

  const removePipelineStage = (index: number) => {
    if (localSettings.pipelineStages.length <= 1) { alert("You must have at least one pipeline stage."); return; }
    setLocalSettings(prev => ({ ...prev, pipelineStages: prev.pipelineStages.filter((_, i) => i !== index) }));
    setSaveStatus('idle');
  };

  const handleSave = () => {
    setSaveStatus('saving');
    onSettingsChange(localSettings);
    setTimeout(() => setSaveStatus('saved'), 800);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  // Kanban views
  const handleEditView = (view?: KanbanView) => {
    setEditingView(view ? { ...view } : { id: `view-${Date.now()}`, name: '', stages: [] });
  };
  const handleSaveView = () => {
    if (!editingView?.name || !editingView?.id) return;
    const newViews = [...(localSettings.kanbanViews || [])];
    const idx = newViews.findIndex(v => v.id === editingView.id);
    if (idx > -1) newViews[idx] = editingView as KanbanView;
    else newViews.push(editingView as KanbanView);
    setLocalSettings(prev => ({ ...prev, kanbanViews: newViews }));
    setEditingView(null);
    setSaveStatus('idle');
  };
  const handleEditingViewChange = (fieldName: keyof KanbanView, value: any) => {
    if (!editingView) return;
    if (fieldName === 'stages') {
      const curr = editingView.stages || [];
      setEditingView(prev => ({ ...prev, stages: curr.includes(value) ? curr.filter(s => s !== value) : [...curr, value] }));
    } else {
      setEditingView(prev => ({ ...prev, [fieldName]: value }));
    }
  };
  const handleDeleteView = (viewId: string) => {
    if (window.confirm("Delete this Kanban view?")) {
      setLocalSettings(prev => ({ ...prev, kanbanViews: (prev.kanbanViews || []).filter(v => v.id !== viewId) }));
      setSaveStatus('idle');
    }
  };

  // Gmail ignore list
  const addIgnoreEntry = () => {
    const val = newIgnoreValue.trim();
    if (!val) return;
    const existing = localSettings.gmailIgnoreList || [];
    if (existing.some(e => e.value === val && e.type === newIgnoreType)) return;
    const entry: GmailIgnoreEntry = { value: val, type: newIgnoreType, addedAt: new Date().toISOString() };
    setLocalSettings(prev => ({ ...prev, gmailIgnoreList: [...(prev.gmailIgnoreList || []), entry] }));
    setNewIgnoreValue('');
    setSaveStatus('idle');
  };
  const removeIgnoreEntry = (value: string, type: string) => {
    setLocalSettings(prev => ({
      ...prev,
      gmailIgnoreList: (prev.gmailIgnoreList || []).filter(e => !(e.value === value && e.type === type)),
    }));
    setSaveStatus('idle');
  };

  // Project handlers
  const handleEditProject = (project?: Project) => {
    setEditingProject(project
      ? { ...project }
      : { name: '', goal: '', followUpFrequencyDays: 7, isActive: true }
    );
  };
  const handleSaveProject = async () => {
    if (!editingProject?.name?.trim() || !editingProject?.goal?.trim()) return;
    const data = {
      name: editingProject.name.trim(),
      goal: editingProject.goal.trim(),
      followUpFrequencyDays: editingProject.followUpFrequencyDays ?? 7,
      isActive: editingProject.isActive ?? true,
    };
    if (editingProject.id) {
      await onUpdateProject?.({ ...data, id: editingProject.id } as Project);
    } else {
      await onCreateProject?.(data);
    }
    setEditingProject(null);
  };
  const handleDeleteProjectLocal = async (projectId: string) => {
    if (window.confirm('Delete this project? Contacts assigned to it will lose the association.')) {
      await onDeleteProject?.(projectId);
    }
  };

  const saveButtonLabel = saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : 'Save Settings';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-base-600">
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>
        <p className="text-sm text-text-muted mt-1">Configure PathPal CRM to match your workflow</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl">

        {/* AI Model */}
        <Section
          title="AI Model"
          description="Choose which Gemini model to use for email drafts and suggestions."
        >
          <div className="space-y-2">
            {AI_MODELS.map(model => (
              <label
                key={model.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  localSettings.defaultAiModel === model.value
                    ? 'border-outreach/50 bg-outreach-dim'
                    : 'border-base-600 bg-base-700 hover:border-base-500'
                }`}
              >
                <input
                  type="radio"
                  name="defaultAiModel"
                  value={model.value}
                  checked={localSettings.defaultAiModel === model.value}
                  onChange={handleInputChange}
                  className="mt-0.5 accent-outreach"
                />
                <div>
                  <p className="text-sm font-medium text-text-primary">{model.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{model.description}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* AI Context */}
        <Section
          title="AI Product Context"
          description="This background context is included in every AI prompt to make suggestions more relevant and personalized."
        >
          <textarea
            name="productContext"
            value={localSettings.productContext}
            onChange={handleInputChange}
            rows={5}
            className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50 resize-none"
            placeholder="Describe your product, target audience, and selling points…"
          />
        </Section>

        {/* Gmail Integration */}
        <Section
          title="Gmail Integration"
          description="Connect your Gmail account to sync emails and send from within PathPal CRM."
        >
          {/* How to get Client ID */}
          <details className="group">
            <summary className="flex items-center justify-between text-sm font-medium text-text-secondary cursor-pointer select-none list-none">
              <span>How to get your Google Client ID</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3 p-4 bg-base-700 border border-base-600 rounded-lg text-xs text-text-muted space-y-2">
              <ol className="list-decimal list-inside space-y-2">
                <li><strong className="text-text-secondary">Create Project</strong> at <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer" className="text-outreach-light hover:underline">Google Cloud Console</a></li>
                <li><strong className="text-text-secondary">Enable Gmail API</strong> in your project</li>
                <li><strong className="text-text-secondary">Configure OAuth Consent Screen</strong> → External → save</li>
                <li><strong className="text-text-secondary">Create Credentials</strong> → OAuth client ID → Web application</li>
                <li>Add <code className="bg-base-600 px-1 rounded">https://aistudio.google.com</code> as authorized origin</li>
                <li>Copy the Client ID and paste below</li>
              </ol>
            </div>
          </details>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Google Client ID</label>
            <input
              type="text"
              name="googleClientId"
              value={localSettings.googleClientId || ''}
              onChange={handleInputChange}
              className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50 font-mono"
              placeholder="Paste your Client ID here…"
            />
          </div>

          {googleAuthState.isAuthenticated && googleAuthState.profile ? (
            <div className="flex items-center justify-between p-3 bg-partner-dim border border-partner/30 rounded-lg">
              <div className="flex items-center gap-3">
                <img src={googleAuthState.profile.picture} alt="profile" className="w-8 h-8 rounded-full" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Connected to Gmail</p>
                  <p className="text-xs text-text-muted">{googleAuthState.profile.email}</p>
                </div>
              </div>
              <button onClick={onGoogleSignOut} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-colors">
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={onGoogleSignIn}
              disabled={!localSettings.googleClientId}
              className="flex items-center gap-2 px-4 py-2 bg-outreach-dim border border-outreach/30 text-outreach-light text-sm font-medium rounded-lg hover:bg-outreach/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 18h-2V9.25L12 13 6 9.25V18H4V6h1.2l6.8 4.25L18.8 6H20m0-2H4c-1.11 0-2 .89-2 2v12c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V6a2 2 0 0 0-2-2z"/>
              </svg>
              Connect to Gmail
            </button>
          )}
        </Section>

        {/* Gmail Ignore List */}
        <Section
          title="Gmail Ignore List"
          description="Emails from these addresses or domains won't appear in your Command Center as needing a reply."
        >
          {/* Newsletter auto-filter toggle */}
          <label className="flex items-center justify-between p-3 bg-base-700 border border-base-600 rounded-lg cursor-pointer">
            <div>
              <p className="text-sm font-medium text-text-primary">Newsletter auto-filter</p>
              <p className="text-xs text-text-muted mt-0.5">Automatically suppress newsletters, noreply, and automated emails</p>
            </div>
            <input
              type="checkbox"
              name="newsletterAutoFilter"
              checked={localSettings.newsletterAutoFilter !== false}
              onChange={handleInputChange}
              className="accent-outreach w-4 h-4"
            />
          </label>

          {/* Add entry */}
          <div className="flex gap-2">
            <select
              value={newIgnoreType}
              onChange={e => setNewIgnoreType(e.target.value as 'email' | 'domain')}
              className="bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-secondary outline-none focus:border-outreach/50"
            >
              <option value="email">Email</option>
              <option value="domain">Domain</option>
            </select>
            <input
              type="text"
              value={newIgnoreValue}
              onChange={e => setNewIgnoreValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addIgnoreEntry()}
              placeholder={newIgnoreType === 'email' ? 'someone@example.com' : 'example.com'}
              className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
            />
            <button
              onClick={addIgnoreEntry}
              className="px-3 py-2 bg-outreach-dim border border-outreach/30 text-outreach-light text-sm rounded-lg hover:bg-outreach/20 transition-colors"
            >
              <PlusIcon />
            </button>
          </div>

          {/* Ignore list entries */}
          {(localSettings.gmailIgnoreList || []).length > 0 ? (
            <div className="space-y-1.5">
              {(localSettings.gmailIgnoreList || []).map(entry => (
                <div key={`${entry.type}-${entry.value}`} className="flex items-center justify-between p-2.5 bg-base-700 border border-base-600 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-base-600 text-text-muted uppercase font-mono">{entry.type}</span>
                    <span className="text-sm text-text-secondary font-mono">{entry.value}</span>
                  </div>
                  <button
                    onClick={() => removeIgnoreEntry(entry.value, entry.type)}
                    className="text-text-muted hover:text-red-400 transition-colors"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">No entries yet. Add emails or domains to suppress.</p>
          )}
        </Section>

        {/* Follow-up defaults */}
        <Section
          title="Follow-up Defaults"
          description="Default number of days after last contact before someone appears in the follow-up list."
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              name="defaultFollowUpDays"
              value={localSettings.defaultFollowUpDays}
              onChange={handleInputChange}
              min={1}
              max={365}
              className="w-24 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-outreach/50 text-center"
            />
            <span className="text-sm text-text-muted">days</span>
          </div>
        </Section>

        {/* Pipeline stages */}
        <Section
          title="Pipeline Stages"
          description="Customize the stages in your outreach pipeline."
        >
          <div className="space-y-2">
            {localSettings.pipelineStages.map((stage, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={stage}
                  onChange={e => handlePipelineChange(index, e.target.value)}
                  className="flex-1 bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
                />
                <button
                  onClick={() => removePipelineStage(index)}
                  className="p-2 text-text-muted hover:text-red-400 transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
            <button
              onClick={addPipelineStage}
              className="flex items-center gap-2 text-sm text-outreach-light hover:text-outreach font-medium transition-colors"
            >
              <PlusIcon /> Add Stage
            </button>
          </div>
        </Section>

        {/* Kanban views */}
        <Section
          title="Kanban Board Views"
          description="Create filtered views to show only specific pipeline stages."
        >
          <div className="space-y-2">
            {(localSettings.kanbanViews || []).map(view => (
              <div key={view.id} className="flex items-center justify-between p-3 bg-base-700 border border-base-600 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-text-primary">{view.name}</p>
                  <p className="text-xs text-text-muted">{view.stages.join(', ')}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEditView(view)} className="text-text-muted hover:text-text-secondary transition-colors p-1"><PencilAltIcon /></button>
                  <button onClick={() => handleDeleteView(view.id)} className="text-text-muted hover:text-red-400 transition-colors p-1"><TrashIcon /></button>
                </div>
              </div>
            ))}

            {editingView && (
              <div className="p-4 bg-base-700 border border-outreach/30 rounded-lg space-y-3">
                <input
                  type="text"
                  placeholder="View name…"
                  value={editingView.name || ''}
                  onChange={e => handleEditingViewChange('name', e.target.value)}
                  className="w-full bg-base-600 border border-base-500 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
                />
                <div>
                  <p className="text-xs text-text-muted mb-2">Include stages:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {localSettings.pipelineStages.map(stage => (
                      <label key={stage} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(editingView.stages || []).includes(stage)}
                          onChange={() => handleEditingViewChange('stages', stage)}
                          className="accent-outreach"
                        />
                        {stage}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingView(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-base-600 text-text-muted rounded-lg hover:bg-base-500 transition-colors">
                    <XCircleIcon className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={handleSaveView} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-outreach-dim text-outreach-light border border-outreach/30 rounded-lg hover:bg-outreach/20 transition-colors">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Save View
                  </button>
                </div>
              </div>
            )}

            {!editingView && (
              <button onClick={() => handleEditView()} className="flex items-center gap-2 text-sm text-outreach-light hover:text-outreach font-medium transition-colors">
                <PlusIcon /> Add View
              </button>
            )}
          </div>
        </Section>

        {/* Projects */}
        <Section
          title="Projects"
          description="Define ongoing goals (e.g. 'Get 5 TrueStrike drill videos'). Assign projects to partner and customer contacts. The AI uses the project goal when drafting emails for that contact."
        >
          <div className="space-y-2">
            {projects.map(project => (
              <div key={project.id} className="flex items-start justify-between p-3 bg-base-700 border border-base-600 rounded-lg gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{project.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${project.isActive ? 'bg-partner-dim text-partner-light' : 'bg-base-600 text-text-muted'}`}>
                      {project.isActive ? 'active' : 'inactive'}
                    </span>
                    <span className="text-xs text-text-muted font-mono">{project.followUpFrequencyDays}d cadence</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{project.goal}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handleEditProject(project)} className="text-text-muted hover:text-text-secondary transition-colors p-1"><PencilAltIcon /></button>
                  <button onClick={() => handleDeleteProjectLocal(project.id)} className="text-text-muted hover:text-red-400 transition-colors p-1"><TrashIcon /></button>
                </div>
              </div>
            ))}

            {editingProject && (
              <div className="p-4 bg-base-700 border border-outreach/30 rounded-lg space-y-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Project name *</label>
                  <input
                    type="text"
                    value={editingProject.name || ''}
                    onChange={e => setEditingProject(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. TrueStrike Drill Videos"
                    className="w-full bg-base-600 border border-base-500 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Goal (injected into AI drafts) *</label>
                  <textarea
                    value={editingProject.goal || ''}
                    onChange={e => setEditingProject(prev => ({ ...prev, goal: e.target.value }))}
                    placeholder="e.g. We want Coach Sarah to record 3 TrueStrike drill videos for our YouTube channel."
                    rows={3}
                    className="w-full bg-base-600 border border-base-500 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-outreach/50 resize-none"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Follow-up cadence (days)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={editingProject.followUpFrequencyDays ?? 7}
                      onChange={e => setEditingProject(prev => ({ ...prev, followUpFrequencyDays: Math.max(1, parseInt(e.target.value) || 7) }))}
                      className="w-24 bg-base-600 border border-base-500 rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-outreach/50 text-center"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary mt-4">
                    <input
                      type="checkbox"
                      checked={editingProject.isActive ?? true}
                      onChange={e => setEditingProject(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="accent-outreach"
                    />
                    Active
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingProject(null)} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-base-600 text-text-muted rounded-lg hover:bg-base-500 transition-colors">
                    <XCircleIcon className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={handleSaveProject} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-outreach-dim text-outreach-light border border-outreach/30 rounded-lg hover:bg-outreach/20 transition-colors">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Save Project
                  </button>
                </div>
              </div>
            )}

            {!editingProject && (
              <button onClick={() => handleEditProject()} className="flex items-center gap-2 text-sm text-outreach-light hover:text-outreach font-medium transition-colors">
                <PlusIcon /> Add Project
              </button>
            )}
          </div>
        </Section>

        {/* Email Tracking */}
        <Section
          title="Email Open Tracking"
          description="Track when recipients open your emails. Requires a Supabase Edge Function — see deployment instructions below."
        >
          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text-primary">Enable open tracking</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Injects a 1×1 pixel into sent emails. Switch to HTML content-type automatically.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocalSettings(prev => ({ ...prev, emailTrackingEnabled: !prev.emailTrackingEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  localSettings.emailTrackingEnabled ? 'bg-outreach' : 'bg-base-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.emailTrackingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Supabase project ref */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Supabase Project Ref
                <span className="ml-1.5 text-text-muted font-normal">(the subdomain in your Supabase URL)</span>
              </label>
              <input
                type="text"
                name="supabaseProjectRef"
                value={localSettings.supabaseProjectRef || ''}
                onChange={handleInputChange}
                placeholder="abcdefghijklmnop"
                className="w-full bg-base-700 border border-base-600 rounded-lg px-3 py-2 text-sm text-text-primary font-mono placeholder-text-muted outline-none focus:border-outreach/50"
              />
              <p className="mt-1 text-xs text-text-muted">
                Found at: <span className="font-mono text-outreach-light">https://supabase.com/dashboard/project/[THIS_VALUE]</span>
              </p>
            </div>

            {/* Deployment instructions */}
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-outreach-light hover:text-outreach transition-colors list-none flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                How to deploy the Edge Function
              </summary>
              <div className="mt-3 space-y-2 text-xs text-text-muted leading-relaxed bg-base-900 rounded-lg p-4 border border-base-700">
                <p className="font-medium text-text-secondary">One-time setup (requires Supabase CLI):</p>
                <ol className="list-decimal list-inside space-y-1.5 ml-1">
                  <li>Install Supabase CLI: <span className="font-mono text-text-secondary">npm install -g supabase</span></li>
                  <li>Login: <span className="font-mono text-text-secondary">npx supabase login</span></li>
                  <li>Link project: <span className="font-mono text-text-secondary">npx supabase link --project-ref [YOUR_REF]</span></li>
                  <li>Deploy function: <span className="font-mono text-text-secondary">npx supabase functions deploy track-open</span></li>
                </ol>
                <p className="mt-2 text-text-muted">The Edge Function is at <span className="font-mono text-outreach-light">supabase/functions/track-open/index.ts</span> in your project.</p>
                <p className="text-text-muted">Once deployed, paste your Project Ref above and enable tracking to start seeing open events in contact timelines.</p>
              </div>
            </details>
          </div>
        </Section>

        {/* Save button */}
        <div className="flex justify-end pb-6">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`px-6 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              saveStatus === 'saved'
                ? 'bg-partner text-white'
                : 'bg-outreach hover:bg-outreach-light text-white'
            } disabled:opacity-50`}
          >
            {saveButtonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
