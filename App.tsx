

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { Analytics } from './components/Analytics';
import { ContactModal } from './components/ContactModal';
import { ImportModal } from './components/ImportModal';
import { TableView } from './components/TableView';
import { Settings } from './components/Settings';
import { TasksView } from './components/TasksView';
import { NewContactModal } from './components/NewContactModal';
import { Contact, View, Interaction, AppSettings, GoogleAuthState, InteractionType, PartnershipType, TableFilter, Task } from './types';
import { MOCK_CONTACTS, DEFAULT_PIPELINE_STAGES } from './constants';
import { initGmailService, signIn, signOut, fetchEmailsForContact } from './services/gmailService';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const savedContacts = localStorage.getItem('crm_contacts');
    return savedContacts ? JSON.parse(savedContacts) : MOCK_CONTACTS;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const savedTasks = localStorage.getItem('crm_tasks');
    return savedTasks ? JSON.parse(savedTasks) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
      const savedSettings = localStorage.getItem('crm_settings');
      return savedSettings ? JSON.parse(savedSettings) : {
        productContext: 'Our product is a revolutionary AI-powered golf swing analysis tool that provides real-time feedback to instructors and students.',
        defaultFollowUpDays: 30,
        googleClientId: '',
        pipelineStages: DEFAULT_PIPELINE_STAGES,
      };
  });

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isNewContactModalOpen, setNewContactModalOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null);
  const [googleAuthState, setGoogleAuthState] = useState<GoogleAuthState>({ isAuthenticated: false });

  useEffect(() => {
    initGmailService(settings.googleClientId, (authState) => {
      setGoogleAuthState(authState);
      localStorage.setItem('crm_gmail_auth', JSON.stringify(authState));
    });
    const savedAuth = localStorage.getItem('crm_gmail_auth');
    if (savedAuth) {
        setGoogleAuthState(JSON.parse(savedAuth));
    }
  }, [settings.googleClientId]);

  useEffect(() => { localStorage.setItem('crm_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('crm_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('crm_tasks', JSON.stringify(tasks)); }, [tasks]);

  const handleContactUpdate = useCallback((updatedContact: Contact) => {
    if (updatedContact.pipelineStage !== 'Closed - Success' && updatedContact.partnershipType) {
        updatedContact.partnershipType = undefined;
        updatedContact.partnerDetails = undefined;
    }
    setContacts(prev => prev.map(c => c.id === updatedContact.id ? updatedContact : c));
    setSelectedContact(updatedContact);
  }, []);

  const handleBulkUpdate = useCallback((contactIds: string[], updates: Partial<Pick<Contact, 'pipelineStage' | 'tags'>>) => {
    setContacts(prev => prev.map(c => {
      if (contactIds.includes(c.id)) {
        const updatedContact = { ...c, ...updates };
        if (updates.tags && c.tags) {
            // Merge tags and remove duplicates
            updatedContact.tags = Array.from(new Set([...c.tags, ...updates.tags]));
        }
        return updatedContact;
      }
      return c;
    }));
  }, []);
  
  const handleAddInteraction = useCallback((contactId: string, interaction: Interaction) => {
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        const updatedContact: Contact = {
          ...c,
          interactions: [interaction, ...c.interactions],
          lastContacted: interaction.date,
        };
        if (selectedContact?.id === contactId) {
          setSelectedContact(updatedContact);
        }
        return updatedContact;
      }
      return c;
    }));
  }, [selectedContact]);
  
  const handleSyncGmail = useCallback(async (contact: Contact) => {
    if (!googleAuthState.isAuthenticated || !googleAuthState.profile?.email) {
        alert("Please connect to Gmail in Settings first.");
        return;
    }
    const emails = await fetchEmailsForContact(contact.email);
    const existingInteractionNotes = new Set(contact.interactions.map(i => i.notes));
    const myEmail = googleAuthState.profile.email;

    const newInteractions: Interaction[] = [];
    let hasReply = false;

    emails.forEach(email => {
        const note = `Subject: ${email.subject}\n\n${email.snippet}`;
        if (!existingInteractionNotes.has(note)) {
            newInteractions.push({
                id: `gmail-${email.id}`,
                type: InteractionType.EMAIL,
                date: new Date(parseInt(email.internalDate)).toISOString(),
                notes: note,
                outcome: 'Synced from Gmail',
            });
            // Check if the email is a reply from the contact
            if (email.from && email.from.toLowerCase().includes(contact.email.toLowerCase()) && !email.from.toLowerCase().includes(myEmail.toLowerCase())) {
                hasReply = true;
            }
        }
    });
    
    if (newInteractions.length > 0) {
       setContacts(prev => prev.map(c => {
          if (c.id === contact.id) {
            let updatedContact: Contact = {
              ...c,
              interactions: [...newInteractions, ...c.interactions],
              lastContacted: newInteractions[0].date,
            };
            // Automation: If a reply is detected and stage is 'Contacted', move to 'Responded'
            if (hasReply && updatedContact.pipelineStage === 'Contacted') {
                updatedContact.pipelineStage = 'Responded';
            }
            if(selectedContact?.id === contact.id) {
              setSelectedContact(updatedContact);
            }
            return updatedContact;
          }
          return c;
       }));
    } else {
        alert("No new emails found for this contact.");
    }
  }, [googleAuthState, selectedContact]);

  const handleDragEnd = useCallback((contactId: string, newStage: string) => {
    setContacts(prev => prev.map(c => {
      if (c.id === contactId) {
        let updatedContact: Contact = { ...c, pipelineStage: newStage };
        if (newStage === 'Closed - Success' && !updatedContact.partnershipType) {
            setSelectedContact(updatedContact);
        }
        if (newStage !== 'Closed - Success' && updatedContact.partnershipType) {
            updatedContact.partnershipType = undefined;
            updatedContact.partnerDetails = undefined;
        }
        return updatedContact;
      }
      return c;
    }));
  }, []);
  
  const handleCreateContact = useCallback((newContactData: Omit<Contact, 'id'>) => {
    const newContact: Contact = {
        ...newContactData,
        id: `manual-${Date.now()}`
    };
    setContacts(prev => [newContact, ...prev]);
  }, []);

  const handleTaskUpdate = useCallback((updatedTask: Task) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  }, []);

  const handleTaskAdd = useCallback((newTask: Omit<Task, 'id'>) => {
    const taskWithId: Task = { ...newTask, id: `task-${Date.now()}`};
    setTasks(prev => [taskWithId, ...prev]);
  }, []);

  const handleTaskDelete = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  }, []);

  const handleNavigate = (targetView: View, filter?: TableFilter) => {
    setTableFilter(filter || null);
    setView(targetView);
  };
  
  const handleExport = useCallback(() => {
    const escapeCsvCell = (cellData: any) => {
      if (cellData === undefined || cellData === null) return '';
      let cell = String(cellData);
      if (cell.includes(',')) {
        cell = `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    };

    const headers = [
      'id', 'name', 'email', 'phone', 'instagramHandle', 'followers', 'following',
      'posts', 'location', 'pipelineStage', 'lastContacted', 'website',
      'biography', 'notes', 'tags', 'dealType', 'contractSigned', 'continueFollowUp',
      'drillsAgreed', 'drillsDelivered', 'testimonialAgreed', 'testimonialDelivered',
      'websiteLinkAgreed', 'websiteLinkDelivered', 'socialPostAgreed', 'socialPostDelivered'
    ];

    const csvContent = [
      headers.join(','),
      ...contacts.map(c => [
        escapeCsvCell(c.id),
        escapeCsvCell(c.name),
        escapeCsvCell(c.email),
        escapeCsvCell(c.phone),
        escapeCsvCell(c.instagramHandle),
        escapeCsvCell(c.followers),
        escapeCsvCell(c.following),
        escapeCsvCell(c.posts),
        escapeCsvCell(c.location),
        escapeCsvCell(c.pipelineStage),
        escapeCsvCell(c.lastContacted),
        escapeCsvCell(c.website),
        escapeCsvCell(c.biography),
        escapeCsvCell(c.notes),
        escapeCsvCell(c.tags?.join(';')),
        escapeCsvCell(c.partnershipType),
        escapeCsvCell(c.partnerDetails?.contractSigned),
        escapeCsvCell(c.partnerDetails?.continueFollowUp),
        escapeCsvCell(c.partnerDetails?.drillVideosAgreed),
        escapeCsvCell(c.partnerDetails?.drillVideosDelivered),
        escapeCsvCell(c.partnerDetails?.testimonialVideoAgreed),
        escapeCsvCell(c.partnerDetails?.testimonialVideoDelivered),
        escapeCsvCell(c.partnerDetails?.websiteLinkAgreed),
        escapeCsvCell(c.partnerDetails?.websiteLinkDelivered),
        escapeCsvCell(c.partnerDetails?.socialPostAgreed),
        escapeCsvCell(c.partnerDetails?.socialPostDelivered),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gemini-crm-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [contacts]);
  
  const contactsToFollowUp = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return contacts.filter(c => {
      if (c.partnershipType === PartnershipType.PARTNER || ['Closed - Success', 'Closed - Unsuccessful'].includes(c.pipelineStage)) return false;
      if (c.nextFollowUpDate) return new Date(c.nextFollowUpDate) <= today;
      if (!c.lastContacted) return true;
      const lastContactDate = new Date(c.lastContacted);
      const followUpThreshold = new Date(lastContactDate);
      followUpThreshold.setDate(lastContactDate.getDate() + settings.defaultFollowUpDays);
      return followUpThreshold <= today;
    });
  }, [contacts, settings.defaultFollowUpDays]);

  const partnersToFollowUp = useMemo(() => contacts.filter(c => c.partnershipType === PartnershipType.PARTNER && c.partnerDetails?.continueFollowUp), [contacts]);

  const renderView = () => {
    switch (view) {
      case 'dashboard': return <Dashboard contacts={contacts} onSelectContact={setSelectedContact} contactsToFollowUp={contactsToFollowUp} partnersToFollowUp={partnersToFollowUp} onNavigate={handleNavigate} tasks={tasks} settings={settings} />;
      case 'kanban': return <KanbanBoard contacts={contacts} pipelineStages={settings.pipelineStages} onDragEnd={handleDragEnd} onSelectContact={setSelectedContact} />;
      case 'table': return <TableView contacts={contacts} onSelectContact={setSelectedContact} activeFilter={tableFilter} onClearFilter={() => setTableFilter(null)} onBulkUpdate={handleBulkUpdate} pipelineStages={settings.pipelineStages} />;
      case 'analytics': return <Analytics contacts={contacts} pipelineStages={settings.pipelineStages} />;
      case 'tasks': return <TasksView tasks={tasks} contacts={contacts} onUpdateTask={handleTaskUpdate} onAddTask={handleTaskAdd} onDeleteTask={handleTaskDelete} onSelectContact={setSelectedContact} />;
      case 'settings': return <Settings settings={settings} onSettingsChange={setSettings} googleAuthState={googleAuthState} onGoogleSignIn={signIn} onGoogleSignOut={signOut} />;
      default: return <Dashboard contacts={contacts} onSelectContact={setSelectedContact} contactsToFollowUp={contactsToFollowUp} partnersToFollowUp={partnersToFollowUp} onNavigate={handleNavigate} tasks={tasks} settings={settings} />;
    }
  };

  return (
    <div className="min-h-screen bg-primary font-sans">
      <Header activeView={view} onViewChange={setView} onOpenImportModal={() => setImportModalOpen(true)} onOpenNewContactModal={() => setNewContactModalOpen(true)} onExport={handleExport} />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderView()}
      </main>
      {selectedContact && <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} onUpdate={handleContactUpdate} onAddInteraction={handleAddInteraction} onSyncGmail={handleSyncGmail} isGmailConnected={googleAuthState.isAuthenticated} settings={settings} tasks={tasks.filter(t => t.contactId === selectedContact.id)} onTaskAdd={handleTaskAdd} onTaskUpdate={handleTaskUpdate} onTaskDelete={handleTaskDelete} />}
      {isImportModalOpen && <ImportModal onClose={() => setImportModalOpen(false)} existingContacts={contacts} onImport={(newContacts, updatedContacts) => { setContacts(prev => { const updatedMap = new Map(updatedContacts.map(c => [c.id, c])); const unchanged = prev.filter(c => !updatedMap.has(c.id)); return [...newContacts, ...updatedContacts, ...unchanged]; }); setImportModalOpen(false); }} />}
      {isNewContactModalOpen && <NewContactModal onClose={() => setNewContactModalOpen(false)} onCreateContact={(data) => { handleCreateContact(data); setNewContactModalOpen(false); }} pipelineStages={settings.pipelineStages}/>}
    </div>
  );
};

export default App;
