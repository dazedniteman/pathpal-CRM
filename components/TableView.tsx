
import React, { useState, useMemo, useEffect } from 'react';
import { Contact, TableFilter, PartnershipType } from '../types';
import { SearchIcon, SortAscIcon, SortDescIcon, XCircleIcon, TagIcon } from './icons';

interface TableViewProps {
  contacts: Contact[];
  pipelineStages: string[];
  onSelectContact: (contact: Contact) => void;
  activeFilter: TableFilter | null;
  onClearFilter: () => void;
  onBulkUpdate: (contactIds: string[], updates: Partial<Pick<Contact, 'pipelineStage' | 'tags'>>) => void;
}

type SortableContactKeys = 'name' | 'email' | 'pipelineStage' | 'location' | 'followers' | 'following' | 'posts' | 'lastContacted' | 'instagramHandle' | 'partnershipType';
type SortConfig = { key: SortableContactKeys; direction: 'ascending' | 'descending'; } | null;

const useSortableData = (items: Contact[], config: SortConfig = null) => {
  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (config !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[config.key as keyof Contact];
        const bValue = b[config.key as keyof Contact];
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        const numA = typeof aValue === 'string' && !isNaN(Date.parse(aValue)) ? Date.parse(aValue) : aValue;
        const numB = typeof bValue === 'string' && !isNaN(Date.parse(bValue)) ? Date.parse(bValue) : bValue;
        if (numA < numB) return config.direction === 'ascending' ? -1 : 1;
        if (numA > numB) return config.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [items, config]);
  return sortedItems;
};

