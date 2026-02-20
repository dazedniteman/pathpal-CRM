
import { GoogleAuthState, GmailAlias, GmailIgnoreEntry, EmailDraft, Interaction, InteractionType, Contact } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let CLIENT_ID: string | undefined;
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

let tokenClient: any = null;
let onAuthChangeCallback: ((authState: GoogleAuthState) => void) | null = null;
let gapiInitialized = false;
let currentAccessToken: string | null = null;

export const initGmailService = (clientId: string | undefined, onAuthChange: (authState: GoogleAuthState) => void) => {
  if (clientId === CLIENT_ID) return;
  CLIENT_ID = clientId;
  onAuthChangeCallback = onAuthChange;
  if (!CLIENT_ID) { console.log("Google Client ID is not set. Gmail integration is disabled."); return; }
  if (window.gapi && window.gapi.client) { initializeGapiClient(); }
  else {
    const existingScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => window.gapi.load('client', initializeGapiClient);
      document.body.appendChild(script);
    }
  }
};

async function initializeGapiClient() {
  if (gapiInitialized) { initializeGisClient(); return; }
  try {
    await window.gapi.client.init({ discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"] });
    gapiInitialized = true;
    initializeGisClient();
  } catch (error) { console.error("Error initializing GAPI client:", error); }
}

function initializeGisClient() {
  const checkGisReady = () => {
    if (window.google && window.google.accounts) {
      if (!CLIENT_ID) { console.warn("Cannot initialize Google Sign-In: Client ID is missing."); return; }
      try {
        tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) { console.error("Token response error:", tokenResponse); onAuthChangeCallback?.({ isAuthenticated: false }); return; }
            window.gapi.client.setToken(tokenResponse);
            currentAccessToken = tokenResponse.access_token;
            try {
              const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` } });
              const profile = await userInfoResponse.json();
              if (userInfoResponse.ok) { onAuthChangeCallback?.({ isAuthenticated: true, profile }); }
              else { console.error("Error fetching user profile:", profile); signOut(); }
            } catch (error) { console.error("Error fetching user profile", error); onAuthChangeCallback?.({ isAuthenticated: false }); }
          },
        });
      } catch (error) { console.error("Error initializing Google Identity Services. Is your Client ID correct?", error); }
    } else { setTimeout(checkGisReady, 100); }
  };
  checkGisReady();
}

export const signIn = () => {
  if (!CLIENT_ID) { alert("Please configure your Google Client ID in the Settings page before connecting."); return; }
  if (!gapiInitialized) { alert("Google API client is not ready. Please try again in a moment."); return; }
  if (tokenClient) { tokenClient.requestAccessToken({ prompt: 'select_account' }); }
  else { console.error("Token client is not initialized."); alert("Gmail integration is not ready yet. Please wait a moment and try again."); }
};

export const signOut = () => {
  const token = window.gapi?.client?.getToken();
  if (token !== null) {
    window.google?.accounts?.oauth2?.revoke(token.access_token, () => { console.log('Access token revoked.'); });
    window.gapi?.client?.setToken(null);
  }
  currentAccessToken = null;
  onAuthChangeCallback?.({ isAuthenticated: false });
  localStorage.removeItem('crm_gmail_auth');
};

function getAuthToken(): string | null {
  const token = window.gapi?.client?.getToken();
  return token?.access_token || currentAccessToken;
}

// --- Decode base64url encoded Gmail message body ---
function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    return decodeURIComponent(
      atob(padded)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }
}

// --- Extract text body from Gmail message payload ---
function extractEmailBody(payload: any): string {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart - prefer text/plain, fall back to text/html
  if (payload.parts) {
    let plainText = '';
    let htmlText = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        plainText = decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlText = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        // Nested multipart
        const nested = extractEmailBody(part);
        if (nested) plainText = nested;
      }
    }
    return plainText || htmlText;
  }

  return '';
}

// --- Original fetchEmailsForContact (kept for backward compat) ---
export const fetchEmailsForContact = async (contactEmail: string): Promise<{ id: string, snippet: string, internalDate: string, subject: string, from: string }[]> => {
  if (!window.gapi?.client?.getToken()) { console.warn("Attempted to fetch emails without being authenticated."); return []; }
  try {
    const response = await window.gapi.client.gmail.users.messages.list({ 'userId': 'me', 'q': `from:${contactEmail} OR to:${contactEmail}`, 'maxResults': 20 });
    const messages = response.result.messages || [];
    if (messages.length === 0) return [];

    const batch = window.gapi.client.newBatch();
    messages.forEach((message: any) => {
      batch.add(window.gapi.client.gmail.users.messages.get({ 'userId': 'me', 'id': message.id, 'format': 'metadata', 'metadataHeaders': ['Subject', 'From'] }));
    });

    const batchResponse = await batch;
    const emailDetails = Object.values(batchResponse.result).map((res: any) => {
      const subjectHeader = res.result.payload.headers.find((h: any) => h.name.toLowerCase() === 'subject');
      const fromHeader = res.result.payload.headers.find((h: any) => h.name.toLowerCase() === 'from');
      return {
        id: res.result.id,
        snippet: res.result.snippet.replace(/&#39;/g, "'"),
        internalDate: res.result.internalDate,
        subject: subjectHeader ? subjectHeader.value : 'No Subject',
        from: fromHeader ? fromHeader.value : ''
      };
    });
    return emailDetails;
  } catch (error: any) {
    console.error('Error fetching emails: ', error);
    if (error.status === 401 || error.code === 401) signOut();
    return [];
  }
};

// --- NEW: Fetch emails with full body content ---
export const fetchEmailsForContactWithBodies = async (contactEmail: string): Promise<Interaction[]> => {
  const token = getAuthToken();
  if (!token) { console.warn("Not authenticated"); return []; }
  try {
    const listRes = await window.gapi.client.gmail.users.messages.list({
      userId: 'me',
      q: `from:${contactEmail} OR to:${contactEmail}`,
      maxResults: 30,
    });
    const messages = listRes.result.messages || [];
    if (messages.length === 0) return [];

    const interactions: Interaction[] = [];
    // Fetch messages in parallel (up to 10 at a time)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 5) {
      chunks.push(messages.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map((msg: any) =>
          window.gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
          })
        )
      );

      for (const res of results) {
        const msg = res.result;
        const headers = msg.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
        const to = headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '';
        const body = extractEmailBody(msg.payload);
        const isFromContact = from.toLowerCase().includes(contactEmail.toLowerCase());

        interactions.push({
          id: `gmail-${msg.id}`,
          type: InteractionType.EMAIL,
          date: new Date(parseInt(msg.internalDate)).toISOString(),
          notes: `Subject: ${subject}\n\n${msg.snippet || ''}`,
          outcome: 'Synced from Gmail',
          gmailMessageId: msg.id,
          gmailThreadId: msg.threadId,
          emailSubject: subject,
          emailFrom: from,
          emailTo: to,
          emailBody: body,
          isSentByUser: !isFromContact,
        });
      }
    }

    return interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error: any) {
    console.error('Error fetching emails with bodies:', error);
    if (error.status === 401 || error.code === 401) signOut();
    return [];
  }
};

// --- NEW: Fetch Gmail aliases (send-as addresses) ---
export const fetchEmailAliases = async (): Promise<GmailAlias[]> => {
  const token = getAuthToken();
  if (!token) return [];
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sendAs || []).map((alias: any) => ({
      sendAsEmail: alias.sendAsEmail,
      displayName: alias.displayName || alias.sendAsEmail,
      isDefault: !!alias.isDefault,
      isPrimary: !!alias.isPrimary,
    }));
  } catch (error) {
    console.error('Error fetching aliases:', error);
    return [];
  }
};

// --- NEW: Fetch full email thread with bodies ---
export const fetchFullEmailThread = async (threadId: string): Promise<{ id: string, messages: any[] }> => {
  const token = getAuthToken();
  if (!token) return { id: threadId, messages: [] };
  try {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { id: threadId, messages: [] };
    const data = await res.json();
    const messages = (data.messages || []).map((msg: any) => {
      const headers = msg.payload?.headers || [];
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '',
        from: headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '',
        to: headers.find((h: any) => h.name.toLowerCase() === 'to')?.value || '',
        date: new Date(parseInt(msg.internalDate)).toISOString(),
        body: extractEmailBody(msg.payload),
        snippet: msg.snippet || '',
      };
    });
    return { id: threadId, messages };
  } catch (error) {
    console.error('Error fetching thread:', error);
    return { id: threadId, messages: [] };
  }
};

// --- Tracking token helpers ---

/**
 * Generates a base64-encoded tracking token: userId:interactionId:contactId
 * Safe to include in URLs (uses standard base64, caller should URI-encode if needed).
 */
export const generateTrackingToken = (userId: string, interactionId: string, contactId: string): string => {
  return btoa(`${userId}:${interactionId}:${contactId}`);
};

/**
 * Builds the tracking pixel URL for a given Supabase project ref and token.
 */
export const buildTrackingPixelUrl = (supabaseProjectRef: string, token: string): string => {
  return `https://${supabaseProjectRef}.supabase.co/functions/v1/track-open?token=${encodeURIComponent(token)}`;
};

/**
 * Converts plain text email body to minimal HTML, preserving line breaks.
 * Appends a 1×1 tracking pixel if a pixelUrl is provided.
 */
function buildHtmlBody(plainBody: string, pixelUrl?: string): string {
  const escaped = plainBody
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const pixel = pixelUrl
    ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;outline:none;" alt="" />`
    : '';

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;font-size:14px;line-height:1.6;">${escaped}${pixel}</body></html>`;
}

export interface SendEmailOptions {
  /** When provided, a tracking pixel is injected into the email HTML. */
  trackingPixelUrl?: string;
}

// --- NEW: Send an email (with alias support + optional open tracking) ---
export const sendEmail = async (
  draft: EmailDraft,
  options: SendEmailOptions = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const token = getAuthToken();
  if (!token) return { success: false, error: 'Not authenticated with Gmail' };

  try {
    const from = draft.alias ? `PathPal Golf <${draft.alias}>` : draft.alias;
    const inReplyTo = draft.replyToMessageId ? `\r\nIn-Reply-To: <${draft.replyToMessageId}>` : '';
    const useHtml = !!options.trackingPixelUrl;

    let contentType: string;
    let emailBodyContent: string;

    if (useHtml) {
      contentType = 'text/html; charset=UTF-8';
      emailBodyContent = buildHtmlBody(draft.body, options.trackingPixelUrl);
    } else {
      contentType = 'text/plain; charset=UTF-8';
      emailBodyContent = draft.body;
    }

    const rawEmail = [
      `From: ${from}`,
      `To: ${draft.to}`,
      `Subject: ${draft.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: ${contentType}`,
      inReplyTo,
      '',
      emailBodyContent,
    ].join('\r\n');

    // Base64url encode
    const encodedEmail = btoa(unescape(encodeURIComponent(rawEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const body: any = { raw: encodedEmail };
    if (draft.threadId) {
      body.threadId = draft.threadId;
    }

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Send email error:', err);
      return { success: false, error: err.error?.message || 'Failed to send email' };
    }

    const data = await res.json();
    return { success: true, messageId: data.id };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message || 'Unknown error sending email' };
  }
};

// --- NEW: Check which contacts have unreplied emails (for morning briefing) ---
export interface UnrepliedEmail {
  contact: Contact;
  subject: string;
  snippet: string;
  from: string;
  date: string;
  threadId?: string;
  messageId?: string;
}

export const getContactsNeedingEmailReply = (
  contacts: Contact[],
  ignoreList: GmailIgnoreEntry[] = [],
  newsletterAutoFilter: boolean = true
): UnrepliedEmail[] => {
  const results: UnrepliedEmail[] = [];

  // Newsletter/automated email indicators
  const automatedSignals = newsletterAutoFilter
    ? ['unsubscribe', 'noreply', 'no-reply', 'donotreply', 'newsletter', 'mailchimp', 'sendgrid', 'notifications@', 'updates@', 'alerts@', 'support@', 'info@']
    : [];

  for (const contact of contacts) {
    // Skip contacts not in active tracks
    if (contact.pipelineStage === 'Closed - Unsuccessful') continue;

    const emailInteractions = contact.interactions
      .filter(i => i.type === InteractionType.EMAIL)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (emailInteractions.length === 0) continue;

    const mostRecent = emailInteractions[0];

    // If most recent email was sent BY user, no reply needed
    if (mostRecent.isSentByUser) continue;

    // If no isSentByUser flag but from field contains contact email - treat as received
    const isFromContact = mostRecent.emailFrom?.toLowerCase().includes(contact.email.toLowerCase());
    if (!mostRecent.emailFrom && !isFromContact) continue;
    if (mostRecent.isSentByUser === undefined && !isFromContact) continue;

    // Check ignore list
    const fromEmail = mostRecent.emailFrom || contact.email;
    const isIgnored = ignoreList.some(entry => {
      if (entry.type === 'email') return fromEmail.toLowerCase().includes(entry.value.toLowerCase());
      if (entry.type === 'domain') return fromEmail.toLowerCase().includes('@' + entry.value.toLowerCase());
      return false;
    });
    if (isIgnored) continue;

    // Check automated signals
    if (automatedSignals.some(signal => fromEmail.toLowerCase().includes(signal) || (mostRecent.notes || '').toLowerCase().includes(signal))) continue;

    results.push({
      contact,
      subject: mostRecent.emailSubject || mostRecent.notes?.split('\n')[0]?.replace('Subject: ', '') || 'Email',
      snippet: mostRecent.notes?.split('\n\n')[1]?.substring(0, 150) || mostRecent.notes?.substring(0, 150) || '',
      from: mostRecent.emailFrom || contact.email,
      date: mostRecent.date,
      threadId: mostRecent.gmailThreadId,
      messageId: mostRecent.gmailMessageId,
    });
  }

  // Sort by date, most recent first
  return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
};

export const getGoogleAuthState = (): boolean => {
  const token = window.gapi?.client?.getToken();
  return !!(token && token.access_token);
};
