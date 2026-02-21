
export enum InteractionType {
  EMAIL = 'Email',
  CALL = 'Call',
  MEETING = 'Meeting',
  NOTE = 'Note'
}

export interface Interaction {
  id: string;
  type: InteractionType;
  date: string;
  notes: string;
  outcome?: string;
  // Gmail fields
  gmailThreadId?: string;
  gmailMessageId?: string;
  emailBody?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailTo?: string;
  emailOpened?: boolean;
  emailOpenedAt?: string;
  isSentByUser?: boolean;
  aliasUsed?: string;
  templateId?: string; // which template was used (for A/B tracking)
}

export enum PartnershipType {
  SALE = 'Sale',
  PARTNER = 'Partner',
}

export interface PartnerDetails {
  contractSigned: boolean;
  continueFollowUp: boolean;
  drillVideosAgreed: number;
  drillVideosDelivered: number;
  drillVideoLinks: DrillVideoLink[];
  drillVideosDueDate?: string;       // ISO date
  testimonialVideoAgreed: boolean;
  testimonialVideoDelivered: boolean;
  testimonialVideoLink: string;
  testimonialDueDate?: string;       // ISO date
  websiteLinkAgreed: boolean;
  websiteLinkDelivered: boolean;
  websiteLinkUrl: string;
  websiteLinkDueDate?: string;       // ISO date
  socialPostAgreed: boolean;
  socialPostDelivered: boolean;
  socialPostLink: string;
  socialPostDueDate?: string;        // ISO date
}

export type ContactType = 'instructor' | 'media' | 'customer' | 'other';

export interface DrillVideoLink {
  url: string;
  title?: string;
  deliveredAt?: string;
}
export type Track = 'outreach' | 'partner' | 'sold';
export type OutreachBucket = 'to_contact' | 'awaiting_response' | 'in_conversation' | 'meeting_booked' | 'on_hold' | 'closed';
export type HealthLevel = 'warm' | 'cooling' | 'cold';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  instagramHandle?: string;
  followers?: number;
  location?: string;
  pipelineStage: string;
  status: 'New' | 'Contacted' | 'Follow-up' | 'Nurturing' | 'Unresponsive';
  lastContacted: string;
  interactions: Interaction[];
  notes?: string;
  richNotes?: string;
  contactType?: ContactType;
  healthScore?: number;
  additionalEmails?: string[];
  stopFollowUp?: boolean;
  avatarUrl: string;
  website?: string;
  posts?: number;
  following?: number;
  avgLikes?: number;
  avgComments?: number;
  biography?: string;
  nextFollowUpDate?: string;
  partnershipType?: PartnershipType;
  partnerDetails?: PartnerDetails;
  tags?: string[];
  fanScore?: number;  // 1-5: how enthusiastic this partner/customer is about the product
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  contactId?: string;
}

export type View = 'dashboard' | 'kanban' | 'analytics' | 'table' | 'settings' | 'tasks' | 'outreach' | 'partners' | 'sold' | 'products' | 'templates' | 'sequences' | 'other';

export type TableFilterType =
  | 'outstanding_drills'
  | 'outstanding_testimonials'
  | 'outstanding_links'
  | 'outstanding_posts';

export interface TableFilter {
  type: TableFilterType;
  label: string;
}

export interface KanbanView {
  id: string;
  name: string;
  stages: string[];
}

export interface GmailIgnoreEntry {
  value: string;
  type: 'email' | 'domain';
  addedAt: string;
}

export interface GmailAlias {
  sendAsEmail: string;
  displayName: string;
  isDefault: boolean;
  isPrimary: boolean;
}

export interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  alias: string;
  contactId?: string;
  threadId?: string;
  replyToMessageId?: string;
  templateId?: string; // For A/B tracking
}

export interface AppSettings {
  productContext: string;
  defaultFollowUpDays: number;
  googleClientId?: string;
  pipelineStages: string[];
  kanbanViews?: KanbanView[];
  defaultAiModel?: string;
  geminiModel?: string;
  geminiApiKey?: string;
  gmailIgnoreList?: GmailIgnoreEntry[];
  newsletterAutoFilter?: boolean;
  emailTrackingEnabled?: boolean;
  supabaseProjectRef?: string;
  lastGmailSyncAt?: string;    // ISO timestamp of last Sync Gmail run
  lastBulkSyncAt?: string;     // ISO timestamp of last Bulk Sync run
}

// --- Phase 2: Product Library ---

export interface Product {
  id: string;
  name: string;
  description: string;
  aiContext: string; // injected into Gemini prompts for contacts linked to this product
  photoUrl?: string;
  isActive: boolean;
}

export interface ContactProduct {
  id: string;
  contactId: string;
  productId: string;
  receivedFree: boolean;
  quantityPurchased?: number;
  receivedAt?: string;
  notes?: string;
}

// --- Phase 2: Email Templates ---

export type TemplateType = 'outreach' | 'follow_up' | 'check_in' | 'custom';

