
import React, { useState, useEffect } from 'react';
import { AppSettings, GoogleAuthState } from '../types';
import { GmailIcon, ChevronDownIcon, TrashIcon, PlusIcon } from './icons';

interface SettingsProps {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  googleAuthState: GoogleAuthState;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSettingsChange, googleAuthState, onGoogleSignIn, onGoogleSignOut }) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => { setLocalSettings(settings); }, [settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({ ...prev, [name]: name === 'defaultFollowUpDays' ? parseInt(value, 10) : value }));
    setSaveStatus('idle');
  };

  const handlePipelineChange = (index: number, value: string) => {
    const newStages = [...localSettings.pipelineStages];
    newStages[index] = value;
    setLocalSettings(prev => ({...prev, pipelineStages: newStages }));
    setSaveStatus('idle');
  };
  
  const addPipelineStage = () => {
    setLocalSettings(prev => ({...prev, pipelineStages: [...prev.pipelineStages, 'New Stage']}));
    setSaveStatus('idle');
  };

  const removePipelineStage = (index: number) => {
    if (localSettings.pipelineStages.length <= 1) {
        alert("You must have at least one pipeline stage.");
        return;
    }
    setLocalSettings(prev => ({...prev, pipelineStages: prev.pipelineStages.filter((_, i) => i !== index)}));
    setSaveStatus('idle');
  };

  const handleSave = () => {
    setSaveStatus('saving');
    onSettingsChange(localSettings);
    setTimeout(() => setSaveStatus('saved'), 1000);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-white">Settings</h2>
      
      <div className="bg-secondary p-6 rounded-lg shadow-lg space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">AI Assistant Context</h3>
          <p className="text-sm text-text-secondary mb-3">Provide background information on your product or service. This context will be used by the AI to generate more relevant and effective follow-up emails.</p>
          <textarea name="productContext" value={localSettings.productContext} onChange={handleInputChange} rows={6} className="w-full bg-accent p-3 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" placeholder="e.g., We sell a premium golf coaching subscription..."/>
        </div>
        <div>
            <h3 className="text-xl font-semibold text-white mb-2">Follow-up Automation</h3>
            <p className="text-sm text-text-secondary mb-3">Set the default number of days after the last contact before a person appears in the "Needs Follow-up" list.</p>
            <div className="flex items-center space-x-3"><input type="number" name="defaultFollowUpDays" value={localSettings.defaultFollowUpDays} onChange={handleInputChange} className="w-24 bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" /><span className="text-text-secondary">days</span></div>
        </div>
      </div>
      
       <div className="bg-secondary p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-white mb-2">Customize Pipeline</h3>
        <p className="text-sm text-text-secondary mb-3">Add, rename, or remove stages to match your sales process. Drag and drop to reorder is not yet supported.</p>
        <div className="space-y-3">
          {localSettings.pipelineStages.map((stage, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input type="text" value={stage} onChange={e => handlePipelineChange(index, e.target.value)} className="w-full bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" />
              <button onClick={() => removePipelineStage(index)} className="p-2 bg-red-500/50 text-white rounded-md hover:bg-red-500/80"><TrashIcon/></button>
            </div>
          ))}
          <button onClick={addPipelineStage} className="flex items-center space-x-2 text-sm text-highlight font-semibold hover:text-blue-400"><PlusIcon /><span>Add Stage</span></button>
        </div>
      </div>

       <div className="bg-secondary p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-2">Integrations</h3>
           <p className="text-sm text-text-secondary mb-4">Connect your accounts to automate data entry. This prototype requires a one-time setup to create a secure connection to your Gmail account.</p>
            <details className="group bg-accent p-4 rounded-md mb-4">
                <summary className="flex items-center justify-between font-medium text-white list-none cursor-pointer"><span>How-To Guide: Get your Google Client ID</span><ChevronDownIcon className="w-5 h-5 transition-transform duration-200 group-open:rotate-180" /></summary>
                <div className="mt-4 pt-4 border-t border-gray-600 text-sm text-text-secondary space-y-4">
                    <p>Follow these steps in the Google Cloud Console to get a Client ID, which allows this app to securely access your emails with your permission.</p>
                    <ol className="list-decimal list-inside space-y-3">
                        <li><strong>Create Project:</strong> Go to <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">Google Cloud Console</a> and create a new project (e.g., "My CRM App").</li>
                        <li><strong>Enable Gmail API:</strong> In your new project, go to the <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">Gmail API page</a> and click <strong>Enable</strong>.</li>
                        <li><strong>Configure Consent Screen:</strong> Go to the <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">OAuth consent screen</a>.<ul className="list-disc list-inside ml-4 mt-2 space-y-1"><li>Select <strong>External</strong> and click Create.</li><li>Fill in required fields (App name, your email). Click "Save and Continue".</li><li>Skip the "Scopes" and "Test Users" sections.</li><li>On the Summary page, click <strong>"Back to Dashboard"</strong>.</li></ul></li>
                        <li><strong>Create Credentials:</strong> Go to the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">Credentials page</a>.<ul className="list-disc list-inside ml-4 mt-2 space-y-1"><li>Click <strong>+ CREATE CREDENTIALS</strong> &rarr; <strong>OAuth client ID</strong>.</li><li>Application type: <strong>Web application</strong>.</li><li>Under <strong>"Authorized JavaScript origins"</strong>, add URI: <code>https://aistudio.google.com</code></li><li>Under <strong>"Authorized redirect URIs"</strong>, add URI: <code>https://aistudio.google.com/connections/oauth_callback</code></li><li>Click <strong>Create</strong>.</li></ul></li>
                        <li><strong>Copy & Paste:</strong> A pop-up will show your Client ID. Copy it and paste it into the field below.</li>
                        <li><strong>Save & Connect:</strong> Click <strong>"Save Settings"</strong> at the bottom, then come back here and click <strong>"Connect to Gmail"</strong>.</li>
                    </ol>
                </div>
            </details>
            <div className="mb-4">
              <label htmlFor="googleClientId" className="block text-sm font-medium text-text-secondary mb-1">Google Client ID</label>
              <input type="text" id="googleClientId" name="googleClientId" value={localSettings.googleClientId || ''} onChange={handleInputChange} className="w-full bg-accent p-2 rounded-md text-white text-sm focus:ring-2 focus:ring-highlight outline-none" placeholder="Paste your Client ID here..."/>
          </div>
           {googleAuthState.isAuthenticated && googleAuthState.profile ? (
              <div className="flex items-center justify-between p-3 bg-green-500/20 text-green-300 rounded-md"><div className="flex items-center"><img src={googleAuthState.profile.picture} alt="profile" className="w-8 h-8 rounded-full" /><div className="ml-3"><p className="font-medium text-white">Connected to Gmail</p><p className="text-xs text-text-secondary">{googleAuthState.profile.email}</p></div></div><button onClick={onGoogleSignOut} className="bg-red-500/50 text-white px-3 py-1 text-xs rounded-md hover:bg-red-500/80">Disconnect</button></div>
           ) : ( <button onClick={onGoogleSignIn} disabled={!localSettings.googleClientId} className="flex items-center bg-highlight text-white px-4 py-2 rounded-md font-medium hover:bg-blue-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"><GmailIcon /><span className="ml-2">Connect to Gmail</span></button> )}
       </div>
      <div className="flex justify-end"><button onClick={handleSave} disabled={saveStatus === 'saving'} className="bg-highlight text-white px-6 py-2 rounded-md font-medium hover:bg-blue-500 transition-all duration-200 disabled:bg-gray-500 w-32">{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Settings'}</button></div>
    </div>
  );
};
