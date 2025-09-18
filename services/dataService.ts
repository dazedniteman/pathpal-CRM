
import { supabase } from './supabaseClient';
import { Contact, Task, AppSettings } from '../types';
import { PostgrestError } from '@supabase/supabase-js';

// --- HELPERS to convert between camelCase (JS) and snake_case (DB) ---
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, g => g[1].toUpperCase());

const convertKeys = (obj: any, converter: (key: string) => string): any => {
    if (Array.isArray(obj)) {
        return obj.map(v => convertKeys(v, converter));
    } else if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
        return Object.keys(obj).reduce((result, key) => {
            result[converter(key)] = convertKeys(obj[key], converter);
            return result;
        }, {} as any);
    }
    return obj;
};

const objectToSnake = (obj: any) => convertKeys(obj, toSnakeCase);
const objectToCamel = (obj: any) => convertKeys(obj, toCamelCase);

const handleSupabaseError = (error: PostgrestError | null, context: string) => {
    if (error) {
        console.error(`Error in ${context}:`, error);
        throw new Error(error.message);
    }
};

// --- CONTACTS API ---
export const getContacts = async (): Promise<Contact[]> => {
    const { data, error } = await supabase.from('contacts').select('*');
    handleSupabaseError(error, 'getContacts');
    return objectToCamel(data) || [];
};

export const createContact = async (contactData: Omit<Contact, 'id'>): Promise<Contact> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated to create contact.");

    const newContact = {
        ...contactData,
        id: `manual-${Date.now()}`,
        userId: user.id,
    };
    const { data, error } = await supabase
        .from('contacts')
        .insert(objectToSnake(newContact))
        .select()
        .single();
    handleSupabaseError(error, 'createContact');
    return objectToCamel(data);
};

export const updateContact = async (contact: Contact): Promise<Contact> => {
    const { data, error } = await supabase
        .from('contacts')
        .update(objectToSnake(contact))
        .eq('id', contact.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateContact');
    return objectToCamel(data);
};

export const deleteContact = async (contactId: string): Promise<void> => {
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);
    handleSupabaseError(error, 'deleteContact');
};

export const bulkCreateContacts = async (contacts: Contact[]): Promise<Contact[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated to bulk create contacts.");

    const contactsWithUser = contacts.map(contact => ({
        ...contact,
        userId: user.id
    }));

    const { data, error } = await supabase
        .from('contacts')
        .insert(contactsWithUser.map(objectToSnake))
        .select();
    handleSupabaseError(error, 'bulkCreateContacts');
    return objectToCamel(data) || [];
};

export const bulkUpdateContacts = async (contactIds: (string | Contact)[], updates: Partial<Contact> | Contact[]): Promise<Contact[]> => {
    if (Array.isArray(updates)) { // Batch update with different data for each contact
        const updatePromises = updates.map(c => updateContact(c));
        return Promise.all(updatePromises);
    } else { // Update multiple contacts with the same data
        const ids = contactIds.map(c => typeof c === 'string' ? c : c.id);
        const { data, error } = await supabase
            .from('contacts')
            .update(objectToSnake(updates))
            .in('id', ids)
            .select();
        handleSupabaseError(error, 'bulkUpdateContacts (same data)');
        return objectToCamel(data) || [];
    }
};

// --- TASKS API ---
export const getTasks = async (): Promise<Task[]> => {
    const { data, error } = await supabase.from('tasks').select('*');
    handleSupabaseError(error, 'getTasks');
    return objectToCamel(data) || [];
};

export const createTask = async (taskData: Omit<Task, 'id'>): Promise<Task> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated to create task.");
    
    const newTask = {
        ...taskData,
        id: `task-${Date.now()}`,
        userId: user.id,
    };
    const { data, error } = await supabase
        .from('tasks')
        .insert(objectToSnake(newTask))
        .select()
        .single();
    handleSupabaseError(error, 'createTask');
    return objectToCamel(data);
};

export const updateTask = async (task: Task): Promise<Task> => {
    const { data, error } = await supabase
        .from('tasks')
        .update(objectToSnake(task))
        .eq('id', task.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateTask');
    return objectToCamel(data);
};

export const deleteTask = async (taskId: string): Promise<void> => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    handleSupabaseError(error, 'deleteTask');
};

// --- SETTINGS API ---
export const getSettings = async (): Promise<AppSettings | null> => {
    const { data, error } = await supabase.from('settings').select('*').single();
    if (error && error.code !== 'PGRST116') { // Ignore "exact one row" error for new users
        handleSupabaseError(error, 'getSettings');
    }
    return data ? objectToCamel(data) : null;
};

export const saveSettings = async (settings: AppSettings): Promise<AppSettings> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");
    
    const settingsWithUser = { ...settings, userId: user.id };
    const { data, error } = await supabase
        .from('settings')
        .upsert(objectToSnake(settingsWithUser))
        .select()
        .single();
    handleSupabaseError(error, 'saveSettings');
    return objectToCamel(data);
};
