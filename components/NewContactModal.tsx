
import React, { useState } from 'react';
import { Contact } from '../types';
import { CloseIcon } from './icons';

interface NewContactModalProps {
  onClose: () => void;
  onCreateContact: (contactData: Omit<Contact, 'id'>) => void;
  pipelineStages: string[];
}

export const NewContactModal: React.FC<NewContactModalProps> = ({ onClose, onCreateContact, pipelineStages }) => {
  const [formData, setFormData] = useState<Partial<Omit<Contact, 'id'>>>({
    name: '',
    email: '',
    phone: '',
    location: '',
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
    const fullContactData: Omit<Contact, 'id'> = {
        ...formData,
        name: formData.name,
        email: formData.email,
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
      <form onSubmit={handleSubmit} className="bg-secondary rounded-lg shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-accent flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Add New Contact</h2>
          <button type="button" onClick={onClose} className="text-text-secondary hover:text-white transition-colors"><CloseIcon /></button>
        </div>
        
        <div className="p-6 space-y-4">
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Name <span className="text-red-400">*</span></label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-accent p-2 rounded-md text-white" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Email <span className="text-red-400">*</span></label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-accent p-2 rounded-md text-white" required />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-accent p-2 rounded-md text-white" />
            </div>
             <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Location</label>
                <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full bg-accent p-2 rounded-md text-white" />
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Pipeline Stage</label>
                <select name="pipelineStage" value={formData.pipelineStage} onChange={handleChange} className="w-full bg-accent p-2 rounded-md text-white">
                    {pipelineStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
                </select>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-6 bg-accent rounded-b-lg flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600">Cancel</button>
            <button type="submit" className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Create Contact</button>
        </div>
      </form>
    </div>
  );
};