export interface EmailTemplate {
  id: string;
  name: string;
  templateType: TemplateType;
  subject: string;
  body: string; // supports {name}, {location}, {instagram}, {followers}, {product}
  variantGroup?: string; // same string = same A/B test group
  sendCount?: number;
  openCount?: number;
}

// Resolve template variables with contact data
export function resolveTemplateVariables(
  template: string,
  contact?: { name?: string; location?: string; instagramHandle?: string; followers?: number },
  productName?: string
): string {
  return template
    .replace(/\{name\}/gi, contact?.name || 'there')
    .replace(/\{location\}/gi, contact?.location || 'your area')
    .replace(/\{instagram\}/gi, contact?.instagramHandle?.replace('@', '') || '')
    .replace(/\{followers\}/gi, contact?.followers?.toLocaleString() || '')
    .replace(/\{product\}/gi, productName || 'PathPal');
}

export interface GoogleAuthState {
  isAuthenticated: boolean;
  profile?: {
    name: string;
    email: string;
    picture: string;
  };
}

// --- Phase 3: Follow-up Sequences ---

export type SequenceStepActionType = 'email_draft' | 'task' | 'note';

export interface SequenceStep {
  id: string;              // "step-{Date.now()}-{random4}"
  dayOffset: number;       // days after enrolledAt this step fires
  actionType: SequenceStepActionType;
  description: string;     // human-readable label shown in UI
  templateId?: string;     // if email_draft: optional template to pre-fill
  taskTitle?: string;      // if task: required
  noteText?: string;       // if note
}

export interface Sequence {
  id: string;              // "seq-{Date.now()}"
  userId?: string;
  name: string;
  description: string;
  triggerStage?: string;   // pipeline stage that auto-enrolls; undefined = manual only
  isActive: boolean;
  steps: SequenceStep[];
  createdAt?: string;
}

export interface ContactSequence {
  id: string;              // "cs-{Date.now()}"
  userId?: string;
  contactId: string;
  sequenceId: string;
  enrolledAt: string;      // ISO string — reference point for all dayOffset calculations
  completedStepIds: string[];
  status: 'active' | 'completed' | 'unenrolled';
  createdAt?: string;
}

// --- Phase 4: Project Flags ---

export interface Project {
  id: string;
  userId?: string;
  name: string;
  goal: string;                       // injected into AI drafts as project context
  followUpFrequencyDays: number;      // days between follow-up attempts if no reply
  isActive: boolean;
  createdAt?: string;
}

export interface ContactProject {
  id: string;
  userId?: string;
  contactId: string;
  projectId: string;
  status: 'active' | 'completed' | 'paused';
  notes?: string;
  createdAt?: string;
}

// --- Utility functions ---

export function getTrack(contact: Contact): Track {
  if (contact.pipelineStage === 'Closed - Success') {
    return contact.partnershipType === PartnershipType.SALE ? 'sold' : 'partner';
  }
  return 'outreach';
}

export function getOutreachBucket(pipelineStage: string): OutreachBucket {
  switch (pipelineStage) {
    case 'To Reach Out': return 'to_contact';
    case 'Contacted': return 'awaiting_response';
    case 'Responded': return 'in_conversation';
    case 'Meeting Booked': return 'meeting_booked';
    case 'On Hold': return 'on_hold';
    case 'Closed - Unsuccessful': return 'closed';
    default: return 'to_contact';
  }
}

export function calculateHealthScore(contact: Contact): number {
  let score = 100;
  const now = new Date();
  // Use effectiveLastContacted so stale lastContacted field doesn't skew results
  const effectiveDateStr = effectiveLastContacted(contact);
  const lastContact = effectiveDateStr ? new Date(effectiveDateStr) : null;

  if (lastContact) {
    const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 90) score -= 60;
    else if (daysSince > 60) score -= 40;
    else if (daysSince > 30) score -= 20;
    else if (daysSince > 14) score -= 10;
  } else {
    score -= 50;
  }

  const interactions = contact.interactions || [];
  const recentInteractions = interactions.filter(i => {
    const d = new Date(i.date);
    return (now.getTime() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
  });
  if (recentInteractions.length === 0) score -= 20;

  return Math.max(0, Math.min(100, score));
}

export function getHealthLevel(score: number): HealthLevel {
  if (score >= 70) return 'warm';
  if (score >= 35) return 'cooling';
  return 'cold';
}

export function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 9999;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns the most-recent date among lastContacted and all interaction dates.
 * Use this instead of contact.lastContacted directly to avoid stale values when
 * lastContacted wasn't updated (e.g. a bulk sync that failed mid-way).
 */
export function effectiveLastContacted(contact: Contact): string | undefined {
  const candidates: string[] = [];
  if (contact.lastContacted) candidates.push(contact.lastContacted);
  for (const i of contact.interactions) {
    if (i.date) candidates.push(i.date);
  }
  if (candidates.length === 0) return undefined;
  return candidates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b));
}

export function daysSinceContact(contact: Contact): number {
  return daysSince(effectiveLastContacted(contact));
}

export function formatTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
