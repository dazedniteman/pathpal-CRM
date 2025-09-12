
import { GoogleAuthState } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

let CLIENT_ID: string | undefined;
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let tokenClient: any = null;
let onAuthChangeCallback: ((authState: GoogleAuthState) => void) | null = null;
let gapiInitialized = false;

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
          client_id: CLIENT_ID, scope: SCOPES,
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) { console.error("Token response error:", tokenResponse); onAuthChangeCallback?.({ isAuthenticated: false }); return; }
            window.gapi.client.setToken(tokenResponse);
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
  else { console.error("Token client is not initialized. Check your Google Client ID configuration in Settings."); alert("Gmail integration is not ready yet. Please wait a moment and try again."); }
};

export const signOut = () => {
  const token = window.gapi.client.getToken();
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token, () => { console.log('Access token revoked.'); });
    window.gapi.client.setToken(null);
  }
  onAuthChangeCallback?.({ isAuthenticated: false });
  localStorage.removeItem('crm_gmail_auth');
};

export const fetchEmailsForContact = async (contactEmail: string): Promise<{ id: string, snippet: string, internalDate: string, subject: string, from: string }[]> => {
  if (!window.gapi.client.getToken()) { console.warn("Attempted to fetch emails without being authenticated."); return []; }
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
