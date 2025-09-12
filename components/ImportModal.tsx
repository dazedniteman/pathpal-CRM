

import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import { CloseIcon, ExclamationIcon, UploadIcon } from './icons';

interface ImportModalProps {
  onClose: () => void;
  onImport: (newContacts: Contact[], updatedContacts: Contact[]) => void;
  existingContacts: Contact[];
}

type Step = 'upload' | 'map' | 'review' | 'importing';
type ContactKey = keyof Omit<Contact, 'id' | 'interactions' | 'lastContacted' | 'avatarUrl' | 'pipelineStage' | 'status' | 'partnerDetails' | 'partnershipType'>;
type Resolution = 'skip' | 'update' | 'import_new';
interface Duplicate {
  existing: Contact;
  incoming: Partial<Contact>;
  resolution: Resolution;
}

const CONTACT_FIELDS: { key: ContactKey; label: string }[] = [ { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone'}, { key: 'location', label: 'Location/State' }, { key: 'instagramHandle', label: 'Instagram Handle' }, { key: 'website', label: 'Website' }, { key: 'followers', label: 'Followers' }, { key: 'following', label: 'Following' }, { key: 'posts', label: 'Posts' }, { key: 'avgLikes', label: 'Average Likes' }, { key: 'avgComments', label: 'Average Comments' }, { key: 'biography', label: 'Biography/Notes' }, { key: 'tags', label: 'Tags (comma-separated)'} ];
const guessField = (header: string): ContactKey | 'ignore' => { const h = header.toLowerCase().replace(/[^a-z0-9]/gi, ''); if (h.includes('name') && !h.includes('instagram')) return 'name'; if (h.includes('email')) return 'email'; if (h.includes('phone') || h.includes('number')) return 'phone'; if (h.includes('state') || h.includes('location')) return 'location'; if (h.includes('instagram') || h.includes('ig')) return 'instagramHandle'; if (h.includes('website') || h.includes('url')) return 'website'; if (h.includes('followers')) return 'followers'; if (h.includes('following')) return 'following'; if (h.includes('post')) return 'posts'; if (h.includes('like')) return 'avgLikes'; if (h.includes('comment')) return 'avgComments'; if (h.includes('bio') || h.includes('note')) return 'biography'; if (h.includes('tag')) return 'tags'; return 'ignore'; };

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport, existingContacts }) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, ContactKey | 'ignore'>>({});
  const [parsedContacts, setParsedContacts] = useState<Partial<Contact>[]>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  
  const existingContactsMap = useMemo(() => {
    const map = new Map<string, Contact>();
    existingContacts.forEach(c => {
        map.set(c.email.toLowerCase(), c);
        if (c.instagramHandle) map.set(c.instagramHandle.toLowerCase(), c);
    });
    return map;
  }, [existingContacts]);

  const processFile = (fileToProcess: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim() !== '');
      if (lines.length < 2) { setError('CSV must have a header row and at least one data row.'); return; }
      const headers = lines[0].split(',').map(h => h.trim());
      const data = lines.slice(1).map(line => line.split(',').map(v => v.trim()));
      setCsvHeaders(headers); setCsvData(data);
      const initialMappings: Record<string, ContactKey | 'ignore'> = {};
      headers.forEach(header => { initialMappings[header] = guessField(header); });
      setMappings(initialMappings); setStep('map');
    };
    reader.readAsText(fileToProcess);
  };

  const handleProceedToReview = () => {
    try {
      const contacts: Partial<Contact>[] = csvData.map((row, rowIndex) => {
        const contactData: Partial<Contact> = {};
        csvHeaders.forEach((header, colIndex) => {
          const mappedField = mappings[header];
          if (mappedField !== 'ignore') {
            let value: any = row[colIndex];
            if (['followers', 'following', 'posts', 'avgLikes', 'avgComments'].includes(mappedField)) value = value ? parseInt(value.replace(/,/g, ''), 10) || undefined : undefined;
            if (mappedField === 'instagramHandle' && value && value.includes('instagram.com')) { const match = value.match(/(?:instagram\.com\/)([a-zA-Z0-9_.]+)/); value = match?.[1] ? `@${match[1]}` : value; }
            if (mappedField === 'tags' && typeof value === 'string') { value = value.split(',').map(t => t.trim()).filter(Boolean); }
            if (mappedField === 'biography') { contactData.biography = contactData.biography ? `${contactData.biography}\n${value}` : value; } 
            else { (contactData as any)[mappedField] = value; }
          }
        });
        if (!contactData.name || !contactData.email) throw new Error(`Row ${rowIndex + 2} is missing a mapped Name or Email, which are required.`);
        return contactData;
      });
      setParsedContacts(contacts);
      
      const foundDuplicates: Duplicate[] = [];
      contacts.forEach(incoming => {
          const emailMatch = incoming.email ? existingContactsMap.get(incoming.email.toLowerCase()) : undefined;
          const igMatch = incoming.instagramHandle ? existingContactsMap.get(incoming.instagramHandle.toLowerCase()) : undefined;
          const existing = emailMatch || igMatch;
          if (existing) {
              foundDuplicates.push({ existing, incoming, resolution: 'update' });
          }
      });

      if (foundDuplicates.length > 0) {
        setDuplicates(foundDuplicates);
        setStep('review');
      } else {
        handleFinalImport();
      }
    } catch (err: any) { setError(`Parsing failed: ${err.message}`); }
  };
  
  const handleResolutionChange = (index: number, resolution: Resolution) => {
    setDuplicates(prev => prev.map((dup, i) => i === index ? { ...dup, resolution } : dup));
  };

  const handleFinalImport = () => {
    setStep('importing');
    const newContacts: Contact[] = [];
    const updatedContacts: Contact[] = [];
    const duplicateIncomingEmails = new Set(duplicates.map(d => d.incoming.email!.toLowerCase()));

    parsedContacts.forEach((incoming, idx) => {
        const isDuplicate = incoming.email && duplicateIncomingEmails.has(incoming.email.toLowerCase());
        if (!isDuplicate) {
            newContacts.push({ ...incoming, id: `imported-${Date.now()}-${idx}`, pipelineStage: 'To Reach Out', status: 'New', lastContacted: new Date().toISOString(), interactions: [], avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(incoming.email!)}/100/100` } as Contact);
        }
    });

    duplicates.forEach(({ existing, incoming, resolution }) => {
      if (resolution === 'update') {
          const updated: Contact = { ...existing };
          // Carefully merge fields, preferring new data only if the old one was empty
          Object.keys(incoming).forEach(key => {
              const k = key as keyof Contact;
              if ((incoming[k] !== undefined && incoming[k] !== null && incoming[k] !== '') || (updated[k] === undefined || updated[k] === null || updated[k] === '')) {
                  (updated as any)[k] = incoming[k];
              }
          });
          updatedContacts.push(updated);
      } else if (resolution === 'import_new') {
          newContacts.push({ ...incoming, id: `imported-new-${Date.now()}-${existing.id}`, pipelineStage: 'To Reach Out', status: 'New', lastContacted: new Date().toISOString(), interactions: [], avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(incoming.email!)}/100/100` } as Contact);
      }
    });

    onImport(newContacts, updatedContacts);
  };
  
  const renderUpload = () => ( <div className="p-6 space-y-4"><p className="text-sm text-text-secondary">Upload a CSV file to begin the import process.</p><div><div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-accent border-dashed rounded-md"><div className="space-y-1 text-center"><UploadIcon /><div className="flex text-sm text-gray-400"><label htmlFor="file-upload" className="relative cursor-pointer bg-secondary rounded-md font-medium text-highlight hover:text-blue-400 focus-within:outline-none"><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if(f) { setFile(f); setError(''); processFile(f); } }} accept=".csv" /></label></div><p className="text-xs text-gray-500">{file ? file.name : 'CSV up to 10MB'}</p></div></div></div>{error && <p className="text-red-400 text-sm">{error}</p>}</div> );
  const renderMap = () => ( <> <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto"><p className="text-sm text-text-secondary">Review the automatically matched fields. Correct any mismatches to ensure your data imports correctly. Name and Email are required.</p><div className="space-y-3">{csvHeaders.map(header => ( <div key={header} className="grid grid-cols-2 gap-4 items-center"><span className="font-medium text-white truncate" title={header}>{header}</span>
{/* FIX: Cast e.target.value to the correct type to resolve TypeScript error. */}
<select value={mappings[header]} onChange={(e) => setMappings(p => ({...p, [header]: e.target.value as ContactKey | 'ignore'}))} className="bg-accent text-white rounded-md p-2 focus:ring-2 focus:ring-highlight outline-none"><option value="ignore">-- Ignore this field --</option>{CONTACT_FIELDS.map(field => ( <option key={field.key} value={field.key}>{field.label}</option> ))}</select></div> ))}</div>{error && <p className="text-red-400 text-sm mt-4">{error}</p>}</div><div className="p-6 bg-accent rounded-b-lg flex justify-end space-x-3"><button onClick={() => setStep('upload')} className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600">Back</button><button onClick={handleProceedToReview} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Review & Continue</button></div> </> );
  const renderReview = () => ( <> <div className="p-6 max-h-[60vh] overflow-y-auto"> <div className="flex items-start bg-yellow-500/10 text-yellow-300 p-3 rounded-md mb-4"><ExclamationIcon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" /><p className="text-sm">We found {duplicates.length} potential duplicate(s) based on matching emails or Instagram handles. Please choose how to handle each one.</p></div> <div className="space-y-4"> {duplicates.map((dup, index) => ( <div key={index} className="bg-accent p-4 rounded-lg"> <h4 className="font-semibold text-white border-b border-gray-600 pb-2 mb-2">Potential Duplicate: {dup.incoming.name}</h4> <div className="grid grid-cols-2 gap-4 text-xs"> <div> <p className="font-bold text-text-secondary mb-1">EXISTING CONTACT</p> <p className="text-white">{dup.existing.name}</p> <p className="text-text-secondary">{dup.existing.email}</p> <p className="text-text-secondary">{dup.existing.instagramHandle}</p> </div> <div> <p className="font-bold text-text-secondary mb-1">INCOMING FROM CSV</p> <p className="text-white">{dup.incoming.name}</p> <p className="text-text-secondary">{dup.incoming.email}</p> <p className="text-text-secondary">{dup.incoming.instagramHandle}</p> </div> </div> <div className="mt-3 flex space-x-2 text-sm"> <button onClick={() => handleResolutionChange(index, 'update')} className={`px-3 py-1 rounded w-full text-center ${dup.resolution === 'update' ? 'bg-highlight text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>Update Existing</button> <button onClick={() => handleResolutionChange(index, 'skip')} className={`px-3 py-1 rounded w-full text-center ${dup.resolution === 'skip' ? 'bg-highlight text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>Skip Import</button> <button onClick={() => handleResolutionChange(index, 'import_new')} className={`px-3 py-1 rounded w-full text-center ${dup.resolution === 'import_new' ? 'bg-highlight text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>Import as New</button> </div> </div> ))} </div> </div> <div className="p-6 bg-accent rounded-b-lg flex justify-end space-x-3"><button onClick={() => setStep('map')} className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600">Back to Mapping</button><button onClick={handleFinalImport} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Confirm & Finish Import</button></div> </> );
  const renderImporting = () => ( <div className="p-12 flex flex-col items-center justify-center"><p className="text-lg text-white">Importing your contacts...</p><p className="text-sm text-text-secondary">Please wait a moment.</p></div> );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-2xl">
        <div className="p-6 border-b border-accent flex justify-between items-center"><h2 className="text-xl font-bold text-white">Import Contacts ({step})</h2><button onClick={onClose} className="text-text-secondary hover:text-white transition-colors"><CloseIcon /></button></div>
        {step === 'upload' && renderUpload()}
        {step === 'map' && renderMap()}
        {step === 'review' && renderReview()}
        {step === 'importing' && renderImporting()}
      </div>
    </div>
  );
};