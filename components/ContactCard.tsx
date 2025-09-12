
import React from 'react';
import { Contact } from '../types';
import { AtSymbolIcon, UsersIcon } from './icons';

interface ContactCardProps {
  contact: Contact;
  onSelectContact: (contact: Contact) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onSelectContact, onDragStart }) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onSelectContact(contact)}
      className="bg-accent p-4 rounded-md shadow-md cursor-pointer hover:bg-gray-600 transition-colors duration-200"
    >
      <div className="flex items-center space-x-3 mb-3">
        <img src={contact.avatarUrl} alt={contact.name} className="w-10 h-10 rounded-full" />
        <div>
          <p className="font-semibold text-white">{contact.name}</p>
          <p className="text-xs text-text-secondary">{contact.location}</p>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center text-text-secondary">
            <AtSymbolIcon />
            <span className="ml-2 truncate">{contact.email}</span>
        </div>
        {contact.instagramHandle && (
            <div className="flex items-center text-text-secondary">
                <UsersIcon />
                <span className="ml-2">{contact.instagramHandle} ({(contact.followers || 0) / 1000}k)</span>
            </div>
        )}
      </div>
      {contact.tags && contact.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
            {contact.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 text-xs text-blue-200 bg-highlight/50 rounded-full">{tag}</span>
            ))}
        </div>
      )}
    </div>
  );
};
