
import { supabase } from './supabaseClient';
import { Contact, Task, AppSettings, Product, ContactProduct, EmailTemplate, Sequence, ContactSequence, Project, ContactProject } from '../types';
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

// --- PRODUCTS API ---
export const getProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: true });
    handleSupabaseError(error, 'getProducts');
    return objectToCamel(data) || [];
};

export const createProduct = async (productData: Omit<Product, 'id'>): Promise<Product> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated to create product.");

    const newProduct = { ...productData, userId: user.id };
    const { data, error } = await supabase
        .from('products')
        .insert(objectToSnake(newProduct))
        .select()
        .single();
    handleSupabaseError(error, 'createProduct');
    return objectToCamel(data);
};

export const updateProduct = async (product: Product): Promise<Product> => {
    const { data, error } = await supabase
        .from('products')
        .update(objectToSnake(product))
        .eq('id', product.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateProduct');
    return objectToCamel(data);
};

export const deleteProduct = async (productId: string): Promise<void> => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    handleSupabaseError(error, 'deleteProduct');
};

// --- CONTACT PRODUCTS API ---
export const getContactProducts = async (contactId: string): Promise<ContactProduct[]> => {
    const { data, error } = await supabase
        .from('contact_products')
        .select('*')
        .eq('contact_id', contactId);
    handleSupabaseError(error, 'getContactProducts');
    return objectToCamel(data) || [];
};

export const linkContactProduct = async (link: Omit<ContactProduct, 'id'>): Promise<ContactProduct> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated to link product.");

    const newLink = { ...link, userId: user.id };
    const { data, error } = await supabase
        .from('contact_products')
        .insert(objectToSnake(newLink))
        .select()
        .single();
    handleSupabaseError(error, 'linkContactProduct');
    return objectToCamel(data);
};

export const updateContactProduct = async (link: ContactProduct): Promise<ContactProduct> => {
    const { data, error } = await supabase
        .from('contact_products')
        .update(objectToSnake(link))
        .eq('id', link.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateContactProduct');
    return objectToCamel(data);
};

export const unlinkContactProduct = async (linkId: string): Promise<void> => {
    const { error } = await supabase.from('contact_products').delete().eq('id', linkId);
    handleSupabaseError(error, 'unlinkContactProduct');
};

// --- EMAIL TEMPLATES API ---
export const getTemplates = async (): Promise<EmailTemplate[]> => {
    const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: true });
    handleSupabaseError(error, 'getTemplates');
    return objectToCamel(data) || [];
};

export const createTemplate = async (templateData: Omit<EmailTemplate, 'id'>): Promise<EmailTemplate> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated to create template.");

    const newTemplate = { ...templateData, userId: user.id };
    const { data, error } = await supabase
        .from('email_templates')
        .insert(objectToSnake(newTemplate))
        .select()
        .single();
    handleSupabaseError(error, 'createTemplate');
    return objectToCamel(data);
};

export const updateTemplate = async (template: EmailTemplate): Promise<EmailTemplate> => {
    const { data, error } = await supabase
        .from('email_templates')
        .update(objectToSnake(template))
        .eq('id', template.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateTemplate');
    return objectToCamel(data);
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    const { error } = await supabase.from('email_templates').delete().eq('id', templateId);
    handleSupabaseError(error, 'deleteTemplate');
};

export const incrementTemplateSendCount = async (templateId: string): Promise<void> => {
    const { error } = await supabase.rpc('increment_template_send_count', { template_id: templateId });
    if (error) {
        // Fallback: fetch and update manually if RPC not available
        const { data } = await supabase.from('email_templates').select('send_count').eq('id', templateId).single();
        if (data) {
            await supabase
                .from('email_templates')
                .update({ send_count: (data.send_count || 0) + 1 })
                .eq('id', templateId);
        }
    }
};

export const incrementTemplateOpenCount = async (templateId: string): Promise<void> => {
    const { error } = await supabase.rpc('increment_template_open_count', { template_id: templateId });
    if (error) {
        // Fallback: fetch and update manually if RPC not available
        const { data } = await supabase.from('email_templates').select('open_count').eq('id', templateId).single();
        if (data) {
            await supabase
                .from('email_templates')
                .update({ open_count: (data.open_count || 0) + 1 })
                .eq('id', templateId);
        }
    }
};

// --- SEQUENCES API ---

export const getSequences = async (): Promise<Sequence[]> => {
    const { data, error } = await supabase
        .from('sequences')
        .select('*')
        .order('created_at', { ascending: true });
    handleSupabaseError(error, 'getSequences');
    return objectToCamel(data) || [];
};

export const createSequence = async (seqData: Omit<Sequence, 'id' | 'createdAt'>): Promise<Sequence> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated to create sequence.');

    const newSeq = {
        ...seqData,
        id: `seq-${Date.now()}`,
        userId: user.id,
    };
    const { data, error } = await supabase
        .from('sequences')
        .insert(objectToSnake(newSeq))
        .select()
        .single();
    handleSupabaseError(error, 'createSequence');
    return objectToCamel(data) as Sequence;
};

