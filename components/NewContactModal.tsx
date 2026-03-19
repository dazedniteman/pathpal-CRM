
import React, { useState } from 'react';
import { Contact, ContactType } from '../types';
import { CloseIcon } from './icons';

interface NewContactModalProps {
  onClose: () => void;
  onCreateContact: (contactData: Omit<Contact, 'id'>) => void;
  pipelineStages: string[];
  initialData?: { name?: string; email?: string };
}

const CONTACT_TYPES: { value: ContactType; label: string; track: string; color: string; bg: string; border: string }[] = [
  { value: 'instructor', label: 'Instructor', track: '→ Prospective Teachers', color: 'text-indigo-300', bg: 'bg-indigo-500/10', border: 'border-indigo-500/50' },
  { value: 'media',      label: 'Media',      track: '→ Other',                color: 'text-gray-300',   bg: 'bg-gray-500/10',   border: 'border-gray-500/50'   },
  { value: 'customer',   label: 'Customer',   track: '→ People with Product',  color: 'text-emerald-300',bg: 'bg-emerald-500/10',border: 'border-emerald-500/50'},
  { value: 'other',      label: 'Other',      track: '→ Other',                color: 'text-gray-300',   bg: 'bg-gray-500/10',   border: 'border-gray-500/50'   },
];

export const NewContactModal: React.FC<NewContactModalProps> = ({ onClose, onCreateContact, pipelineStages, initialData }) => {
  const [formData, setFormData] = useState<Partial<Omit<Contact, 'id'>>>({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: '',
    location: '',
    contactType: undefined,
    pipelineStage: pipelineStages[0] || 'To Reach Out',
    status: 'New',
    lastContacted: new Date().toISOString(),
    interactions: [],
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      setError('Name and Email are required.');
      return;
    }
    if (!formData.contactType) {
      setError('Please select a Contact Type so we know which track they belong in.');
      return;
    }
    const fullContactData: Omit<Contact, 'id'> = {
        ...formData,
        name: formData.name,
        email: formData.email,
        contactType: formData.contactType,
        pipelineStage: formData.pipelineStage || pipelineStages[0],
        status: 'New',
        lastContacted: new Date().toISOString(),
        interactions: [],
        avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(formData.email)}/100/100`,
    };
    onCreateContact(fullContactData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-base-800 border border-base-600 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="p-5 border-b border-base-600 flex justify-between items-center">
          <h2 className="text-lg font-bold text-text-primary">Add New Contact</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors"><CloseIcon /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Contact Type — first and most prominent */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Contact Type <span className="text-red-400">*</span>
              <span className="text-xs font-normal text-text-muted ml-2">— determines which track they appear in</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTACT_TYPES.map(ct => {
                const selected = formData.contactType === ct.value;
                return (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, contactType: ct.value }))}
                    className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${
                      selected
                        ? `${ct.bg} ${ct.border} ring-1 ring-inset ${ct.border}`
                        : 'bg-base-700 border-base-600 hover:border-base-500'
                    }`}
                  >
                    <span className={`text-sm font-medium ${selected ? ct.color : 'text-text-primary'}`}>{ct.label}</span>
                    <span className={`text-xs mt-0.5 ${selected ? ct.color : 'text-text-muted'} opacity-80`}>{ct.track}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Name <span className="text-red-400">*</span></label>
            <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-base-700 border border-base-600 p-2 rounded-lg text-text-primary outline-none focus:border-outreach/50" required />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email <span className="text-red-400">*</span></label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-base-700 border border-base-600 p-2 rounded-lg text-text-primary outline-none focus:border-outreach/50" required />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-base-700 border border-base-600 p-2 rounded-lg text-text-primary outline-none focus:border-outreach/50" />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full bg-base-700 border border-base-600 p-2 rounded-lg text-text-primary outline-none focus:border-outreach/50" />
          </div>

          {/* Pipeline Stage */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Pipeline Stage</label>
            <select name="pipelineStage" value={formData.pipelineStage} onChange={handleChange} className="w-full bg-base-700 border border-base-600 p-2 rounded-lg text-text-primary outline-none focus:border-outreach/50">
              {pipelineStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-5 bg-base-900/30 border-t border-base-600 rounded-b-xl flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary bg-base-700 hover:bg-base-600 border border-base-600 rounded-lg transition-colors">Cancel</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-outreach hover:bg-outreach/80 rounded-lg transition-colors">Create Contact</button>
        </div>
      </form>
    </div>
  );
};
