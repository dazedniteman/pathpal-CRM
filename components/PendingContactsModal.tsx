
import React, { useState, useMemo } from 'react';
import { Contact } from '../types';
import { PendingContact } from '../services/gmailService';

interface PendingContactsModalProps {
  pendingContacts: PendingContact[];
  contacts: Contact[];
  /** Called once with ALL pending contacts marked "Add as New" — allows sequential modal opening */
  onAddBatch: (pending: PendingContact[]) => void;
  onAssignToExisting: (pending: PendingContact, contactId: string) => void;
  /** Called once with ALL emails that were marked "ignore" — avoids stale-closure bug of calling onIgnore N times */
  onIgnoreBatch: (emails: string[]) => void;
  onClose: () => void;
}

type ItemAction = 'none' | 'add' | 'assign' | 'ignored';

interface ItemState {
  action: ItemAction;
  assignToId?: string;
}

export const PendingContactsModal: React.FC<PendingContactsModalProps> = ({
  pendingContacts,
  contacts,
  onAddBatch,
  onAssignToExisting,
  onIgnoreBatch,
  onClose,
}) => {
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const setItemState = (email: string, state: ItemState) => {
    setItemStates(prev => ({ ...prev, [email]: state }));
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  const resolvedCount = useMemo(
    () => Object.values(itemStates).filter(s => s.action !== 'none').length,
    [itemStates]
  );

  const handleApplyAll = () => {
    const toAdd: PendingContact[] = [];
    const ignoredEmails: string[] = [];

    pendingContacts.forEach(p => {
      const state = itemStates[p.fromEmail];
      if (!state || state.action === 'none') return;
      if (state.action === 'add') {
        toAdd.push(p);
      } else if (state.action === 'assign' && state.assignToId) {
        onAssignToExisting(p, state.assignToId);
      } else if (state.action === 'ignored') {
        ignoredEmails.push(p.fromEmail);
      }
    });

    if (ignoredEmails.length > 0) {
      onIgnoreBatch(ignoredEmails);
    }

    // Pass all "add" contacts as a batch — App will open them sequentially
    if (toAdd.length > 0) {
      onAddBatch(toAdd);
      return; // don't call onClose — the batch handler closes the modal
    }

    onClose();
  };

  const handleIgnoreAll = () => {
    const allEmails = pendingContacts.map(p => p.fromEmail);
    onIgnoreBatch(allEmails);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-base-800 border border-base-600 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-600 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Pending Contacts</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {pendingContacts.length} email{pendingContacts.length !== 1 ? 's' : ''} from unknown senders — select an action for each, then click Apply.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleIgnoreAll}
              className="text-xs text-text-muted hover:text-text-secondary px-3 py-1.5 bg-base-700 border border-base-600 rounded-lg transition-colors"
            >
              Ignore All
            </button>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-base-700">
          {pendingContacts.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-text-muted text-sm">No unmatched senders found.</p>
            </div>
          ) : (
            pendingContacts.map(pending => {
              const state = itemStates[pending.fromEmail] || { action: 'none' as ItemAction };
              const isResolved = state.action !== 'none';

              return (
                <div
                  key={pending.fromEmail}
                  className={`p-4 transition-all ${isResolved ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Sender info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-8 h-8 rounded-full bg-base-600 border border-base-500 flex items-center justify-center flex-shrink-0 text-xs font-bold text-text-secondary">
                          {(pending.fromName || pending.fromEmail)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          {pending.fromName && (
                            <div className="text-sm font-semibold text-text-primary truncate">{pending.fromName}</div>
                          )}
                          <div className="text-xs text-text-muted truncate">{pending.fromEmail}</div>
                        </div>
                      </div>
                      <div className="ml-10">
                        <div className="text-xs text-text-secondary truncate">
                          <span className="font-medium">{pending.subject}</span>
                        </div>
                        <div className="text-xs text-text-muted truncate mt-0.5">{pending.snippet}</div>
                        <div className="text-xs text-text-muted font-mono mt-0.5">
                          {new Date(pending.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[200px]">
                      {/* Add as new contact */}
                      <button
                        onClick={() => setItemState(pending.fromEmail, {
                          action: state.action === 'add' ? 'none' : 'add'
                        })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          state.action === 'add'
                            ? 'bg-outreach-dim border border-outreach/40 text-outreach-light'
                            : 'bg-base-700 border border-base-600 text-text-muted hover:text-text-secondary hover:border-base-500'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add as New Contact
                      </button>

                      {/* Assign to existing */}
                      <div className="relative">
                        <select
                          value={state.action === 'assign' ? (state.assignToId || '') : ''}
                          onChange={e => {
                            const val = e.target.value;
                            setItemState(pending.fromEmail, val
                              ? { action: 'assign', assignToId: val }
                              : { action: 'none' }
                            );
                          }}
                          className={`w-full appearance-none px-3 py-1.5 rounded-lg text-xs font-medium transition-all outline-none ${
                            state.action === 'assign'
                              ? 'bg-partner-dim border border-partner/40 text-partner-light'
                              : 'bg-base-700 border border-base-600 text-text-muted'
                          }`}
                        >
                          <option value="">Assign to existing…</option>
                          {filteredContacts.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                          ))}
                        </select>
                      </div>

                      {/* Ignore — marks for batch apply, NOT immediate */}
                      <button
                        onClick={() => setItemState(pending.fromEmail, {
                          action: state.action === 'ignored' ? 'none' : 'ignored'
                        })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          state.action === 'ignored'
                            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                            : 'bg-base-700 border border-base-600 text-text-muted hover:text-red-400 hover:border-red-500/20'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        Ignore
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-base-700 border-t border-base-600 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
          <p className="text-xs text-text-muted">
            {resolvedCount} of {pendingContacts.length} resolved
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text-secondary bg-base-600 hover:bg-base-500 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleApplyAll}
              disabled={resolvedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-outreach hover:bg-outreach-light rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply {resolvedCount > 0 ? `(${resolvedCount})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