export const updateSequence = async (seq: Sequence): Promise<Sequence> => {
    const { data, error } = await supabase
        .from('sequences')
        .update(objectToSnake(seq))
        .eq('id', seq.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateSequence');
    return objectToCamel(data) as Sequence;
};

export const deleteSequence = async (seqId: string): Promise<void> => {
    const { error } = await supabase.from('sequences').delete().eq('id', seqId);
    handleSupabaseError(error, 'deleteSequence');
};

// --- CONTACT SEQUENCES API ---

export const getContactSequences = async (contactId?: string): Promise<ContactSequence[]> => {
    let query = supabase
        .from('contact_sequences')
        .select('*')
        .eq('status', 'active');
    if (contactId) query = query.eq('contact_id', contactId);
    const { data, error } = await query;
    handleSupabaseError(error, 'getContactSequences');
    return objectToCamel(data) || [];
};

export const enrollContact = async (
    contactId: string,
    sequenceId: string
): Promise<ContactSequence> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated to enroll contact.');

    const newEnrollment = {
        id: `cs-${Date.now()}`,
        userId: user.id,
        contactId,
        sequenceId,
        enrolledAt: new Date().toISOString(),
        completedStepIds: [],
        status: 'active',
    };
    const { data, error } = await supabase
        .from('contact_sequences')
        .insert(objectToSnake(newEnrollment))
        .select()
        .single();
    handleSupabaseError(error, 'enrollContact');
    return objectToCamel(data) as ContactSequence;
};

export const completeStep = async (
    enrollmentId: string,
    stepId: string,
    allStepIds: string[]
): Promise<ContactSequence> => {
    // Fetch current completed_step_ids
    const { data: current, error: fetchErr } = await supabase
        .from('contact_sequences')
        .select('completed_step_ids')
        .eq('id', enrollmentId)
        .single();
    handleSupabaseError(fetchErr, 'completeStep (fetch)');

    const existingIds: string[] = current?.completed_step_ids || [];
    const updatedIds = existingIds.includes(stepId)
        ? existingIds
        : [...existingIds, stepId];
    const isAllDone = allStepIds.length > 0 && allStepIds.every(id => updatedIds.includes(id));

    const { data, error } = await supabase
        .from('contact_sequences')
        .update({
            completed_step_ids: updatedIds,
            status: isAllDone ? 'completed' : 'active',
        })
        .eq('id', enrollmentId)
        .select()
        .single();
    handleSupabaseError(error, 'completeStep (update)');
    return objectToCamel(data) as ContactSequence;
};

export const unenrollContact = async (enrollmentId: string): Promise<void> => {
    const { error } = await supabase
        .from('contact_sequences')
        .update({ status: 'unenrolled' })
        .eq('id', enrollmentId);
    handleSupabaseError(error, 'unenrollContact');
};

// --- PROJECTS API ---

export const getProjects = async (): Promise<Project[]> => {
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: true });
    handleSupabaseError(error, 'getProjects');
    return objectToCamel(data) || [];
};

export const createProject = async (projectData: Omit<Project, 'id' | 'createdAt'>): Promise<Project> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated to create project.');

    const newProject = { ...projectData, id: `proj-${Date.now()}`, userId: user.id };
    const { data, error } = await supabase
        .from('projects')
        .insert(objectToSnake(newProject))
        .select()
        .single();
    handleSupabaseError(error, 'createProject');
    return objectToCamel(data) as Project;
};

export const updateProject = async (project: Project): Promise<Project> => {
    const { data, error } = await supabase
        .from('projects')
        .update(objectToSnake(project))
        .eq('id', project.id)
        .select()
        .single();
    handleSupabaseError(error, 'updateProject');
    return objectToCamel(data) as Project;
};

export const deleteProject = async (projectId: string): Promise<void> => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    handleSupabaseError(error, 'deleteProject');
};

export const getContactProjects = async (contactId?: string): Promise<ContactProject[]> => {
    let query = supabase.from('contact_projects').select('*');
    if (contactId) query = query.eq('contact_id', contactId);
    const { data, error } = await query;
    handleSupabaseError(error, 'getContactProjects');
    return objectToCamel(data) || [];
};

export const linkContactProject = async (link: Omit<ContactProject, 'id' | 'createdAt'>): Promise<ContactProject> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated to link project.');

    const newLink = { ...link, id: `cp-${Date.now()}`, userId: user.id };
    const { data, error } = await supabase
        .from('contact_projects')
        .insert(objectToSnake(newLink))
        .select()
        .single();
    handleSupabaseError(error, 'linkContactProject');
    return objectToCamel(data) as ContactProject;
};

export const unlinkContactProject = async (linkId: string): Promise<void> => {
    const { error } = await supabase.from('contact_projects').delete().eq('id', linkId);
    handleSupabaseError(error, 'unlinkContactProject');
};
