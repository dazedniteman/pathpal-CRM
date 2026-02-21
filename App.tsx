
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from './services/supabaseClient';
import type { Session } from '@supabase/supabase-js';

import { Sidebar } from './components/Sidebar';
import { CommandCenter } from './components/CommandCenter';
import { KanbanBoard } from './components/KanbanBoard';
import { Analytics } from './components/Analytics';
import { ContactModal } from './components/ContactModal';
import { ImportModal } from './components/ImportModal';
import { TableView } from './components/TableView';
import { Settings } from './components/Settings';
import { TasksView } from './components/TasksView';
import { NewContactModal } from './components/NewContactModal';
import { Auth } from './components/Auth';
import { EmailCompose } from './components/EmailCompose';
import { OutreachTrack } from './components/tracks/OutreachTrack';
import { PeopleWithProductTrack } from './components/tracks/PeopleWithProductTrack';
import { OtherTrack } from './components/tracks/OtherTrack';
import { ProductLibrary } from './components/ProductLibrary';
import { EmailTemplateLibrary } from './components/EmailTemplateLibrary';
import { BatchOutreachModal } from './components/BatchOutreachModal';
import { SequenceBuilder } from './components/SequenceBuilder';

import {
  Contact, View, Interaction, AppSettings, GoogleAuthState,
  InteractionType, PartnershipType, TableFilter, Task, EmailDraft, GmailAlias,
  Product, ContactProduct, EmailTemplate, Sequence, ContactSequence, Project, ContactProject,
} from './types';
import { DEFAULT_PIPELINE_STAGES } from './constants';
import {
  initGmailService, signIn, signOut, fetchEmailsForContact,
  fetchEmailsForContactWithBodies, fetchEmailAliases, sendEmail,
  getContactsNeedingEmailReply, UnrepliedEmail,
  bulkSyncAllEmails, PendingContact,
} from './services/gmailService';
import { PendingContactsModal } from './components/PendingContactsModal';
import * as db from './services/dataService';

