
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
  drillVideoLinks: string[];
  testimonialVideoAgreed: boolean;
  testimonialVideoDelivered: boolean;
  testimonialVideoLink: string;
  websiteLinkAgreed: boolean;
  websiteLinkDelivered: boolean;
  websiteLinkUrl: string;
  socialPostAgreed: boolean;
  socialPostDelivered: boolean;
  socialPostLink: string;
}

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
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  contactId?: string;
}

export type View = 'dashboard' | 'kanban' | 'analytics' | 'table' | 'settings' | 'tasks';

export type TableFilterType = 
  | 'outstanding_drills' 
  | 'outstanding_testimonials' 
  | 'outstanding_links' 
  | 'outstanding_posts';

export interface TableFilter {
  type: TableFilterType;
  label: string;
}

export interface AppSettings {
  productContext: string;
  defaultFollowUpDays: number;
  googleClientId?: string;
  pipelineStages: string[];
}

export interface GoogleAuthState {
  isAuthenticated: boolean;
  profile?: {
    name: string;
    email: string;
    picture: string;
  };
}
