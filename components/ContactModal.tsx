

import React, { useState, useEffect } from 'react';
import { Contact, Interaction, InteractionType, AppSettings, PartnershipType, PartnerDetails, Task } from '../types';
import { getFollowUpSuggestion } from '../services/geminiService';
import { AtSymbolIcon, CalendarIcon, CloseIcon, LinkIcon, LocationMarkerIcon, PencilAltIcon, PhoneIcon, RefreshIcon, SparklesIcon, UsersIcon, TagIcon, PlusIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from './icons';

interface ContactModalProps {
  contact: Contact;
  onClose: () => void;
  onUpdate: (contact: Contact) => void;
  onAddInteraction: (contactId: string, interaction: Interaction) => void;
  onSyncGmail: (contact: Contact) => Promise<void>;
  isGmailConnected: boolean;
  settings: AppSettings;
  tasks: Task[];
  onTaskAdd: (task: Omit<Task, 'id'>) => void;
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onDelete: (contactId: string) => void;
}

const DEFAULT_PARTNER_DETAILS: PartnerDetails = { contractSigned: false, continueFollowUp: false, drillVideosAgreed: 0, drillVideosDelivered: 0, drillVideoLinks: [], testimonialVideoAgreed: false, testimonialVideoDelivered: false, testimonialVideoLink: '', websiteLinkAgreed: false, websiteLinkDelivered: false, websiteLinkUrl: '', socialPostAgreed: false, socialPostDelivered: false, socialPostLink: '' };

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => ( <button onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${ active ? 'bg-accent text-white' : 'bg-secondary text-text-secondary hover:bg-accent/50' }`}>{children}</button> );
const DeliverableRow: React.FC<{ label: string; agreed: boolean; delivered: boolean; onAgreedChange: (value: boolean) => void; onDeliveredChange: (value: boolean) => void; isDirty: boolean; }> = ({ label, agreed, delivered, onAgreedChange, onDeliveredChange, isDirty }) => ( <div className={`flex justify-between items-center p-3 bg-accent rounded-md transition-all ${isDirty ? 'ring-2 ring-highlight' : ''}`}> <span className="font-medium text-white text-sm">{label}</span> <div className="flex items-center space-x-6"> <label className="flex items-center space-x-2 cursor-pointer text-xs"><input type="checkbox" checked={agreed} onChange={e => onAgreedChange(e.target.checked)} className="form-checkbox bg-primary text-highlight focus:ring-highlight" /><span>Agreed</span></label> <label className="flex items-center space-x-2 cursor-pointer text-xs"><input type="checkbox" checked={delivered} onChange={e => onDeliveredChange(e.target.checked)} disabled={!agreed} className="form-checkbox bg-primary text-highlight focus:ring-highlight disabled:opacity-50" /><span>Delivered</span></label> </div> </div> );

export const ContactModal: React.FC<ContactModalProps> = ({ contact, onClose, onUpdate, onAddInteraction, onSyncGmail, isGmailConnected, settings, tasks, onTaskAdd, onTaskUpdate, onTaskDelete, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'interactions' | 'tasks' | 'ai' | 'partnership'>('interactions');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditingDealType, setIsEditingDealType] = useState(false);
  const [error, setError] = useState('');
  const [newInteractionNotes, setNewInteractionNotes] = useState('');
  const [editableContact, setEditableContact] = useState<Contact>(contact);
  const [tagInput, setTagInput] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => { 
      setEditableContact(contact); 
      setIsEditingDealType(false); 
      
      // Set the default tab when a new contact is opened
      if (contact.partnershipType === PartnershipType.PARTNER) {
        setActiveTab('partnership');
      } else {
        setActiveTab('interactions');
      }
  }, [contact]);

  useEffect(() => { setIsDirty(JSON.stringify(contact) !== JSON.stringify(editableContact)); }, [contact, editableContact]);


  const handleUpdate = (updatedData: Partial<Contact>) => { const updatedContact = { ...editableContact, ...updatedData }; setEditableContact(updatedContact); };
  const handlePartnerDetailChange = (field: keyof PartnerDetails, value: any) => { handleUpdate({ partnerDetails: { ...(editableContact.partnerDetails || DEFAULT_PARTNER_DETAILS), [field]: value } }); };
  const handleGenerateSuggestion = async () => { setIsLoadingAi(true); setError(''); setAiSuggestion(''); try { const s = await getFollowUpSuggestion(contact, settings.productContext, contact.tags); setAiSuggestion(s); } catch (e) { setError('Failed to generate.'); } finally { setIsLoadingAi(false); } };
  const [aiSuggestion, setAiSuggestion] = useState('');
  const handleAddNote = () => { if (!newInteractionNotes.trim()) return; onAddInteraction(contact.id, { id: `int-${Date.now()}`, type: InteractionType.NOTE, date: new Date().toISOString(), notes: newInteractionNotes }); setNewInteractionNotes(''); };
  const handleGmailSync = async () => { setIsSyncing(true); await onSyncGmail(contact); setIsSyncing(false); };

  const handleFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let finalValue: any = value;
    if (type === 'number') {
        finalValue = value ? parseInt(value, 10) : undefined;
    } else if (type === 'date') {
        finalValue = value ? new Date(value).toISOString() : undefined;
    }
    handleUpdate({ [name]: finalValue });
  };
  
  const igLink = contact.instagramHandle ? `https://instagram.com/${contact.instagramHandle.replace('@', '')}` : '#';
  const classifyDeal = (type: PartnershipType) => { const update: Partial<Contact> = { partnershipType: type }; if (type === PartnershipType.PARTNER && !contact.partnerDetails) { update.partnerDetails = DEFAULT_PARTNER_DETAILS; } handleUpdate(update); setIsEditingDealType(false); };
  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const newTag = tagInput.trim(); if (newTag) { const updatedTags = Array.from(new Set([...(editableContact.tags || []), newTag])); handleUpdate({ tags: updatedTags }); } setTagInput(''); } };
  const removeTag = (tagToRemove: string) => { const updatedTags = (editableContact.tags || []).filter(tag => tag !== tagToRemove); handleUpdate({ tags: updatedTags }); };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !newTaskDueDate) return;
    onTaskAdd({ title: newTaskTitle, dueDate: newTaskDueDate, completed: false, contactId: contact.id });
    setNewTaskTitle('');
    setNewTaskDueDate('');
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${contact.name}? This action cannot be undone.`)) {
      onDelete(contact.id);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = () => {
    onUpdate(editableContact);
  };
  
  const isFieldDirtyCheck = (fieldName: keyof Contact, isNested: boolean = false) => {
      if (isNested) {
          // This is a simplified check for partnerDetails
          return JSON.stringify(editableContact.partnerDetails) !== JSON.stringify(contact.partnerDetails);
      }
      return editableContact[fieldName] !== contact[fieldName];
  };

  const renderTabs = () => (
    <div className="md:col-span-2 flex flex-col">
        <div className="border-b border-accent -mt-2">
            <TabButton active={activeTab === 'interactions'} onClick={() => setActiveTab('interactions')}>History</TabButton>
            <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')}>Tasks ({tasks.length})</TabButton>
            {editableContact.partnershipType === PartnershipType.PARTNER && <TabButton active={activeTab === 'partnership'} onClick={() => setActiveTab('partnership')}>Partnership Details</TabButton>}
            <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')}>AI Assistant</TabButton>
        </div>
        {activeTab === 'interactions' && renderInteractions()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'ai' && renderAIAssistant()}
        {activeTab === 'partnership' && renderPartnershipDetails()}
    </div>
  );

  const renderInteractions = () => ( <div className="md:col-span-1 flex flex-col flex-grow mt-4"> <div className="flex justify-between items-center mb-4"> <h4 className="font-semibold text-white">Communication History</h4> <button onClick={handleGmailSync} title="Sync with Gmail" disabled={!isGmailConnected || isSyncing} className="flex items-center text-xs bg-primary px-2 py-1 rounded hover:bg-highlight disabled:bg-gray-500 disabled:cursor-not-allowed"><RefreshIcon /><span className="ml-1">{isSyncing ? 'Syncing...' : 'Sync Gmail'}</span></button> </div> <div className="flex-grow space-y-4 overflow-y-auto pr-2 bg-primary p-2 rounded-md"> {contact.interactions.length > 0 ? [...contact.interactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(int => ( <div key={int.id} className="text-sm"><div className="flex items-center space-x-2 text-text-secondary"><CalendarIcon /><span>{new Date(int.date).toLocaleString()}</span><span className="font-bold text-white">{int.type}</span></div><p className="ml-6 border-l-2 border-accent pl-3 mt-1 text-white whitespace-pre-wrap">{int.notes}</p></div> )) : <p className="text-text-secondary text-sm">No interactions logged yet.</p>}</div> <div className="mt-4"><textarea value={newInteractionNotes} onChange={(e) => setNewInteractionNotes(e.target.value)} placeholder="Log a new call, meeting, or note..." className="w-full bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" rows={2}></textarea><button onClick={handleAddNote} className="mt-2 w-full bg-highlight text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-500">Add Log</button></div> </div> );
  const renderAIAssistant = () => ( <div className="md:col-span-1 bg-accent p-4 rounded-lg flex flex-col flex-grow mt-4"> <h4 className="text-lg font-semibold text-white mb-4 flex items-center"><SparklesIcon /><span className="ml-2">AI Follow-up Assistant</span></h4> <div className="flex-grow bg-primary p-3 rounded-md text-sm text-text-secondary overflow-y-auto whitespace-pre-wrap">{isLoadingAi ? 'Generating...' : error ? <p className="text-red-400">{error}</p> : aiSuggestion || 'Click the button below to generate a personalized follow-up email suggestion.'}</div><button onClick={handleGenerateSuggestion} disabled={isLoadingAi} className="mt-4 w-full flex justify-center items-center bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500 disabled:bg-gray-500">{isLoadingAi ? 'Thinking...' : 'Generate Suggestion'}</button></div> );
  const renderPartnershipDetails = () => ( <div className="space-y-4 overflow-y-auto pr-2 mt-4 flex-grow bg-primary p-3 rounded-md"> {editableContact.partnerDetails && (<> <div className="grid grid-cols-2 gap-4"><label className={`flex items-center space-x-2 cursor-pointer p-2 rounded-md transition-all ${isFieldDirtyCheck('partnerDetails', true) ? 'ring-2 ring-highlight' : ''}`}><input type="checkbox" checked={editableContact.partnerDetails.contractSigned} onChange={e => handlePartnerDetailChange('contractSigned', e.target.checked)} className="form-checkbox bg-accent text-highlight focus:ring-highlight" /><span>Contract Signed</span></label><label className={`flex items-center space-x-2 cursor-pointer p-2 rounded-md transition-all ${isFieldDirtyCheck('partnerDetails', true) ? 'ring-2 ring-highlight' : ''}`}><input type="checkbox" checked={editableContact.partnerDetails.continueFollowUp} onChange={e => handlePartnerDetailChange('continueFollowUp', e.target.checked)} className="form-checkbox bg-accent text-highlight focus:ring-highlight" /><span>Continue Follow-ups</span></label></div> <div className="border-t border-accent pt-4"><h5 className="font-semibold text-white mb-2">Deliverables</h5><div className="space-y-3"><div className={`p-3 bg-accent rounded-md transition-all ${isFieldDirtyCheck('partnerDetails', true) ? 'ring-2 ring-highlight' : ''}`}><div className="flex justify-between items-center"><span className="font-medium text-white text-sm">Drill Videos:</span><div className="flex items-center space-x-2"><input type="number" value={editableContact.partnerDetails.drillVideosDelivered} onChange={e => handlePartnerDetailChange('drillVideosDelivered', Math.max(0, parseInt(e.target.value)))} className="w-16 bg-primary p-1 rounded text-center" /><span className="text-text-secondary">/</span><input type="number" value={editableContact.partnerDetails.drillVideosAgreed} onChange={e => handlePartnerDetailChange('drillVideosAgreed', Math.max(0, parseInt(e.target.value)))} className="w-16 bg-primary p-1 rounded text-center" /></div></div></div><DeliverableRow isDirty={isFieldDirtyCheck('partnerDetails', true)} label="Testimonial Video" agreed={editableContact.partnerDetails.testimonialVideoAgreed} delivered={editableContact.partnerDetails.testimonialVideoDelivered} onAgreedChange={val => handlePartnerDetailChange('testimonialVideoAgreed', val)} onDeliveredChange={val => handlePartnerDetailChange('testimonialVideoDelivered', val)} /><DeliverableRow isDirty={isFieldDirtyCheck('partnerDetails', true)} label="Website Link" agreed={editableContact.partnerDetails.websiteLinkAgreed} delivered={editableContact.partnerDetails.websiteLinkDelivered} onAgreedChange={val => handlePartnerDetailChange('websiteLinkAgreed', val)} onDeliveredChange={val => handlePartnerDetailChange('websiteLinkDelivered', val)} /><DeliverableRow isDirty={isFieldDirtyCheck('partnerDetails', true)} label="Social Media Post" agreed={editableContact.partnerDetails.socialPostAgreed} delivered={editableContact.partnerDetails.socialPostDelivered} onAgreedChange={val => handlePartnerDetailChange('socialPostAgreed', val)} onDeliveredChange={val => handlePartnerDetailChange('socialPostDelivered', val)} /></div></div> <div className="border-t border-accent pt-4"><h5 className="font-semibold text-white mb-2">Deliverable Links</h5><input type="text" placeholder="Testimonial Video URL" value={editableContact.partnerDetails.testimonialVideoLink} onChange={e => handlePartnerDetailChange('testimonialVideoLink', e.target.value)} className={`w-full bg-accent p-2 rounded mb-2 text-sm ${isFieldDirtyCheck('partnerDetails', true) ? 'ring-2 ring-highlight' : ''}`} /><input type="text" placeholder="Website Link URL" value={editableContact.partnerDetails.websiteLinkUrl} onChange={e => handlePartnerDetailChange('websiteLinkUrl', e.target.value)} className={`w-full bg-accent p-2 rounded mb-2 text-sm ${isFieldDirtyCheck('partnerDetails', true) ? 'ring-2 ring-highlight' : ''}`} /><input type="text" placeholder="Social Post URL" value={editableContact.partnerDetails.socialPostLink} onChange={e => handlePartnerDetailChange('socialPostLink', e.target.value)} className={`w-full bg-accent p-2 rounded text-sm ${isFieldDirtyCheck('partnerDetails', true) ? 'ring-2 ring-highlight' : ''}`} /></div> </>)}</div> );
  const renderTasks = () => ( <div className="md:col-span-1 flex flex-col flex-grow mt-4"> <h4 className="font-semibold text-white mb-4">Tasks for {contact.name}</h4> <div className="flex-grow space-y-2 overflow-y-auto pr-2 bg-primary p-2 rounded-md"> {tasks.length > 0 ? tasks.map(task => ( <div key={task.id} className="flex items-center justify-between bg-accent p-2 rounded"> <label className="flex items-center space-x-3"> <input type="checkbox" checked={task.completed} onChange={e => onTaskUpdate({...task, completed: e.target.checked})} className="form-checkbox bg-primary text-highlight focus:ring-highlight" /> <span className={`text-sm ${task.completed ? 'line-through text-text-secondary' : 'text-white'}`}>{task.title}</span> </label> <div className="flex items-center space-x-2"> <span className="text-xs text-text-secondary">{new Date(task.dueDate).toLocaleDateString()}</span> <button onClick={() => onTaskDelete(task.id)} className="text-red-400 hover:text-red-300"><TrashIcon /></button> </div> </div> )) : <p className="text-text-secondary text-sm">No tasks for this contact.</p>} </div> <div className="mt-4 border-t border-accent pt-4"> <h5 className="text-white font-semibold text-sm mb-2">Add New Task</h5> <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"> <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task description..." className="sm:col-span-2 w-full bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" /> <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" /> </div> <button onClick={handleAddTask} className="mt-2 w-full bg-highlight text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-500">Add Task</button> </div> </div> );
  const EditableField: React.FC<{name: keyof Contact, value: any, label: string, type?: string, icon?: React.ReactNode}> = ({ name, value, label, type='text', icon}) => {
      const dirty = isFieldDirtyCheck(name);
      return (
    <div>
        <label className="text-xs text-text-secondary">{label}</label>
        <div className="relative">
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">{icon}</div>}
            <input type={type} name={name} value={value || ''} onChange={handleFieldChange} placeholder={label} className={`w-full bg-accent p-2 rounded text-white text-sm transition-all ${icon ? 'pl-9' : ''} ${dirty ? 'ring-2 ring-highlight' : ''}`}/>
        </div>
    </div>
  )};

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-6 border-b border-accent flex justify-between items-center"><h2 className="text-2xl font-bold text-white">Contact Details</h2><button onClick={handleClose} className="text-text-secondary hover:text-white transition-colors"><CloseIcon /></button></div>
        <div className="flex-grow overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center space-x-4">
              <img src={contact.avatarUrl} alt={contact.name} className="w-20 h-20 rounded-full" />
              <div>
                <input type="text" name="name" value={editableContact.name} onChange={handleFieldChange} className={`bg-transparent text-xl font-bold text-white w-full rounded p-1 transition-all ${isFieldDirtyCheck('name') ? 'ring-2 ring-highlight' : ''}`}/>
                <select name="pipelineStage" value={editableContact.pipelineStage} onChange={handleFieldChange} className={`mt-1 bg-accent text-white text-xs rounded-full px-2 py-1 border-transparent outline-none transition-all ${isFieldDirtyCheck('pipelineStage') ? 'ring-2 ring-highlight' : 'focus:ring-2 focus:ring-white'}`}>{settings.pipelineStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select>
              </div>
            </div>
            {(editableContact.pipelineStage === 'Closed - Success' && !editableContact.partnershipType && !isEditingDealType) && ( <div className="bg-highlight/20 p-3 rounded-md text-center"><p className="text-sm text-white mb-2 font-semibold">Classify this successful deal:</p><div className="flex justify-center space-x-2"><button onClick={() => classifyDeal(PartnershipType.SALE)} className="bg-highlight text-xs px-3 py-1 rounded-md">Sale</button><button onClick={() => classifyDeal(PartnershipType.PARTNER)} className="bg-green-500 text-xs px-3 py-1 rounded-md">Partnership</button></div></div> )}
            {editableContact.partnershipType && ( <div className={`text-center font-bold text-lg text-white bg-accent p-2 rounded-md flex items-center justify-center space-x-2 transition-all ${isFieldDirtyCheck('partnershipType') ? 'ring-2 ring-highlight' : ''}`}><span>DEAL TYPE: {editableContact.partnershipType.toUpperCase()}</span><button onClick={() => setIsEditingDealType(true)} className="text-text-secondary hover:text-white"><PencilAltIcon /></button></div> )}
            {isEditingDealType && ( <div className="bg-highlight/20 p-3 rounded-md text-center"><p className="text-sm text-white mb-2 font-semibold">Change Deal Type:</p><div className="flex justify-center space-x-2"><button onClick={() => classifyDeal(PartnershipType.SALE)} className="bg-highlight text-xs px-3 py-1 rounded-md">Sale</button><button onClick={() => classifyDeal(PartnershipType.PARTNER)} className="bg-green-500 text-xs px-3 py-1 rounded-md">Partnership</button></div></div> )}
            
            <div className="space-y-3">
              <EditableField name="email" value={editableContact.email} label="Email" type="email" icon={<AtSymbolIcon />} />
              <EditableField name="phone" value={editableContact.phone} label="Phone" type="tel" icon={<PhoneIcon />} />
              <EditableField name="location" value={editableContact.location} label="Location" icon={<LocationMarkerIcon />} />
              <EditableField name="website" value={editableContact.website} label="Website" icon={<LinkIcon />} />
              <EditableField name="instagramHandle" value={editableContact.instagramHandle} label="Instagram Handle" icon={<UsersIcon />} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                <EditableField name="followers" value={editableContact.followers} label="Followers" type="number" />
                <EditableField name="following" value={editableContact.following} label="Following" type="number" />
                <EditableField name="posts" value={editableContact.posts} label="Posts" type="number" />
            </div>

            <div><h4 className="font-semibold text-white text-sm mb-1">Tags</h4><div className={`bg-accent p-2 rounded-md transition-all ${isFieldDirtyCheck('tags') ? 'ring-2 ring-highlight' : ''}`}><div className="flex flex-wrap gap-2 mb-2">{ (editableContact.tags || []).map(tag => ( <span key={tag} className="flex items-center bg-highlight/50 text-blue-200 text-xs px-2 py-1 rounded-full">{tag}<button onClick={() => removeTag(tag)} className="ml-1.5 text-blue-200 hover:text-white"> &times; </button></span> )) }</div><div className="relative"><TagIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" /><input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagInputKeyDown} placeholder="Add a tag..." className="w-full bg-primary pl-7 p-1 rounded text-white text-sm" /></div></div></div>
            <div><h4 className="font-semibold text-white text-sm mb-1">Next Follow-up Date</h4><input type="date" name="nextFollowUpDate" value={editableContact.nextFollowUpDate ? editableContact.nextFollowUpDate.split('T')[0] : ''} onChange={handleFieldChange} className={`w-full bg-accent p-2 rounded text-white text-sm transition-all ${isFieldDirtyCheck('nextFollowUpDate') ? 'ring-2 ring-highlight' : ''}`}/></div>
            <div><h4 className="font-semibold text-white text-sm mb-1">Biography</h4><p className="text-text-secondary text-sm bg-accent p-3 rounded-md whitespace-pre-wrap max-h-24 overflow-y-auto">{contact.biography || 'No biography.'}</p></div>
            <div><h4 className="font-semibold text-white text-sm mb-1">My Notes</h4><textarea name="notes" value={editableContact.notes || ''} onChange={handleFieldChange} placeholder="Add private notes..." className={`w-full bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none transition-all ${isFieldDirtyCheck('notes') ? 'ring-2 ring-highlight' : ''}`} rows={3}></textarea></div>
            <div className="border-t border-accent pt-4 mt-4">
                <button 
                    onClick={handleDelete}
                    className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-500 transition-colors duration-200"
                >
                    <TrashIcon />
                    <span>Delete Contact</span>
                </button>
            </div>
          </div>
          {renderTabs()}
        </div>
        <div className="p-4 bg-accent flex justify-end space-x-3 border-t border-primary">
            <button onClick={handleClose} className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-500">Cancel</button>
            <button onClick={handleSave} disabled={!isDirty} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500 disabled:bg-gray-500 disabled:cursor-not-allowed">Save Changes</button>
        </div>
      </div>
    </div>
  );
};
