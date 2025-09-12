
import { GoogleGenAI } from "@google/genai";
import { Contact } from '../types';

if (!process.env.API_KEY) {
    console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export const getFollowUpSuggestion = async (contact: Contact, productContext?: string, tags?: string[]): Promise<string> => {
  const interactionHistory = contact.interactions.map(i => 
    `- On ${new Date(i.date).toLocaleDateString()}, a ${i.type} was logged: "${i.notes}" ${i.outcome ? `Outcome: ${i.outcome}` : ''}`
  ).join('\n');

  const prompt = `
    You are a helpful CRM assistant. Your task is to write a concise, friendly, and professional follow-up email.
    
    ${productContext ? `Here is some background context on the product/service being offered: ${productContext}` : ''}

    Here is the contact's information:
    - Name: ${contact.name}
    - Email: ${contact.email}
    - Biography: ${contact.biography || 'No biography provided.'}
    - User-added Notes: ${contact.notes || 'No specific notes provided.'}
    - Location: ${contact.location || 'Unknown'}
    - Website: ${contact.website || 'N/A'}
    - Instagram: ${contact.instagramHandle || 'N/A'} with ${contact.followers || 'N/A'} followers.
    - Posts: ${contact.posts || 'N/A'}
    - Current Pipeline Stage: ${contact.pipelineStage}
    ${tags && tags.length > 0 ? `- Tags: ${tags.join(', ')}` : ''}

    Here is the recent communication history:
    ${interactionHistory || "No previous interactions logged."}

    The last contact was on ${new Date(contact.lastContacted).toLocaleDateString()}.
    The goal is to re-engage the contact, move them to the next stage of the pipeline if appropriate, and maintain a positive relationship.

    Based on all this information, please generate a subject line and a short follow-up email body. The tone should be helpful and not overly pushy. Format the output as follows:
    Subject: [Your suggested subject line]
    
    [Your suggested email body]
  `;

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    const text = response.text;
    if (!text) {
        throw new Error("Received an empty response from Gemini API.");
    }
    return text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to get suggestion from Gemini API.");
  }
};