export const TableView: React.FC<TableViewProps> = ({ contacts, pipelineStages, onSelectContact, activeFilter, onClearFilter, onBulkUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterDealType, setFilterDealType] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'lastContacted', direction: 'descending' });
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkStage, setBulkStage] = useState('');
  const [bulkTags, setBulkTags] = useState('');

  const allTags = useMemo(() => Array.from(new Set(contacts.flatMap(c => c.tags || []))), [contacts]);

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (activeFilter) {
      filtered = contacts.filter(c => {
        if (!c.partnerDetails || c.partnershipType !== PartnershipType.PARTNER) return false;
        switch(activeFilter.type) {
          case 'outstanding_drills': return c.partnerDetails.drillVideosAgreed > c.partnerDetails.drillVideosDelivered;
          case 'outstanding_testimonials': return c.partnerDetails.testimonialVideoAgreed && !c.partnerDetails.testimonialVideoDelivered;
          case 'outstanding_links': return c.partnerDetails.websiteLinkAgreed && !c.partnerDetails.websiteLinkDelivered;
          case 'outstanding_posts': return c.partnerDetails.socialPostAgreed && !c.partnerDetails.socialPostDelivered;
          default: return false;
        }
      })
    }
    
    return filtered.filter(contact => {
      const matchesSearch = searchTerm === '' || contact.name.toLowerCase().includes(searchTerm.toLowerCase()) || contact.email.toLowerCase().includes(searchTerm.toLowerCase()) || contact.location?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStage = filterStage === 'all' || contact.pipelineStage === filterStage;
      const matchesDealType = filterDealType === 'all' || (filterDealType === 'Sale' && contact.partnershipType === PartnershipType.SALE) || (filterDealType === 'Partner' && contact.partnershipType === PartnershipType.PARTNER) || (filterDealType === 'N/A' && !contact.partnershipType);
      const matchesTag = filterTag === 'all' || (contact.tags || []).includes(filterTag);
      return matchesSearch && matchesStage && matchesDealType && matchesTag;
    });
  }, [contacts, searchTerm, filterStage, filterDealType, filterTag, activeFilter]);

  const sortedContacts = useSortableData(filteredContacts, sortConfig);
  
  useEffect(() => {
    // Clear selections when filters change
    setSelectedContactIds([]);
  }, [filteredContacts]);

  const requestSort = (key: SortableContactKeys) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') { direction = 'descending'; }
    setSortConfig({ key, direction });
  };
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedContactIds(e.target.checked ? sortedContacts.map(c => c.id) : []);
  };
  
  const handleSelectOne = (id: string, isSelected: boolean) => {
    setSelectedContactIds(prev => isSelected ? [...prev, id] : prev.filter(cid => cid !== id));
  };
  
  const handleApplyBulkActions = () => {
    const updates: Partial<Pick<Contact, 'pipelineStage' | 'tags'>> = {};
    if (bulkStage) updates.pipelineStage = bulkStage;
    if (bulkTags) updates.tags = bulkTags.split(',').map(t => t.trim()).filter(Boolean);
    if (Object.keys(updates).length > 0) {
        onBulkUpdate(selectedContactIds, updates);
    }
    setSelectedContactIds([]);
    setBulkStage('');
    setBulkTags('');
  };

  const columns: { key: SortableContactKeys; label: string; }[] = [ { key: 'name', label: 'Name' }, { key: 'pipelineStage', label: 'Stage' }, { key: 'partnershipType', label: 'Deal Type'}, { key: 'instagramHandle', label: 'Instagram' }, { key: 'followers', label: 'Followers' }, { key: 'lastContacted', label: 'Last Contacted' }, ];

  return (
    <div className="bg-secondary p-6 rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-white mb-6">All Contacts</h2>
      {activeFilter && ( <div className="flex items-center justify-between p-3 mb-4 bg-highlight/20 text-highlight rounded-md"> <p className="font-medium text-sm"><span className="font-bold">Active Filter:</span> {activeFilter.label}</p> <button onClick={onClearFilter} className="flex items-center space-x-1 text-xs hover:text-white"><XCircleIcon /><span>Clear Filter</span></button></div> )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="relative md:col-span-1 lg:col-span-2">
          <input type="text" placeholder="Search by name, email, location..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-accent p-2 pl-10 rounded-md text-white focus:ring-2 focus:ring-highlight outline-none" disabled={!!activeFilter} />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-secondary" />
        </div>
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="bg-accent text-white rounded-md p-2 focus:ring-2 focus:ring-highlight outline-none" disabled={!!activeFilter}><option value="all">All Pipeline Stages</option>{pipelineStages.map(stage => ( <option key={stage} value={stage}>{stage}</option> ))}</select>
        <select value={filterDealType} onChange={(e) => setFilterDealType(e.target.value)} className="bg-accent text-white rounded-md p-2 focus:ring-2 focus:ring-highlight outline-none" disabled={!!activeFilter}><option value="all">All Deal Types</option><option value="Sale">Sale</option><option value="Partner">Partner</option><option value="N/A">Not Applicable</option></select>
        <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="bg-accent text-white rounded-md p-2 focus:ring-2 focus:ring-highlight outline-none" disabled={!!activeFilter}><option value="all">All Tags</option>{allTags.map(tag => ( <option key={tag} value={tag}>{tag}</option> ))}</select>
      </div>
      
      {selectedContactIds.length > 0 && (
        <div className="bg-accent p-3 rounded-md mb-4 flex flex-wrap items-center gap-4">
          <span className="font-semibold text-white">{selectedContactIds.length} selected</span>
          <select value={bulkStage} onChange={e => setBulkStage(e.target.value)} className="bg-primary text-white text-sm rounded-md p-2 focus:ring-2 focus:ring-highlight outline-none"><option value="">Change Stage...</option>{pipelineStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select>
          <div className="relative flex-grow"><TagIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" /><input type="text" value={bulkTags} onChange={e => setBulkTags(e.target.value)} placeholder="Add tags, comma-separated" className="w-full bg-primary text-sm p-2 pl-7 rounded-md" /></div>
          <button onClick={handleApplyBulkActions} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Apply</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="border-b border-accent">
            <tr>
              <th className="p-3"><input type="checkbox" className="form-checkbox bg-primary text-highlight" onChange={handleSelectAll} checked={selectedContactIds.length > 0 && selectedContactIds.length === sortedContacts.length} /></th>
              {columns.map(({key, label}) => ( <th key={key} className="p-3 text-sm font-semibold text-text-secondary uppercase"><button onClick={() => requestSort(key)} className="flex items-center space-x-1"><span>{label}</span>{sortConfig?.key === key ? (sortConfig.direction === 'ascending' ? <SortAscIcon/> : <SortDescIcon/>) : null}</button></th> ))}
              <th className="p-3 text-sm font-semibold text-text-secondary uppercase">Tags</th>
              <th className="p-3 text-sm font-semibold text-text-secondary uppercase">Partner Details</th>
            </tr>
          </thead>
          <tbody>
            {sortedContacts.map(contact => (
              <tr key={contact.id} className={`border-b border-accent transition-colors ${selectedContactIds.includes(contact.id) ? 'bg-highlight/20' : 'hover:bg-accent'}`}>
                <td className="p-3"><input type="checkbox" className="form-checkbox bg-primary text-highlight" checked={selectedContactIds.includes(contact.id)} onChange={e => handleSelectOne(contact.id, e.target.checked)} onClick={e => e.stopPropagation()} /></td>
                <td className="p-3 cursor-pointer" onClick={() => onSelectContact(contact)}> <div className="font-medium text-white">{contact.name}</div> <div className="text-xs text-text-secondary">{contact.email}</div> </td>
                <td className="p-3 cursor-pointer" onClick={() => onSelectContact(contact)}><span className={`px-2 py-1 text-xs rounded-full ${ contact.pipelineStage === 'Closed - Success' ? 'bg-green-500/50 text-green-300' : contact.pipelineStage === 'Closed - Unsuccessful' ? 'bg-red-500/50 text-red-300' : 'bg-highlight/50 text-blue-300' }`}>{contact.pipelineStage}</span></td>
                <td className="p-3 text-text-secondary cursor-pointer" onClick={() => onSelectContact(contact)}>{contact.partnershipType || 'N/A'}</td>
                <td className="p-3 text-text-secondary cursor-pointer" onClick={() => onSelectContact(contact)}>{contact.instagramHandle ? (<a href={`https://instagram.com/${contact.instagramHandle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-highlight hover:underline">{contact.instagramHandle}</a>) : 'N/A'}</td>
                <td className="p-3 text-text-secondary cursor-pointer" onClick={() => onSelectContact(contact)}>{contact.followers?.toLocaleString() || 'N/A'}</td>
                <td className="p-3 text-text-secondary cursor-pointer" onClick={() => onSelectContact(contact)}>{new Date(contact.lastContacted).toLocaleDateString()}</td>
                <td className="p-3 text-text-secondary text-xs cursor-pointer" onClick={() => onSelectContact(contact)}><div className="flex flex-wrap gap-1">{contact.tags?.map(tag => <span key={tag} className="px-1.5 py-0.5 text-xs text-blue-200 bg-highlight/50 rounded-full">{tag}</span>)}</div></td>
                <td className="p-3 text-text-secondary text-xs cursor-pointer" onClick={() => onSelectContact(contact)}>{contact.partnerDetails ? ( <div className="space-y-1"><div>Contract: {contact.partnerDetails.contractSigned ? '✅' : '❌'}</div><div>Drills: {contact.partnerDetails.drillVideosDelivered}/{contact.partnerDetails.drillVideosAgreed}</div><div>Testimonial: {contact.partnerDetails.testimonialVideoDelivered ? '✅' : '❌'}</div></div> ) : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
         {sortedContacts.length === 0 && ( <div className="text-center py-10 text-text-secondary"><p>No contacts match your current search and filter criteria.</p></div> )}
      </div>
    </div>
  );
};
