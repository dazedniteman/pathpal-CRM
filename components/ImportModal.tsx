import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import { CloseIcon, ExclamationIcon, UploadIcon } from './icons';

interface ImportModalProps {
  onClose: () => void;
  onImport: (newContacts: Contact[], updatedContacts: Contact[]) => void;
  existingContacts: Contact[];
}

type Step = 'upload' | 'map' | 'review' | 'error_correction' | 'importing';
type ContactKey = keyof Omit<Contact, 'id' | 'interactions' | 'lastContacted' | 'avatarUrl' | 'pipelineStage' | 'status' | 'partnerDetails' | 'partnershipType'>;
type Resolution = 'skip' | 'update' | 'import_new';
interface Duplicate {
  existing: Contact;
  incoming: Partial<Contact>;
  resolution: Resolution;
}
interface FailedRow {
    id: number; // Use original row index as a unique ID
    rowData: string[];
    errors: Record<string, string>; // Map CSV header to error string
}

const CONTACT_FIELDS: { key: ContactKey; label: string }[] = [ { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone'}, { key: 'location', label: 'Location/State' }, { key: 'instagramHandle', label: 'Instagram Handle' }, { key: 'website', label: 'Website' }, { key: 'followers', label: 'Followers' }, { key: 'following', label: 'Following' }, { key: 'posts', label: 'Posts' }, { key: 'avgLikes', label: 'Average Likes' }, { key: 'avgComments', label: 'Average Comments' }, { key: 'biography', label: 'Biography/Notes' }, { key: 'tags', label: 'Tags (comma-separated)'} ];
const guessField = (header: string): ContactKey | 'ignore' => { const h = header.toLowerCase().replace(/[^a-z0-9]/gi, ''); if (h.includes('name') && !h.includes('instagram')) return 'name'; if (h.includes('email')) return 'email'; if (h.includes('phone') || h.includes('number')) return 'phone'; if (h.includes('state') || h.includes('location')) return 'location'; if (h.includes('instagram') || h.includes('ig')) return 'instagramHandle'; if (h.includes('website') || h.includes('url')) return 'website'; if (h.includes('followers')) return 'followers'; if (h.includes('following')) return 'following'; if (h.includes('post')) return 'posts'; if (h.includes('like')) return 'avgLikes'; if (h.includes('comment')) return 'avgComments'; if (h.includes('bio') || h.includes('note')) return 'biography'; if (h.includes('tag')) return 'tags'; return 'ignore'; };

const parseSocialNumber = (value: string): number | undefined => {
    if (!value) return undefined;
    const cleanedValue = value.toLowerCase().replace(/,/g, '').trim();
    const num = parseFloat(cleanedValue);
    if (isNaN(num)) return undefined;

    if (cleanedValue.endsWith('k')) {
        return Math.floor(num * 1000);
    }
    if (cleanedValue.endsWith('m')) {
        return Math.floor(num * 1000000);
    }
    return Math.floor(num);
};


export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport, existingContacts }) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, ContactKey | 'ignore'>>({});
  const [parsedContacts, setParsedContacts] = useState<Partial<Contact>[]>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  
  const existingContactsMap = useMemo(() => {
    const map = new Map<string, Contact>();
    existingContacts.forEach(c => {
        if (c.email) map.set(c.email.toLowerCase(), c);
        if (c.instagramHandle) map.set(c.instagramHandle.toLowerCase(), c);
    });
    return map;
  }, [existingContacts]);

  const processFile = (fileToProcess: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        
        // Robust CSV parsing logic
        const allRows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let inQuotes = false;
        
        const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        for (let i = 0; i < normalizedText.length; i++) {
          const char = normalizedText[i];
          if (inQuotes) {
            if (char === '"') {
              if (i + 1 < normalizedText.length && normalizedText[i + 1] === '"') {
                currentField += '"';
                i++; // Skip the second quote
              } else {
                inQuotes = false;
              }
            } else {
              currentField += char;
            }
          } else {
            if (char === ',') {
              currentRow.push(currentField);
              currentField = '';
            } else if (char === '\n') {
              currentRow.push(currentField);
              allRows.push(currentRow);
              currentRow = [];
              currentField = '';
            } else if (char === '"' && currentField.length === 0) {
              inQuotes = true;
            } else {
              currentField += char;
            }
          }
        }
        if (currentField || currentRow.length > 0) {
          currentRow.push(currentField);
          allRows.push(currentRow);
        }

        const nonEmptyRows = allRows.filter(row => row.length > 1 || (row.length === 1 && row[0].trim() !== ''));

        if (nonEmptyRows.length < 2) {
          setError('CSV must have a header row and at least one data row.');
          return;
        }

        let headers = nonEmptyRows[0];
        const headerLength = headers.length;
        let data = nonEmptyRows.slice(1).map(row => {
          if (row.length > headerLength) {
            return row.slice(0, headerLength);
          }
          while (row.length < headerLength) {
            row.push('');
          }
          return row;
        });
        
        headers = headers.map(h => h.trim());

        setCsvHeaders(headers);
        setCsvData(data);
        const initialMappings: Record<string, ContactKey | 'ignore'> = {};
        headers.forEach(header => { initialMappings[header] = guessField(header); });
        setMappings(initialMappings);
        setStep('map');

      } catch (err) {
        console.error("CSV Parsing Error:", err);
        setError(`An error occurred while parsing the file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(fileToProcess);
  };

  const validateAndParseRow = (row: string[], rowIndex: number): { contactData: Partial<Contact> | null; errors: Record<string, string> } => {
    const contactData: Partial<Contact> = {};
    const errors: Record<string, string> = {};

    csvHeaders.forEach((header, colIndex) => {
      const mappedField = mappings[header];
      if (mappedField !== 'ignore') {
        let value: any = row[colIndex] || '';

        // Specific handling for email
        if (mappedField === 'email') {
            if (value.toLowerCase().includes('no direct email found')) {
              value = '';
            } else {
              const emailsFound = value.match(/[\w\.-]+@[\w\.-]+\.\w+/g) || [];
              if (emailsFound.length > 1) {
                  value = emailsFound[0]; // Use the first as primary
                  const otherEmails = emailsFound.slice(1).join(', ');
                  const noteText = `\nOther email(s) from import: ${otherEmails}`;
                  contactData.biography = (contactData.biography || '') + noteText;
              } else if (emailsFound.length === 1) {
                  value = emailsFound[0];
              }
            }
        } 
        // Other fields
        else if (['followers', 'following', 'posts', 'avgLikes', 'avgComments'].includes(mappedField)) {
           value = value ? parseSocialNumber(value) : undefined;
        } else if (mappedField === 'instagramHandle' && value && value.includes('instagram.com')) {
          const match = value.match(/(?:instagram\.com\/)([a-zA-Z0-9_.]+)/);
          value = match?.[1] ? `@${match[1]}` : value;
        } else if (mappedField === 'tags' && typeof value === 'string') {
          value = value.split(',').map(t => t.trim()).filter(Boolean);
        }

        if (mappedField === 'biography' && value) {
            contactData.biography = contactData.biography ? `${contactData.biography}\n${value}` : value;
        } else if (value !== undefined) {
            (contactData as any)[mappedField] = value;
        }
      }
    });

    const findHeader = (key: ContactKey) => csvHeaders.find(h => mappings[h] === key) || key;

    // --- Validation ---
    if (!contactData.name) {
      errors[findHeader('name')] = 'Name is required.';
    }
    
    // Email validation
    const emailHeader = findHeader('email');
    const emailHeaderIndex = csvHeaders.findIndex(h => mappings[h] === 'email');
    const originalEmailCell = emailHeaderIndex > -1 ? row[emailHeaderIndex] : '';

    if (!contactData.email && !originalEmailCell.toLowerCase().includes('no direct email found')) {
      errors[emailHeader] = 'Email is required for this row.';
    } else if (contactData.email && !/^\S+@\S+\.\S+$/.test(contactData.email)) {
      errors[emailHeader] = 'Invalid email format.';
    }

    if (Object.keys(errors).length > 0) {
      return { contactData: null, errors };
    }
    
    return { contactData, errors: {} };
  };

  const handleProceedToReview = () => {
    setError('');
    const successfullyParsed: Partial<Contact>[] = [];
    const newlyFailed: FailedRow[] = [];

    csvData.forEach((row, rowIndex) => {
      const { contactData, errors } = validateAndParseRow(row, rowIndex);
      if (contactData) {
        successfullyParsed.push(contactData);
      } else {
        newlyFailed.push({ id: rowIndex, rowData: row, errors });
      }
    });

    setParsedContacts(successfullyParsed);
    setFailedRows(newlyFailed);

    const foundDuplicates: Duplicate[] = [];
    successfullyParsed.forEach(incoming => {
      const emailMatch = incoming.email ? existingContactsMap.get(incoming.email.toLowerCase()) : undefined;
      const igMatch = incoming.instagramHandle ? existingContactsMap.get(incoming.instagramHandle.toLowerCase()) : undefined;
      const existing = emailMatch || igMatch;
      if (existing) {
        foundDuplicates.push({ existing, incoming, resolution: 'update' });
      }
    });

    setDuplicates(foundDuplicates);

    if (foundDuplicates.length > 0) {
      setStep('review');
    } else if (newlyFailed.length > 0) {
      setStep('error_correction');
    } else {
      handleFinalImport(successfullyParsed, []);
    }
  };

  const handleResolutionChange = (index: number, resolution: Resolution) => {
    setDuplicates(prev => prev.map((dup, i) => i === index ? { ...dup, resolution } : dup));
  };
  
  const handleAfterReview = () => {
    if (failedRows.length > 0) {
      setStep('error_correction');
    } else {
      handleFinalImport(parsedContacts, duplicates);
    }
  };

  const handleFinalImport = (contactsToImport: Partial<Contact>[], duplicatesToResolve: Duplicate[]) => {
    setStep('importing');
    const newContacts: Contact[] = [];
    const updatedContacts: Contact[] = [];

    const duplicateIncomingEmails = new Set(duplicatesToResolve.map(d => d.incoming.email?.toLowerCase()).filter(Boolean));

    contactsToImport.forEach((incoming, idx) => {
        if (!incoming.email || !duplicateIncomingEmails.has(incoming.email.toLowerCase())) {
            newContacts.push({ ...incoming, id: `imported-${Date.now()}-${idx}`, pipelineStage: 'To Reach Out', status: 'New', lastContacted: new Date().toISOString(), interactions: [], avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(incoming.name || `contact${idx}`)}/100/100` } as Contact);
        }
    });

    duplicatesToResolve.forEach(({ existing, incoming, resolution }) => {
      if (resolution === 'update') {
          const updated: Contact = { ...existing };
          Object.keys(incoming).forEach(key => {
              const k = key as keyof Contact;
              if ((incoming[k] !== undefined && incoming[k] !== null && incoming[k] !== '') || (updated[k] === undefined || updated[k] === null || updated[k] === '')) {
                  (updated as any)[k] = incoming[k];
              }
          });
          updatedContacts.push(updated);
      } else if (resolution === 'import_new') {
          newContacts.push({ ...incoming, id: `imported-new-${Date.now()}-${existing.id}`, pipelineStage: 'To Reach Out', status: 'New', lastContacted: new Date().toISOString(), interactions: [], avatarUrl: `https://picsum.photos/seed/${encodeURIComponent(incoming.name!)}/100/100` } as Contact);
      }
    });

    onImport(newContacts, updatedContacts);
  };
  
  const handleRowEdit = (rowIndex: number, colIndex: number, value: string) => {
    setFailedRows(prev => prev.map(row => {
        if (row.id === rowIndex) {
            const newRowData = [...row.rowData];
            newRowData[colIndex] = value;
            return { ...row, rowData: newRowData, errors: {} }; // Clear errors on edit
        }
        return row;
    }));
  };

  const handleSkipRow = (rowId: number) => {
    setFailedRows(prev => prev.filter(row => row.id !== rowId));
  };

  const handleRetryImport = () => {
    let stillFailing: FailedRow[] = [];
    let newlySuccessful: Partial<Contact>[] = [];

    failedRows.forEach(failed => {
        const { contactData, errors } = validateAndParseRow(failed.rowData, failed.id);
        if (contactData) {
            newlySuccessful.push(contactData);
        } else {
            stillFailing.push({ ...failed, errors });
        }
    });

    if (newlySuccessful.length > 0) {
        setParsedContacts(prev => [...prev, ...newlySuccessful]);
    }
    setFailedRows(stillFailing);

    if (stillFailing.length === 0) {
        alert("All rows corrected! You can now finish the import.");
    }
  };

  const renderUpload = () => ( <div className="p-6 space-y-4"><p className="text-sm text-text-secondary">Upload a CSV file to begin the import process.</p><div><div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-accent border-dashed rounded-md"><div className="space-y-1 text-center"><UploadIcon /><div className="flex text-sm text-gray-400"><label htmlFor="file-upload" className="relative cursor-pointer bg-secondary rounded-md font-medium text-highlight hover:text-blue-400 focus-within:outline-none"><span>Upload a file</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if(f) { setFile(f); setError(''); processFile(f); } }} accept=".csv" /></label></div><p className="text-xs text-gray-500">{file ? file.name : 'CSV up to 10MB'}</p></div></div></div>{error && <p className="text-red-400 text-sm">{error}</p>}</div> );
  const renderMap = () => ( <> <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto"><p className="text-sm text-text-secondary">Review the automatically matched fields. Correct any mismatches to ensure your data imports correctly. Name and Email are required.</p><div className="space-y-3">{csvHeaders.map(header => ( <div key={header} className="grid grid-cols-2 gap-4 items-center"><span className="font-medium text-white truncate" title={header}>{header}</span><select value={mappings[header]} onChange={(e) => setMappings(p => ({...p, [header]: e.target.value as ContactKey | 'ignore'}))} className="bg-accent text-white rounded-md p-2 focus:ring-2 focus:ring-highlight outline-none"><option value="ignore">-- Ignore this field --</option>{CONTACT_FIELDS.map(field => ( <option key={field.key} value={field.key}>{field.label}</option> ))}</select></div> ))}</div>{error && <p className="text-red-400 text-sm mt-4">{error}</p>}</div><div className="p-6 bg-accent rounded-b-lg flex justify-end space-x-3"><button onClick={() => setStep('upload')} className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600">Back</button><button onClick={handleProceedToReview} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Review & Continue</button></div> </> );
  const renderReview = () => ( <> <div className="p-6 max-h-[60vh] overflow-y-auto"> <div className="flex items-start bg-yellow-500/10 text-yellow-300 p-3 rounded-md mb-4"><ExclamationIcon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" /><p className="text-sm">We found {duplicates.length} potential duplicate(s) based on matching emails or Instagram handles. Please choose how to handle each one.</p></div> <div className="space-y-4"> {duplicates.map((dup, index) => ( <div key={index} className="bg-accent p-4 rounded-lg"> <h4 className="font-semibold text-white border-b border-gray-600 pb-2 mb-2">Potential Duplicate: {dup.incoming.name}</h4> <div className="grid grid-cols-2 gap-4 text-xs"> <div> <p className="font-bold text-text-secondary mb-1">EXISTING CONTACT</p> <p className="text-white">{dup.existing.name}</p> <p className="text-text-secondary">{dup.existing.email}</p> <p className="text-text-secondary">{dup.existing.instagramHandle}</p> </div> <div> <p className="font-bold text-text-secondary mb-1">INCOMING FROM CSV</p> <p className="text-white">{dup.incoming.name}</p> <p className="text-text-secondary">{dup.incoming.email}</p> <p className="text-text-secondary">{dup.incoming.instagramHandle}</p> </div> </div> <div className="mt-3 flex space-x-2 text-sm"> <button onClick={() => handleResolutionChange(index, 'update')} className={`px-3 py-1 rounded w-full text-center ${dup.resolution === 'update' ? 'bg-highlight text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>Update Existing</button> <button onClick={() => handleResolutionChange(index, 'skip')} className={`px-3 py-1 rounded w-full text-center ${dup.resolution === 'skip' ? 'bg-highlight text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>Skip Import</button> <button onClick={() => handleResolutionChange(index, 'import_new')} className={`px-3 py-1 rounded w-full text-center ${dup.resolution === 'import_new' ? 'bg-highlight text-white' : 'bg-gray-600 hover:bg-gray-500'}`}>Import as New</button> </div> </div> ))} </div> </div> <div className="p-6 bg-accent rounded-b-lg flex justify-end space-x-3"><button onClick={() => setStep('map')} className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600">Back to Mapping</button><button onClick={handleAfterReview} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Confirm & Continue</button></div> </> );
  const renderImporting = () => ( <div className="p-12 flex flex-col items-center justify-center"><p className="text-lg text-white">Importing your contacts...</p><p className="text-sm text-text-secondary">Please wait a moment.</p></div> );
  const renderErrorCorrection = () => (
    <>
      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
        <div className="flex items-start bg-red-500/10 text-red-300 p-3 rounded-md">
          <ExclamationIcon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{failedRows.length} row(s) could not be imported due to errors. Please correct the data for each row below and click 'Retry', or 'Skip' the row.</p>
        </div>
        {failedRows.map((row) => (
          <div key={row.id} className="bg-accent p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-white">Failed Row (Original Row #{row.id + 2})</h4>
                <button onClick={() => handleSkipRow(row.id)} className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 text-xs rounded">Skip Row</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {csvHeaders.map((header, cellIndex) => {
                const error = row.errors[header];
                return (
                  <div key={cellIndex}>
                      <label className="block text-xs font-medium text-text-secondary mb-1">{header}</label>
                      <input 
                        type="text" 
                        value={row.rowData[cellIndex] || ''}
                        onChange={(e) => handleRowEdit(row.id, cellIndex, e.target.value)}
                        className={`w-full bg-primary p-2 rounded text-white text-sm border outline-none ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-transparent focus:border-highlight focus:ring-highlight'}`}
                      />
                      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="p-6 bg-accent rounded-b-lg flex justify-between items-center">
        <button onClick={() => handleFinalImport(parsedContacts, duplicates)} className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600">Finish & Skip Remaining</button>
        {failedRows.length > 0 && 
            <button onClick={handleRetryImport} className="bg-highlight text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-500">Retry Corrected Rows</button>
        }
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-secondary rounded-lg shadow-2xl w-full max-w-4xl">
        <div className="p-6 border-b border-accent flex justify-between items-center"><h2 className="text-xl font-bold text-white">Import Contacts ({step.replace('_', ' ')})</h2><button onClick={onClose} className="text-text-secondary hover:text-white transition-colors"><CloseIcon /></button></div>
        {step === 'upload' && renderUpload()}
        {step === 'map' && renderMap()}
        {step === 'review' && renderReview()}
        {step === 'error_correction' && renderErrorCorrection()}
        {step === 'importing' && renderImporting()}
      </div>
    </div>
  );
};