const CrmApp: React.FC<{ session: Session }> = ({ session }) => {
  const [view, setView] = useState<View>('dashboard');

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    productContext: 'PathPal Golf sells premium physical golf training aids: The PathPal (swing path trainer) and The TrueStrike (feedback mat). We work with golf instructors and media to grow our brand through authentic partnerships and education.',
    defaultFollowUpDays: 30,
    googleClientId: '',
    pipelineStages: DEFAULT_PIPELINE_STAGES,
    kanbanViews: [],
    defaultAiModel: 'gemini-3-flash-preview',
    gmailIgnoreList: [],
    newsletterAutoFilter: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isNewContactModalOpen, setNewContactModalOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState<TableFilter | null>(null);
  const [googleAuthState, setGoogleAuthState] = useState<GoogleAuthState>({ isAuthenticated: false });

  // Email compose state
  const [isEmailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailComposeDraft, setEmailComposeDraft] = useState<Partial<EmailDraft>>({});
  const [emailComposeContact, setEmailComposeContact] = useState<Contact | undefined>(undefined);
  const [gmailAliases, setGmailAliases] = useState<GmailAlias[]>([]);

  // Morning briefing state
  const [unrepliedEmails, setUnrepliedEmails] = useState<UnrepliedEmail[]>([]);
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);

  // Bulk Gmail sync state
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
  const [isPendingModalOpen, setIsPendingModalOpen] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<{ processed: number; total: number } | null>(null);

  // Phase 2 state
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [allContactProducts, setAllContactProducts] = useState<ContactProduct[]>([]);
  const [isBatchOutreachOpen, setIsBatchOutreachOpen] = useState(false);
  const [batchOutreachContacts, setBatchOutreachContacts] = useState<Contact[]>([]);

  // Phase 3 state
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [allEnrollments, setAllEnrollments] = useState<ContactSequence[]>([]);

  // Phase 4 state
  const [projects, setProjects] = useState<Project[]>([]);
  const [allContactProjects, setAllContactProjects] = useState<ContactProject[]>([]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [fetchedContacts, fetchedTasks, fetchedSettings, fetchedProducts, fetchedTemplates, fetchedSequences, fetchedEnrollments, fetchedProjects, fetchedContactProjects] = await Promise.all([
        db.getContacts(),
        db.getTasks(),
        db.getSettings(),
        db.getProducts(),
        db.getTemplates(),
        db.getSequences(),
        db.getContactSequences(),
        db.getProjects(),
        db.getContactProjects(),
      ]);
      setProducts(fetchedProducts);
      setTemplates(fetchedTemplates);
      setSequences(fetchedSequences);
      setAllEnrollments(fetchedEnrollments);
      setProjects(fetchedProjects);
      setAllContactProjects(fetchedContactProjects);
      setContacts(fetchedContacts);
      setTasks(fetchedTasks);
      if (fetchedSettings) {
        setSettings({
          productContext: 'PathPal Golf sells premium physical golf training aids: The PathPal (swing path trainer) and The TrueStrike (feedback mat). We work with golf instructors and media to grow our brand through authentic partnerships and education.',
          defaultFollowUpDays: 30,
          defaultAiModel: 'gemini-3-flash-preview',
          gmailIgnoreList: [],
          newsletterAutoFilter: true,
          ...fetchedSettings,
          kanbanViews: fetchedSettings.kanbanViews || [],
        });
      } else {
        const defaultSettings: AppSettings = {
          productContext: 'PathPal Golf sells premium physical golf training aids: The PathPal (swing path trainer) and The TrueStrike (feedback mat). We work with golf instructors and media to grow our brand through authentic partnerships and education.',
          defaultFollowUpDays: 30,
          googleClientId: '',
          pipelineStages: DEFAULT_PIPELINE_STAGES,
          defaultAiModel: 'gemini-3-flash-preview',
          gmailIgnoreList: [],
          newsletterAutoFilter: true,
          kanbanViews: [
            { id: `view-${Date.now()}-1`, name: 'Initial Outreach', stages: ['To Reach Out', 'Contacted'] },
            { id: `view-${Date.now()}-2`, name: 'Engaged', stages: ['Responded', 'Meeting Booked', 'On Hold'] },
            { id: `view-${Date.now()}-3`, name: 'Closed', stages: ['Closed - Success', 'Closed - Unsuccessful'] },
          ],
        };
        await db.saveSettings(defaultSettings);
        setSettings(defaultSettings);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Init Gmail + load aliases when authenticated
  useEffect(() => {
    initGmailService(settings.googleClientId, async (authState) => {
      setGoogleAuthState(authState);
      if (authState.isAuthenticated) {
        // Load aliases
        const aliases = await fetchEmailAliases();
        setGmailAliases(aliases);
        // Background sync: compute unreplied emails from existing interactions
        // (full sync happens when user clicks Sync Gmail)
        setUnrepliedEmails(prev =>
          getContactsNeedingEmailReply(contacts, settings.gmailIgnoreList, settings.newsletterAutoFilter)
        );
      }
    });
  }, [settings.googleClientId]);

  // Recompute unreplied emails when contacts change
  useEffect(() => {
    if (googleAuthState.isAuthenticated) {
      setUnrepliedEmails(
        getContactsNeedingEmailReply(contacts, settings.gmailIgnoreList, settings.newsletterAutoFilter)
      );
    }
  }, [contacts, googleAuthState.isAuthenticated, settings.gmailIgnoreList, settings.newsletterAutoFilter]);

  const handleSettingsUpdate = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    await db.saveSettings(newSettings);
  }, []);

  const handleContactUpdate = useCallback(async (updatedContact: Contact) => {
    const previousContact = contacts.find(c => c.id === updatedContact.id);
    const stageChanged = previousContact?.pipelineStage !== updatedContact.pipelineStage;

    if (updatedContact.pipelineStage !== 'Closed - Success' && updatedContact.partnershipType) {
      updatedContact.partnershipType = undefined;
      updatedContact.partnerDetails = undefined;
    }
    const savedContact = await db.updateContact(updatedContact);
    setContacts(prev => prev.map(c => c.id === savedContact.id ? savedContact : c));
    setSelectedContact(savedContact);

    // Auto-enroll in trigger sequences when stage changes
    if (stageChanged && savedContact.pipelineStage) {
      const triggerSeqs = sequences.filter(
        s => s.isActive && s.triggerStage === savedContact.pipelineStage
      );
      for (const seq of triggerSeqs) {
        const alreadyEnrolled = allEnrollments.some(
          e => e.contactId === savedContact.id && e.sequenceId === seq.id
        );
        if (!alreadyEnrolled) {
          const newEnrollment = await db.enrollContact(savedContact.id, seq.id);
          setAllEnrollments(prev => [...prev, newEnrollment]);
        }
      }
    }
  }, [contacts, sequences, allEnrollments]);

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

    const contactDataToUpdate: Partial<Contact> = { interactions: updatedInteractions, lastContacted };

    if (contactToUpdate.pipelineStage === 'To Reach Out') {
      contactDataToUpdate.pipelineStage = 'Contacted';
    }

    const updatedContact = await db.updateContact({ ...contactToUpdate, ...contactDataToUpdate });

    setContacts(prev => prev.map(c => (c.id === contactId ? updatedContact : c)));
    if (selectedContact?.id === contactId) {
      setSelectedContact(updatedContact);
    }
  }, [contacts, selectedContact]);

  // Per-contact Gmail sync (used from ContactModal)
  const handleSyncGmail = useCallback(async (contact: Contact) => {
    if (!googleAuthState.isAuthenticated || !googleAuthState.profile?.email) {
      alert("Please connect to Gmail in Settings first.");
      return;
    }
    const emails = await fetchEmailsForContactWithBodies(contact.email);
    if (emails.length === 0) {
      alert("No new emails found for this contact.");
      return;
    }

    const existingIds = new Set(contact.interactions.map(i => i.id));
    const newInteractions = emails.filter(e => !existingIds.has(e.id));

    if (newInteractions.length === 0) {
      alert("No new emails found for this contact.");
      return;
    }

    const hasReply = newInteractions.some(i => !i.isSentByUser &&
      i.emailFrom?.toLowerCase().includes(contact.email.toLowerCase()));

    let updatedContactData: Partial<Contact> = {
      interactions: [...newInteractions, ...contact.interactions],
      lastContacted: newInteractions[0].date,
    };

    if (hasReply && contact.pipelineStage === 'Contacted') {
      updatedContactData.pipelineStage = 'Responded';
    }

    const updatedContact = await db.updateContact({ ...contact, ...updatedContactData });
    setContacts(prev => prev.map(c => c.id === contact.id ? updatedContact : c));
    if (selectedContact?.id === contact.id) {
      setSelectedContact(updatedContact);
    }
  }, [googleAuthState, selectedContact]);

  // Global Gmail sync for Command Center
  const handleGlobalGmailSync = useCallback(async () => {
    if (!googleAuthState.isAuthenticated) return;
    setIsSyncingGmail(true);
    try {
      // Sync top active contacts (not closed-unsuccessful) up to 20
      const activeContacts = contacts
        .filter(c => c.pipelineStage !== 'Closed - Unsuccessful')
        .sort((a, b) => new Date(b.lastContacted || 0).getTime() - new Date(a.lastContacted || 0).getTime())
        .slice(0, 20);

      const updatedContacts = [...contacts];

      for (const contact of activeContacts) {
        try {
          const emails = await fetchEmailsForContactWithBodies(contact.email);
          if (emails.length === 0) continue;

          const existingIds = new Set(contact.interactions.map(i => i.id));
          const newInteractions = emails.filter(e => !existingIds.has(e.id));
          if (newInteractions.length === 0) continue;

          const updatedContact = await db.updateContact({
            ...contact,
            interactions: [...newInteractions, ...contact.interactions],
            lastContacted: newInteractions[0].date,
          });

          const idx = updatedContacts.findIndex(c => c.id === updatedContact.id);
          if (idx !== -1) updatedContacts[idx] = updatedContact;
        } catch (err) {
          // Skip contacts that fail
          console.warn(`Failed to sync ${contact.email}:`, err);
        }
      }

      setContacts([...updatedContacts]);
    } finally {
      setIsSyncingGmail(false);
    }
  }, [googleAuthState.isAuthenticated, contacts]);

  // Bulk Gmail sync (180 days, all contacts)
  const handleBulkGmailSync = useCallback(async () => {
    if (!googleAuthState.isAuthenticated) {
      alert('Please connect to Gmail first.');
      return;
    }
    if (!window.confirm('This will scan your last 180 days of Gmail against all contacts. This may take a few minutes. Continue?')) return;

    setIsBulkSyncing(true);
    setBulkSyncProgress({ processed: 0, total: contacts.length });
    try {
      const result = await bulkSyncAllEmails(
        contacts,
        180,
        (processed, total) => setBulkSyncProgress({ processed, total })
      );

      // Apply matched interactions to contacts
      if (result.matched.length > 0) {
        const updatedContacts = [...contacts];
        for (const { contactId, newInteractions } of result.matched) {
          const idx = updatedContacts.findIndex(c => c.id === contactId);
          if (idx === -1) continue;
          const contact = updatedContacts[idx];
          const existingIds = new Set(contact.interactions.map(i => i.id));
          const trulyNew = newInteractions.filter(i => !existingIds.has(i.id));
          if (trulyNew.length === 0) continue;
          const merged = [...trulyNew, ...contact.interactions].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const updatedContact = await db.updateContact({
            ...contact,
            interactions: merged,
            lastContacted: merged[0].date,
          });
          updatedContacts[idx] = updatedContact;
        }
        setContacts(updatedContacts);
      }

      // Show pending contacts modal if there are unmatched senders
      if (result.pending.length > 0) {
        setPendingContacts(result.pending);
        setIsPendingModalOpen(true);
      } else {
        alert(`Bulk sync complete! Synced ${result.matched.length} contacts. No unknown senders found.`);
      }
    } catch (err) {
      console.error('Bulk sync error:', err);
      alert('Bulk sync failed. Please try again.');
    } finally {
      setIsBulkSyncing(false);
      setBulkSyncProgress(null);
    }
  }, [googleAuthState.isAuthenticated, contacts]);

  // Gmail auto-poll every 10 minutes when authenticated
  useEffect(() => {
    if (!googleAuthState.isAuthenticated) return;
    const interval = setInterval(() => {
      handleGlobalGmailSync();
    }, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [googleAuthState.isAuthenticated, handleGlobalGmailSync]);

  const handleDragEnd = useCallback(async (contactId: string, newStage: string) => {
    const contactToUpdate = contacts.find(c => c.id === contactId);
    if (!contactToUpdate || contactToUpdate.pipelineStage === newStage) return;

    let updatedContactData: Contact = { ...contactToUpdate, pipelineStage: newStage };
    if (newStage === 'Closed - Success' && !updatedContactData.partnershipType) {
      setSelectedContact(updatedContactData);
    }
    if (newStage !== 'Closed - Success' && updatedContactData.partnershipType) {
      updatedContactData.partnershipType = undefined;
      updatedContactData.partnerDetails = undefined;
    }

    const savedContact = await db.updateContact(updatedContactData);
    setContacts(prev => prev.map(c => (c.id === contactId ? savedContact : c)));

    // Auto-enroll trigger sequences
    const triggerSeqs = sequences.filter(s => s.isActive && s.triggerStage === newStage);
    for (const seq of triggerSeqs) {
      const alreadyEnrolled = allEnrollments.some(
        e => e.contactId === contactId && e.sequenceId === seq.id
      );
      if (!alreadyEnrolled) {
        const newEnrollment = await db.enrollContact(contactId, seq.id);
        setAllEnrollments(prev => [...prev, newEnrollment]);
      }
    }
  }, [contacts, sequences, allEnrollments]);

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

  // --- PRODUCT HANDLERS ---
  const handleCreateProduct = useCallback(async (productData: Omit<Product, 'id'>) => {
    const saved = await db.createProduct(productData);
    setProducts(prev => [...prev, saved]);
  }, []);

  const handleUpdateProduct = useCallback(async (product: Product) => {
    const saved = await db.updateProduct(product);
    setProducts(prev => prev.map(p => p.id === saved.id ? saved : p));
  }, []);

  const handleDeleteProduct = useCallback(async (productId: string) => {
    await db.deleteProduct(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    setAllContactProducts(prev => prev.filter(cp => cp.productId !== productId));
  }, []);

  // --- CONTACT-PRODUCT HANDLERS ---
  const handleLinkProduct = useCallback(async (link: Omit<ContactProduct, 'id'>) => {
    const saved = await db.linkContactProduct(link);
    setAllContactProducts(prev => [...prev, saved]);
  }, []);

  const handleUpdateContactProduct = useCallback(async (link: ContactProduct) => {
    const saved = await db.updateContactProduct(link);
    setAllContactProducts(prev => prev.map(cp => cp.id === saved.id ? saved : cp));
  }, []);

  const handleUnlinkProduct = useCallback(async (linkId: string) => {
    await db.unlinkContactProduct(linkId);
    setAllContactProducts(prev => prev.filter(cp => cp.id !== linkId));
  }, []);

  // --- TEMPLATE HANDLERS ---
  const handleCreateTemplate = useCallback(async (templateData: Omit<EmailTemplate, 'id'>) => {
    const saved = await db.createTemplate(templateData);
    setTemplates(prev => [...prev, saved]);
  }, []);

  const handleUpdateTemplate = useCallback(async (template: EmailTemplate) => {
    const saved = await db.updateTemplate(template);
    setTemplates(prev => prev.map(t => t.id === saved.id ? saved : t));
  }, []);

  const handleDeleteTemplate = useCallback(async (templateId: string) => {
    await db.deleteTemplate(templateId);
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  }, []);

  // --- SEQUENCE HANDLERS ---
  const handleCreateSequence = useCallback(async (data: Omit<Sequence, 'id' | 'createdAt'>) => {
    const saved = await db.createSequence(data);
    setSequences(prev => [...prev, saved]);
  }, []);

  const handleUpdateSequence = useCallback(async (seq: Sequence) => {
    const saved = await db.updateSequence(seq);
    setSequences(prev => prev.map(s => s.id === saved.id ? saved : s));
  }, []);

  const handleDeleteSequence = useCallback(async (seqId: string) => {
    await db.deleteSequence(seqId);
    setSequences(prev => prev.filter(s => s.id !== seqId));
    setAllEnrollments(prev => prev.filter(e => e.sequenceId !== seqId));
  }, []);

  const handleEnrollContact = useCallback(async (contactId: string, sequenceId: string) => {
    const alreadyEnrolled = allEnrollments.some(
      e => e.contactId === contactId && e.sequenceId === sequenceId
    );
    if (alreadyEnrolled) return;
    const enrollment = await db.enrollContact(contactId, sequenceId);
    setAllEnrollments(prev => [...prev, enrollment]);
  }, [allEnrollments]);

  const handleCompleteStep = useCallback(async (
    enrollmentId: string,
    stepId: string,
    sequence: Sequence,
  ) => {
    const updated = await db.completeStep(enrollmentId, stepId, sequence.steps.map(s => s.id));
    setAllEnrollments(prev =>
      prev
        .map(e => e.id === enrollmentId ? updated : e)
        .filter(e => !(e.id === enrollmentId && updated.status !== 'active'))
    );
  }, []);

  const handleUnenrollContact = useCallback(async (enrollmentId: string) => {
    await db.unenrollContact(enrollmentId);
    setAllEnrollments(prev => prev.filter(e => e.id !== enrollmentId));
  }, []);

  // --- PROJECT HANDLERS ---
  const handleCreateProject = useCallback(async (data: Omit<Project, 'id' | 'createdAt'>) => {
    const saved = await db.createProject(data);
    setProjects(prev => [...prev, saved]);
  }, []);

  const handleUpdateProject = useCallback(async (project: Project) => {
    const saved = await db.updateProject(project);
    setProjects(prev => prev.map(p => p.id === saved.id ? saved : p));
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    await db.deleteProject(projectId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setAllContactProjects(prev => prev.filter(cp => cp.projectId !== projectId));
  }, []);

  const handleLinkProject = useCallback(async (contactId: string, projectId: string) => {
    const alreadyLinked = allContactProjects.some(cp => cp.contactId === contactId && cp.projectId === projectId);
    if (alreadyLinked) return;
    const link = await db.linkContactProject({ contactId, projectId, status: 'active' });
    setAllContactProjects(prev => [...prev, link]);
  }, [allContactProjects]);

  const handleUnlinkProject = useCallback(async (linkId: string) => {
    await db.unlinkContactProject(linkId);
    setAllContactProjects(prev => prev.filter(cp => cp.id !== linkId));
  }, []);

  // --- BATCH OUTREACH HANDLERS ---
  const handleBatchOutreach = useCallback((selectedContacts: Contact[]) => {
    setBatchOutreachContacts(selectedContacts);
    setIsBatchOutreachOpen(true);
  }, []);

  const handleBatchSent = useCallback((results: { contact: Contact; interaction: Interaction }[]) => {
    // Bulk-add all interactions
    results.forEach(({ contact, interaction }) => {
      handleAddInteraction(contact.id, interaction);
    });
    // Increment template send counts if any (handled per-email in BatchOutreachModal already)
    setIsBatchOutreachOpen(false);
    setBatchOutreachContacts([]);
  }, [handleAddInteraction]);

  const handleNavigate = (targetView: View, filter?: TableFilter) => {
    setTableFilter(filter || null);
    setView(targetView);
  };

  // Open compose email modal
  const handleComposeEmail = useCallback((draft: Partial<EmailDraft>, contact?: Contact) => {
    setEmailComposeDraft(draft);
    setEmailComposeContact(contact);
    setEmailComposeOpen(true);
  }, []);

  // When an email is sent, log it as an interaction and track template usage
  const handleEmailSent = useCallback((draft: EmailDraft, contact?: Contact) => {
    if (contact) {
      handleAddInteraction(contact.id, {
        id: `sent-${Date.now()}`,
        type: InteractionType.EMAIL,
        date: new Date().toISOString(),
        notes: `Subject: ${draft.subject}\n\n${draft.body}`,
        emailSubject: draft.subject,
        emailTo: draft.to,
        emailFrom: draft.alias || '',
        isSentByUser: true,
        aliasUsed: draft.alias,
        templateId: draft.templateId,
      });
    }
    // Increment template send count if a template was used
    if (draft.templateId) {
      db.incrementTemplateSendCount(draft.templateId).catch(console.error);
      setTemplates(prev => prev.map(t =>
        t.id === draft.templateId ? { ...t, sendCount: (t.sendCount || 0) + 1 } : t
      ));
    }
    setEmailComposeOpen(false);
  }, [handleAddInteraction]);

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
        escapeCsvCell(c.id), escapeCsvCell(c.name), escapeCsvCell(c.email),
        escapeCsvCell(c.phone), escapeCsvCell(c.instagramHandle), escapeCsvCell(c.followers),
        escapeCsvCell(c.following), escapeCsvCell(c.posts), escapeCsvCell(c.location),
        escapeCsvCell(c.pipelineStage), escapeCsvCell(c.lastContacted), escapeCsvCell(c.website),
        escapeCsvCell(c.biography), escapeCsvCell(c.notes), escapeCsvCell(c.tags?.join(';')),
        escapeCsvCell(c.partnershipType), escapeCsvCell(c.partnerDetails?.contractSigned),
        escapeCsvCell(c.partnerDetails?.continueFollowUp), escapeCsvCell(c.partnerDetails?.drillVideosAgreed),
        escapeCsvCell(c.partnerDetails?.drillVideosDelivered), escapeCsvCell(c.partnerDetails?.testimonialVideoAgreed),
        escapeCsvCell(c.partnerDetails?.testimonialVideoDelivered), escapeCsvCell(c.partnerDetails?.websiteLinkAgreed),
        escapeCsvCell(c.partnerDetails?.websiteLinkDelivered), escapeCsvCell(c.partnerDetails?.socialPostAgreed),
        escapeCsvCell(c.partnerDetails?.socialPostDelivered),
      ];
      const sortedInteractions = [...c.interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sortedInteractions.length === 0) return [[...baseRow, ''].join(',')];
      return sortedInteractions.map(i => {
        const entry = `[${new Date(i.date).toLocaleString()} - ${i.type}] ${i.notes}`;
        return [...baseRow, escapeCsvCell(entry)].join(',');
      });
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `pathpal-crm-export-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [contacts]);

  const handleImport = async (newContacts: Contact[], updatedContacts: Contact[]) => {
    const created = await db.bulkCreateContacts(newContacts);
    await db.bulkUpdateContacts(updatedContacts.map(c => c.id), updatedContacts);
    setContacts(prev => {
      const prevMap = new Map(prev.map(p => [p.id, p]));
      for (const u of updatedContacts) { prevMap.set(u.id, u); }
      return [...created, ...Array.from(prevMap.values())];
    });
    setImportModalOpen(false);
  };

  // Legacy compat: contacts to follow up (used in kanban/table views)
  const contactsToFollowUp = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return contacts.filter(c => {
      if (c.partnershipType === PartnershipType.PARTNER || ['Closed - Success', 'Closed - Unsuccessful'].includes(c.pipelineStage)) return false;
      if (c.nextFollowUpDate) return new Date(c.nextFollowUpDate) <= today;
      if (!c.lastContacted) return true;
      const threshold = new Date(c.lastContacted);
      threshold.setDate(threshold.getDate() + settings.defaultFollowUpDays);
      return threshold <= today;
    });
  }, [contacts, settings.defaultFollowUpDays]);

  const partnersToFollowUp = useMemo(() =>
    contacts.filter(c => c.partnershipType === PartnershipType.PARTNER && c.partnerDetails?.continueFollowUp),
    [contacts]
  );

  const renderView = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-outreach mx-auto mb-4" />
            <p className="text-text-muted text-sm">Loading PathPal CRM…</p>
          </div>
        </div>
      );
    }
    switch (view) {
      case 'dashboard':
        return (
          <CommandCenter
            contacts={contacts}
            tasks={tasks}
            settings={settings}
            googleAuthState={googleAuthState}
            unrepliedEmails={unrepliedEmails}
            isSyncingGmail={isSyncingGmail}
            onContactClick={setSelectedContact}
            onComposeEmail={handleComposeEmail}
            onViewChange={(v) => setView(v as View)}
            onSyncGmail={handleGlobalGmailSync}
            onBulkSyncGmail={handleBulkGmailSync}
            isBulkSyncing={isBulkSyncing}
            onTaskUpdate={handleTaskUpdate}
            sequences={sequences}
            enrollments={allEnrollments}
            onCompleteStep={handleCompleteStep}
          />
        );
      case 'outreach':
        return (
          <OutreachTrack
            contacts={contacts}
            onContactClick={setSelectedContact}
            onComposeEmail={handleComposeEmail}
            onBatchOutreach={handleBatchOutreach}
            contactEnrollments={allEnrollments}
            sequences={sequences}
          />
        );
      case 'partners':
        return (
          <PeopleWithProductTrack
            contacts={contacts}
            onContactClick={setSelectedContact}
            onComposeEmail={handleComposeEmail}
            contactEnrollments={allEnrollments}
            sequences={sequences}
          />
        );
      case 'other':
        return (
          <OtherTrack
            contacts={contacts}
            onContactClick={setSelectedContact}
            onComposeEmail={handleComposeEmail}
            contactEnrollments={allEnrollments}
            sequences={sequences}
          />
        );
      case 'sold': // legacy — redirect to partners
        return (
          <PeopleWithProductTrack
            contacts={contacts}
            onContactClick={setSelectedContact}
            onComposeEmail={handleComposeEmail}
            contactEnrollments={allEnrollments}
            sequences={sequences}
          />
        );
      case 'kanban':
        return <KanbanBoard contacts={contacts} pipelineStages={settings.pipelineStages} onDragEnd={handleDragEnd} onSelectContact={setSelectedContact} kanbanViews={settings.kanbanViews || []} />;
      case 'table':
        return <TableView contacts={contacts} onSelectContact={setSelectedContact} activeFilter={tableFilter} onClearFilter={() => setTableFilter(null)} onBulkUpdate={handleBulkUpdate} pipelineStages={settings.pipelineStages} />;
      case 'analytics':
        return <Analytics contacts={contacts} pipelineStages={settings.pipelineStages} templates={templates} />;
      case 'tasks':
        return <TasksView tasks={tasks} contacts={contacts} onUpdateTask={handleTaskUpdate} onAddTask={handleTaskAdd} onDeleteTask={handleTaskDelete} onSelectContact={setSelectedContact} />;
      case 'settings':
        return (
          <Settings
            settings={settings}
            onSettingsChange={handleSettingsUpdate}
            googleAuthState={googleAuthState}
            onGoogleSignIn={signIn}
            onGoogleSignOut={signOut}
            projects={projects}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
          />
        );
      case 'products':
        return (
          <ProductLibrary
            products={products}
            contacts={contacts}
            contactProducts={allContactProducts}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
          />
        );
      case 'templates':
        return (
          <EmailTemplateLibrary
            templates={templates}
            onCreateTemplate={handleCreateTemplate}
            onUpdateTemplate={handleUpdateTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        );
      case 'sequences':
        return (
          <SequenceBuilder
            sequences={sequences}
            templates={templates}
            pipelineStages={settings.pipelineStages}
            enrollments={allEnrollments}
            onCreate={handleCreateSequence}
            onUpdate={handleUpdateSequence}
            onDelete={handleDeleteSequence}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-base-900 font-inter">
      {/* Fixed sidebar */}
      <Sidebar
        currentView={view}
        onViewChange={(v) => setView(v as View)}
        contacts={contacts}
        onNewContact={() => setNewContactModalOpen(true)}
        onImport={() => setImportModalOpen(true)}
        onExport={handleExport}
        onSelectContact={setSelectedContact}
        unrepliedCount={unrepliedEmails.length}
      />

      {/* Main content area offset by sidebar width */}
      <main className="main-content bg-base-800 min-h-screen">
        {renderView()}
      </main>

      {/* Contact detail modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdate={handleContactUpdate}
          onAddInteraction={handleAddInteraction}
          onSyncGmail={handleSyncGmail}
          isGmailConnected={googleAuthState.isAuthenticated}
          settings={settings}
          tasks={tasks.filter(t => t.contactId === selectedContact.id)}
          onTaskAdd={handleTaskAdd}
          onTaskUpdate={handleTaskUpdate}
          onTaskDelete={handleTaskDelete}
          onDelete={handleDeleteContact}
          onComposeEmail={handleComposeEmail}
          aliases={gmailAliases}
          products={products}
          contactProducts={allContactProducts.filter(cp => cp.contactId === selectedContact.id)}
          onLinkProduct={handleLinkProduct}
          onUnlinkProduct={handleUnlinkProduct}
          onUpdateContactProduct={handleUpdateContactProduct}
          sequences={sequences}
          contactEnrollments={allEnrollments.filter(e => e.contactId === selectedContact.id)}
          onEnrollContact={(seqId) => handleEnrollContact(selectedContact.id, seqId)}
          onCompleteStep={handleCompleteStep}
          onUnenrollContact={handleUnenrollContact}
          projects={projects}
          contactProjects={allContactProjects.filter(cp => cp.contactId === selectedContact.id)}
          onLinkProject={(projectId) => handleLinkProject(selectedContact.id, projectId)}
          onUnlinkProject={handleUnlinkProject}
        />
      )}

      {/* Email compose modal */}
      {isEmailComposeOpen && (
        <EmailCompose
          isOpen={isEmailComposeOpen}
          onClose={() => setEmailComposeOpen(false)}
          initialDraft={emailComposeDraft}
          contact={emailComposeContact}
          aliases={gmailAliases}
          settings={settings}
          onSent={handleEmailSent}
          isGmailConnected={googleAuthState.isAuthenticated}
          templates={templates}
          supabaseUserId={session.user.id}
        />
      )}

      {/* Import modal */}
      {isImportModalOpen && (
        <ImportModal
          onClose={() => setImportModalOpen(false)}
          existingContacts={contacts}
          onImport={handleImport}
        />
      )}

      {/* New contact modal */}
      {isNewContactModalOpen && (
        <NewContactModal
          onClose={() => setNewContactModalOpen(false)}
          onCreateContact={(data) => { handleCreateContact(data); setNewContactModalOpen(false); }}
          pipelineStages={settings.pipelineStages}
        />
      )}

      {/* Batch outreach modal */}
      {isBatchOutreachOpen && batchOutreachContacts.length > 0 && (
        <BatchOutreachModal
          contacts={batchOutreachContacts}
          products={products}
          aliases={gmailAliases}
          defaultAlias={gmailAliases.find(a => a.isDefault || a.sendAsEmail.includes('pathpalgolf'))?.sendAsEmail || gmailAliases[0]?.sendAsEmail || ''}
          defaultModel={settings.geminiModel || settings.defaultAiModel || 'gemini-3-flash-preview'}
          productContext={settings.productContext}
          emailTrackingEnabled={settings.emailTrackingEnabled}
          supabaseProjectRef={settings.supabaseProjectRef}
          supabaseUserId={session.user.id}
          onSend={handleBatchSent}
          onClose={() => { setIsBatchOutreachOpen(false); setBatchOutreachContacts([]); }}
        />
      )}

      {/* Bulk sync progress overlay */}
      {isBulkSyncing && bulkSyncProgress && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl p-8 text-center max-w-sm w-full mx-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-outreach mx-auto mb-4" />
            <h3 className="text-lg font-bold text-text-primary mb-1">Bulk Gmail Sync</h3>
            <p className="text-sm text-text-muted mb-4">
              Scanning the last 180 days for {contacts.length} contacts…
            </p>
            <div className="w-full bg-base-700 rounded-full h-2 overflow-hidden mb-2">
              <div
                className="h-full rounded-full bg-outreach transition-all duration-300"
                style={{ width: `${Math.round((bulkSyncProgress.processed / bulkSyncProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs font-mono text-text-muted">
              {bulkSyncProgress.processed} / {bulkSyncProgress.total} contacts
            </p>
          </div>
        </div>
      )}

      {/* Pending contacts modal */}
      {isPendingModalOpen && (
        <PendingContactsModal
          pendingContacts={pendingContacts}
          contacts={contacts}
          onAddAsNew={(pending) => {
            // Pre-fill a new contact with data from the pending email
            // For now, open new contact modal — TODO: pre-fill fields
            setNewContactModalOpen(true);
          }}
          onAssignToExisting={(pending, contactId) => {
            const contact = contacts.find(c => c.id === contactId);
            if (contact) {
              const newEmails = [...(contact.additionalEmails || [])];
              if (!newEmails.includes(pending.fromEmail)) {
                newEmails.push(pending.fromEmail);
                db.updateContact({ ...contact, additionalEmails: newEmails }).then(updated => {
                  setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
                });
              }
            }
          }}
          onIgnore={(email) => {
            setPendingContacts(prev => prev.filter(p => p.fromEmail !== email));
          }}
          onIgnoreAll={() => {
            setPendingContacts([]);
            setIsPendingModalOpen(false);
          }}
          onClose={() => setIsPendingModalOpen(false)}
        />
      )}
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
  }, []);

  if (!session) return <Auth />;
  return <CrmApp session={session} />;
};

export default App;
