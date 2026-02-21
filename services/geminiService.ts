
import { GoogleGenAI } from "@google/genai";
import { Contact } from '../types';

const apiKey = process.env.API_KEY;

if (!apiKey) {
    console.error("Gemini API key is not set. Please check your `VITE_GEMINI_API_KEY` environment variable.");
}

const ai = new GoogleGenAI({ apiKey: apiKey! });

export const getFollowUpSuggestion = async (
  contact: Contact,
  productContext?: string,
  tags?: string[],
  model: string = 'gemini-3-flash-preview',
  projectContext?: string
): Promise<string> => {
  if (!apiKey) {
    return "Error: Gemini API key is not configured. Please ensure `VITE_GEMINI_API_KEY` is set in the deployment settings.";
  }

  const interactionHistory = contact.interactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10)
    .map(i => {
      const sentBy = i.isSentByUser ? 'You sent' : i.isSentByUser === false ? 'They sent' : '';
      const bodyPreview = i.emailBody ? `\n   Email content: "${i.emailBody.substring(0, 300)}..."` : '';
      return `- ${new Date(i.date).toLocaleDateString()}: [${i.type}]${sentBy ? ' ' + sentBy + ':' : ''} "${i.notes}"${bodyPreview} ${i.outcome ? `| Outcome: ${i.outcome}` : ''}`;
    }).join('\n');

  const prompt = `You are a helpful CRM assistant for PathPal Golf, a company that sells physical golf training aids (The PathPal and The TrueStrike).

Your task is to write a concise, friendly, and professional follow-up email on behalf of Steven, the founder.

${productContext ? `PRODUCT & COMPANY CONTEXT:\n${productContext}\n` : ''}
${projectContext ? `CURRENT PROJECT GOAL WITH THIS CONTACT:\n${projectContext}\n` : ''}

CONTACT INFORMATION:
- Name: ${contact.name}
- Email: ${contact.email}
- Type: ${contact.contactType || 'instructor'}
- Biography: ${contact.biography || 'No biography provided.'}
- Notes: ${contact.richNotes || contact.notes || 'No specific notes provided.'}
- Location: ${contact.location || 'Unknown'}
- Website: ${contact.website || 'N/A'}
- Instagram: ${contact.instagramHandle || 'N/A'} with ${(contact.followers || 0).toLocaleString()} followers.
- Current Stage: ${contact.pipelineStage}
- Partnership Type: ${contact.partnershipType || 'Not yet a partner'}
${tags && tags.length > 0 ? `- Tags: ${tags.join(', ')}` : ''}

RECENT COMMUNICATION HISTORY (newest first):
${interactionHistory || "No previous interactions logged."}

Last contact was ${new Date(contact.lastContacted).toLocaleDateString()}.

INSTRUCTIONS:
Write a short, personal follow-up email. Keep it under 150 words for the body.
- Do NOT use generic phrases like "I hope this email finds you well"
- Reference specific context from the communication history when possible
- Be direct and get to the point quickly
- Sign as "Steven" from PathPal Golf
- The goal: ${contact.pipelineStage === 'To Reach Out' ? 'Initial outreach, introduce myself and the product' : contact.pipelineStage === 'Contacted' ? 'Follow up on previous outreach, no response yet' : contact.pipelineStage === 'Responded' ? 'Continue the conversation and move toward a partnership' : contact.partnershipType ? 'Maintain the relationship and check in' : 'Move toward the next step'}

Format your response EXACTLY as:
Subject: [subject line]

[email body]`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Received an empty response from Gemini API.");
    }
    return text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to get suggestion from Gemini API. Please check your API key and try again.");
  }
};

export const summarizeEmail = async (
  emailBody: string,
  model: string = 'gemini-3-flash-preview'
): Promise<string> => {
  if (!apiKey) return '';

  const prompt = `Summarize the following email in ONE concise sentence (max 20 words). Focus on the key action, request, or topic only. No preamble.

${emailBody.substring(0, 2000)}`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return (response.text || '').trim().replace(/^["'`]+|["'`]+$/g, '').replace(/\.$/, '');
  } catch {
    return '';
  }
};

export const getRelationshipSummary = async (
  contact: Contact,
  model: string = 'gemini-3-flash-preview'
): Promise<string> => {
  if (!apiKey) return 'API key not configured.';

  const recentInteractions = contact.interactions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15)
    .map(i => {
      const dir = i.isSentByUser ? 'You → Them' : i.isSentByUser === false ? 'Them → You' : '';
      const preview = (i.notes || '').substring(0, 200);
      return `${new Date(i.date).toLocaleDateString()}: [${i.type}]${dir ? ' ' + dir : ''}: "${preview}"`;
    }).join('\n');

  const prompt = `Analyze the relationship between Steven (PathPal Golf) and ${contact.name} (${contact.contactType || 'contact'}).

Contact:
- Stage: ${contact.pipelineStage}
- Partnership: ${contact.partnershipType || 'none yet'}
- Notes: ${(contact.richNotes || contact.notes || 'none').substring(0, 300)}

Recent interactions (newest first):
${recentInteractions || 'No interactions logged.'}

Write 3-4 flowing sentences covering: (1) where the relationship stands now, (2) the overall engagement tone, (3) the single best next action. No bullet points. Be direct and specific.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt });
    return (response.text || '').trim();
  } catch {
    return 'Unable to generate relationship summary.';
  }
};

export const generateEmailDraft = async (
  context: string,
  model: string = 'gemini-3-flash-preview'
): Promise<{ subject: string; body: string }> => {
  if (!apiKey) {
    return { subject: 'Follow Up', body: 'Error: API key not configured.' };
  }

  const prompt = `${context}\n\nFormat your response EXACTLY as:\nSubject: [subject line]\n\n[email body only]`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    const text = response.text || '';
    const lines = text.split('\n');
    const subjectLine = lines.find((l: string) => l.toLowerCase().startsWith('subject:'));
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : 'Follow Up';
    const subjectIdx = lines.findIndex((l: string) => l.toLowerCase().startsWith('subject:'));
    const body = lines.slice(subjectIdx + 2).join('\n').trim();

    return { subject, body };
  } catch (error) {
    console.error("Error generating email draft:", error);
    return { subject: 'Follow Up', body: 'Failed to generate email. Please try again.' };
  }
};
