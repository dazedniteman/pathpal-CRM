
import { Contact, InteractionType, PartnershipType } from './types';

export const DEFAULT_PIPELINE_STAGES = [
  'To Reach Out',
  'Contacted',
  'Responded',
  'Meeting Booked',
  'On Hold',
  'Sent Product; Awaiting Feedback',
  'Closed - Success',
  'Closed - Unsuccessful',
];

export const MOCK_CONTACTS: Contact[] = [
  {
    id: '1',
    name: 'Alex Johnson',
    email: 'alex.j@example.com',
    phone: '555-123-4567',
    instagramHandle: '@alexgolfpro',
    followers: 15000,
    following: 300,
    location: 'San Diego, CA',
    pipelineStage: 'To Reach Out',
    status: 'New',
    lastContacted: new Date('2024-06-10T10:00:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/alex/100/100',
    interactions: [],
    biography: 'Specializes in short game improvement. PGA certified.',
    notes: 'Seems like a great fit for our product.',
    website: 'alexgolf.com',
    posts: 350,
    tags: ['Top Rated Teacher', 'PGA Pro'],
  },
  {
    id: '2',
    name: 'Samantha Carter',
    email: 'sam.carter@golf.io',
    instagramHandle: '@samanthaswings',
    followers: 45000,
    following: 550,
    location: 'Miami, FL',
    pipelineStage: 'Contacted',
    status: 'Contacted',
    lastContacted: new Date('2024-07-20T14:30:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/samantha/100/100',
    interactions: [
      {
        id: 'int-1',
        type: InteractionType.EMAIL,
        date: new Date('2024-07-20T14:30:00Z').toISOString(),
        notes: 'Sent initial outreach email about collaboration.',
        outcome: 'Opened'
      }
    ],
    biography: 'LPGA tour player and coach. Known for powerful drives.',
    notes: 'Very active on Instagram, high engagement. Potential brand ambassador.',
    tags: ['LPGA', 'Influencer'],
  },
  {
    id: '3',
    name: 'Ben Reynolds',
    email: 'ben.r@swingdynamics.com',
    location: 'Austin, TX',
    pipelineStage: 'Responded',
    status: 'Nurturing',
    lastContacted: new Date('2024-07-22T09:00:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/ben/100/100',
    interactions: [
      {
        id: 'int-3',
        type: InteractionType.EMAIL,
        date: new Date('2024-07-22T09:00:00Z').toISOString(),
        notes: 'Responded positively, asked for more details about the pricing.',
        outcome: 'Replied'
      },
      {
        id: 'int-2',
        type: InteractionType.EMAIL,
        date: new Date('2024-07-21T11:00:00Z').toISOString(),
        notes: 'Sent initial outreach email.',
        outcome: 'Opened'
      }
    ],
    biography: 'Golf technology enthusiast and instructor. Runs a popular blog on swing analysis.',
    notes: 'Seems very interested in the technical aspects.'
  },
   {
    id: '4',
    name: 'Chloe Decker',
    email: 'chloe.d@links.com',
    instagramHandle: '@chloegolf',
    followers: 22000,
    following: 800,
    location: 'Phoenix, AZ',
    pipelineStage: 'Meeting Booked',
    status: 'Nurturing',
    lastContacted: new Date('2024-07-25T16:00:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/chloe/100/100',
    interactions: [
       {
        id: 'int-5',
        type: InteractionType.MEETING,
        date: new Date('2024-07-25T16:00:00Z').toISOString(),
        notes: 'Scheduled a Zoom call for next Tuesday to demo the product.',
      },
      {
        id: 'int-4',
        type: InteractionType.EMAIL,
        date: new Date('2024-07-23T12:00:00Z').toISOString(),
        notes: 'Followed up on her questions, she agreed to a meeting.',
        outcome: 'Replied'
      }
    ],
    notes: 'Meeting scheduled. Prepare demo environment.'
  },
   {
    id: '5',
    name: 'Marcus Holloway',
    email: 'marcus.h@ fairway.io',
    location: 'Chicago, IL',
    pipelineStage: 'Closed - Success',
    partnershipType: PartnershipType.SALE,
    status: 'Nurturing',
    lastContacted: new Date('2024-07-15T11:00:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/marcus/100/100',
    interactions: [],
    notes: 'Signed up for the pro plan. Onboarding complete.'
  },
  {
    id: '6',
    name: 'Daniel Espinoza',
    email: 'dan.e@golfers.net',
    instagramHandle: '@detectivedan',
    followers: 5000,
    following: 1200,
    location: 'Los Angeles, CA',
    pipelineStage: 'Contacted',
    status: 'Unresponsive',
    lastContacted: new Date('2024-05-15T11:00:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/daniel/100/100',
    interactions: [
      {
        id: 'int-6',
        type: InteractionType.EMAIL,
        date: new Date('2024-05-15T11:00:00Z').toISOString(),
        notes: 'Sent initial outreach, no response.',
        outcome: 'Opened'
      }
    ],
    notes: 'Needs follow-up. Seems to have gone cold.'
  },
  {
    id: '7',
    name: 'Ella Lopez',
    email: 'ella.l@lab.co',
    instagramHandle: '@ forensicella',
    followers: 88000,
    following: 150,
    location: 'Portland, OR',
    pipelineStage: 'Closed - Success',
    partnershipType: PartnershipType.PARTNER,
    status: 'Nurturing',
    lastContacted: new Date('2024-07-28T10:00:00Z').toISOString(),
    avatarUrl: 'https://picsum.photos/seed/ella/100/100',
    interactions: [],
    notes: 'Agreed to partnership. Contract sent.',
    partnerDetails: {
      contractSigned: true,
      continueFollowUp: true,
      drillVideosAgreed: 5,
      drillVideosDelivered: 2,
      drillVideoLinks: ['https://video.link/1', 'https://video.link/2'],
      testimonialVideoAgreed: true,
      testimonialVideoDelivered: false,
      testimonialVideoLink: '',
      websiteLinkAgreed: true,
      websiteLinkDelivered: true,
      websiteLinkUrl: 'https://ellasite.com/our-partners',
      socialPostAgreed: true,
      socialPostDelivered: false,
      socialPostLink: ''
    },
    tags: ['Influencer', 'Top Rated Teacher'],
  },
];
