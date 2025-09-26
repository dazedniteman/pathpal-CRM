
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';

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
import { Auth } from './components/Auth';
import { Contact, View, Interaction, AppSettings, GoogleAuthState, InteractionType, PartnershipType, TableFilter, Task } from './types';
import { DEFAULT_PIPELINE_STAGES } from './constants';
import { initGmailService, signIn, signOut, fetchEmailsForContact } from './services/gmailService';
import * as db from './services/dataService';

const CrmApp: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<View>('dashboard');
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    productContext: 'Our product is a revolutionary AI-powered golf swing analysis tool that provides real-time feedback to instructors and students.',
    defaultFollowUpDays: 30,
    googleClientId: '',
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    kanbanViews: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isNewContactModalOpen, setNewContactModalOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null);
  const [googleAuthState, setGoogleAuthState] = useState<GoogleAuthState>({ isAuthenticated: false });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [fetchedContacts, fetchedTasks, fetchedSettings] = await Promise.all([
        db.getContacts(),
        db.getTasks(),
        db.getSettings()
      ]);
      setContacts(fetchedContacts);
      setTasks(fetchedTasks);
      if (fetchedSettings) {
        setSettings({
            ...fetchedSettings,
            kanbanViews: fetchedSettings.kanbanViews || [],
        });
      } else {
        // If no settings exist for the user, create default ones
        const defaultSettings = {
          productContext: 'Our product is a revolutionary AI-powered golf swing analysis tool that provides real-time feedback to instructors and students.',
          defaultFollowUpDays: 30,
          googleClientId: '',
          pipelineStages: DEFAULT_PIPELINE_STAGES,
          kanbanViews: [
            {
              id: `view-${Date.now()}-1`,
              name: 'Initial Outreach',
              stages: ['To Reach Out', 'Contacted'],
            },
            {
              id: `view-${Date.now()}-2`,
              name: 'Engaged',
              stages: ['Responded', 'Meeting Booked', 'On Hold'],
            },
            {
              id: `view-${Date.now()}-3`,
              name: 'Closed',
              stages: ['Closed - Success', 'Closed - Unsuccessful'],
            }
          ],
        };
        await db.saveSettings(defaultSettings);
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    initGmailService(settings.googleClientId, (authState) => {
      setGoogleAuthState(authState);
    });
  }, [settings.googleClientId]);

  const handleSettingsUpdate = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.saveSettings(newSettings);
  }, []);

  const handleContactUpdate = useCallback(async (updatedContact: Contact) => {
    if (updatedContact.pipelineStage !== 'Closed - Success' && updatedContact.partnershipType) {
        updatedContact.partnershipType = undefined;
        updatedContact.partnerDetails = undefined;
    }
    const savedContact = await db.updateContact(updatedContact);
    setContacts(prev => prev.map(c => c.id === savedContact.id ? savedContact : c));
    setSelectedContact(savedContact);
  }, []);

  const handleBulkUpdate = useCallback(async (contactIds: string[], updates: Partial<Pick<Contact, 'pipelineStage' | 'tags'>>) => {
    const updatedContacts = await db.bulkUpdateContacts(contactIds, updates);
    const updatedMap = new Map(updatedContacts.map(c => [c.id, c]));
    setContacts(prev => prev.map(c => updatedMap.get(c.id) || c));
  }, []);
  
  const handleAddInteraction = useCallback(async (contactId: string, interaction: Interaction) => {
    const contactToUpdate = contacts.find(c => c.id === contactId);
    if (!contactToUpdate) return;

    const updatedInteractions = [interaction, ...contactToUpdate.interactions];
    const lastContacted = interaction.date;

    const contactDataToUpdate: Partial<Contact> = {
        interactions: updatedInteractions,
        lastContacted,
    };
    
    if (contactToUpdate.pipelineStage === 'To Reach Out') {
        contactDataToUpdate.pipelineStage = 'Contacted';
    }

    const updatedContact = await db.updateContact({ ...contactToUpdate, ...contactDataToUpdate });
    
    setContacts(prev => prev.map(c => (c.id === contactId ? updatedContact : c)));
    if (selectedContact?.id === contactId) {
        setSelectedContact(updatedContact);
    }
  }, [contacts, selectedContact]);
  
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
            if (email.from && email.from.toLowerCase().includes(contact.email.toLowerCase()) && !email.from.toLowerCase().includes(myEmail.toLowerCase())) {
                hasReply = true;
            }
        }
    });
    
    if (newInteractions.length > 0) {
       let updatedContactData: Partial<Contact> = {
          interactions: [...newInteractions, ...contact.interactions],
          lastContacted: newInteractions[0].date,
        };
        if (hasReply && contact.pipelineStage === 'Contacted') {
            updatedContactData.pipelineStage = 'Responded';
        }

        const updatedContact = await db.updateContact({ ...contact, ...updatedContactData });

       setContacts(prev => prev.map(c => c.id === contact.id ? updatedContact : c));
       if(selectedContact?.id === contact.id) {
         setSelectedContact(updatedContact);
       }
    } else {
        alert("No new emails found for this contact.");
    }
  }, [googleAuthState, selectedContact, contacts]);

  const handleDragEnd = useCallback(async (contactId: string, newStage: string) => {
    const contactToUpdate = contacts.find(c => c.id === contactId);
    if (!contactToUpdate || contactToUpdate.pipelineStage === newStage) return;

    let updatedContactData: Contact = { ...contactToUpdate, pipelineStage: newStage };
    if (newStage === 'Closed - Success' && !updatedContactData.partnershipType) {
        setSelectedContact(updatedContactData); // Open modal to classify deal
    }
    if (newStage !== 'Closed - Success' && updatedContactData.partnershipType) {
        updatedContactData.partnershipType = undefined;
        updatedContactData.partnerDetails = undefined;
    }
    
    const savedContact = await db.updateContact(updatedContactData);
    setContacts(prev => prev.map(c => (c.id === contactId ? savedContact : c)));
  }, [contacts]);
  
  const handleCreateContact = useCallback(async (newContactData: Omit<Contact, 'id'>) => {
    const newContact = await db.createContact(newContactData);
    setContacts(prev => [newContact, ...prev]);
  }, []);

  const handleDeleteContact = useCallback(async (contactId: string) => {
    await db.deleteContact(contactId);
    setContacts(prev => prev.filter(c => c.id !== contactId));
    setSelectedContact(null);
  }, []);

  const handleTaskUpdate = useCallback(async (updatedTask: Task) => {
    const savedTask = await db.updateTask(updatedTask);
    setTasks(prev => prev.map(t => t.id === savedTask.id ? savedTask : t));
  }, []);

  const handleTaskAdd = useCallback(async (newTask: Omit<Task, 'id'>) => {
    const savedTask = await db.createTask(newTask);
    setTasks(prev => [savedTask, ...prev]);
  }, []);

  const handleTaskDelete = useCallback(async (taskId: string) => {
    await db.deleteTask(taskId);
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
      if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
        cell = `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    };

    const headers = ['id', 'name', 'email', 'phone', 'instagramHandle', 'followers', 'following', 'posts', 'location', 'pipelineStage', 'lastContacted', 'website', 'biography', 'notes', 'tags', 'partnershipType', 'contractSigned', 'continueFollowUp', 'drillVideosAgreed', 'drillVideosDelivered', 'testimonialVideoAgreed', 'testimonialVideoDelivered', 'websiteLinkAgreed', 'websiteLinkDelivered', 'socialPostAgreed', 'socialPostDelivered', 'communicationHistory'];
    
    const csvRows = contacts.flatMap(c => {
        const baseRow = [ 
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
        ];

        const sortedInteractions = c.interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        if (sortedInteractions.length === 0) {
            return [[...baseRow, ''].join(',')];
        }

        return sortedInteractions.map(interaction => {
            const communicationEntry = `[${new Date(interaction.date).toLocaleString()} - ${interaction.type}] ${interaction.notes}`;
            return [...baseRow, escapeCsvCell(communicationEntry)].join(',');
        });
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gemini-crm-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [contacts]);
  
  const handleImport = async (newContacts: Contact[], updatedContacts: Contact[]) => {
      const created = await db.bulkCreateContacts(newContacts);
      const updated = await db.bulkUpdateContacts(updatedContacts.map(c => c.id), updatedContacts);
      
      const updatedMap = new Map(updated.map(u => [u.id, u]));

      setContacts(prev => {
          const prevMap = new Map(prev.map(p => [p.id, p]));
          for (const u of updated) {
              prevMap.set(u.id, u);
          }
          return [...created, ...Array.from(prevMap.values())];
      });
      setImportModalOpen(false);
  };

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
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-highlight"></div>
        </div>
      );
    }
    switch (view) {
      case 'dashboard': return <Dashboard contacts={contacts} onSelectContact={setSelectedContact} contactsToFollowUp={contactsToFollowUp} partnersToFollowUp={partnersToFollowUp} onNavigate={handleNavigate} tasks={tasks} settings={settings} />;
      case 'kanban': return <KanbanBoard contacts={contacts} pipelineStages={settings.pipelineStages} onDragEnd={handleDragEnd} onSelectContact={setSelectedContact} kanbanViews={settings.kanbanViews || []} />;
      case 'table': return <TableView contacts={contacts} onSelectContact={setSelectedContact} activeFilter={tableFilter} onClearFilter={() => setTableFilter(null)} onBulkUpdate={handleBulkUpdate} pipelineStages={settings.pipelineStages} />;
      case 'analytics': return <Analytics contacts={contacts} pipelineStages={settings.pipelineStages} />;
      case 'tasks': return <TasksView tasks={tasks} contacts={contacts} onUpdateTask={handleTaskUpdate} onAddTask={handleTaskAdd} onDeleteTask={handleTaskDelete} onSelectContact={setSelectedContact} />;
      case 'settings': return <Settings settings={settings} onSettingsChange={handleSettingsUpdate} googleAuthState={googleAuthState} onGoogleSignIn={signIn} onGoogleSignOut={signOut} />;
      default: return <Dashboard contacts={contacts} onSelectContact={setSelectedContact} contactsToFollowUp={contactsToFollowUp} partnersToFollowUp={partnersToFollowUp} onNavigate={handleNavigate} tasks={tasks} settings={settings} />;
    }
  };

  return (
    <div className="min-h-screen bg-primary font-sans">
      <Header activeView={view} onViewChange={setView} onOpenImportModal={() => setImportModalOpen(true)} onOpenNewContactModal={() => setNewContactModalOpen(true)} onExport={handleExport} />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderView()}
      </main>
      {selectedContact && <ContactModal contact={selectedContact} onClose={() => setSelectedContact(null)} onUpdate={handleContactUpdate} onAddInteraction={handleAddInteraction} onSyncGmail={handleSyncGmail} isGmailConnected={googleAuthState.isAuthenticated} settings={settings} tasks={tasks.filter(t => t.contactId === selectedContact.id)} onTaskAdd={handleTaskAdd} onTaskUpdate={handleTaskUpdate} onTaskDelete={handleTaskDelete} onDelete={handleDeleteContact} />}
      {isImportModalOpen && <ImportModal onClose={() => setImportModalOpen(false)} existingContacts={contacts} onImport={handleImport} />}
      {isNewContactModalOpen && <NewContactModal onClose={() => setNewContactModalOpen(false)} onCreateContact={(data) => { handleCreateContact(data); setNewContactModalOpen(false); }} pipelineStages={settings.pipelineStages}/>}
    </div>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription?.unsubscribe();
  }, [])

  if (!session) {
    return <Auth />
  }
  else {
    return <CrmApp session={session} />
  }
}

export default App;
