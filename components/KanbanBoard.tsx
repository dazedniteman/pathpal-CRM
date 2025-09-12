
import React, { useState } from 'react';
import { Contact } from '../types';
import { ContactCard } from './ContactCard';

interface KanbanBoardProps {
  contacts: Contact[];
  pipelineStages: string[];
  onDragEnd: (contactId: string, newStage: string) => void;
  onSelectContact: (contact: Contact) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ contacts, pipelineStages, onDragEnd, onSelectContact }) => {
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, contactId: string) => {
    setDraggedContactId(contactId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, stage: string) => {
    e.preventDefault();
    if (draggedContactId) {
      onDragEnd(draggedContactId, stage);
      setDraggedContactId(null);
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-white mb-6">Sales Pipeline</h2>
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {pipelineStages.map((stage) => (
          <div
            key={stage}
            className="bg-secondary rounded-lg w-80 flex-shrink-0"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage)}
          >
            <div className="p-4 border-b border-accent sticky top-0 bg-secondary">
              <h3 className="font-semibold text-lg text-white">{stage}</h3>
              <span className="text-sm text-text-secondary">
                {contacts.filter((c) => c.pipelineStage === stage).length} contacts
              </span>
            </div>
            <div className="p-2 space-y-2 min-h-[60vh] overflow-y-auto">
              {contacts
                .filter((c) => c.pipelineStage === stage)
                .sort((a,b) => new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime())
                .map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onSelectContact={onSelectContact}
                    onDragStart={(e) => handleDragStart(e, contact.id)}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
