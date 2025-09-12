
import React, { useState, useMemo } from 'react';
import { Task, Contact } from '../types';
import { PlusIcon, TrashIcon, CheckCircleIcon } from './icons';

interface TasksViewProps {
  tasks: Task[];
  contacts: Contact[];
  onUpdateTask: (task: Task) => void;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onDeleteTask: (taskId: string) => void;
  onSelectContact: (contact: Contact) => void;
}

const TaskItem: React.FC<{ task: Task, contactName?: string; onUpdate: (task: Task) => void; onDelete: (taskId: string) => void; onContactClick: () => void; }> = ({ task, contactName, onUpdate, onDelete, onContactClick }) => {
  return (
    <div className={`p-4 rounded-lg flex items-center justify-between transition-colors ${task.completed ? 'bg-accent/50' : 'bg-accent'}`}>
      <div className="flex items-center space-x-4">
        <button onClick={() => onUpdate({ ...task, completed: !task.completed })}>
          {task.completed 
            ? <CheckCircleIcon className="w-6 h-6 text-green-500" /> 
            : <div className="w-6 h-6 rounded-full border-2 border-text-secondary"></div>
          }
        </button>
        <div>
          <p className={`font-medium ${task.completed ? 'line-through text-text-secondary' : 'text-white'}`}>{task.title}</p>
          {contactName && (
             <button onClick={onContactClick} className="text-xs text-highlight hover:underline">{contactName}</button>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm text-text-secondary">{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</span>
        <button onClick={() => onDelete(task.id)} className="text-red-500/70 hover:text-red-500"><TrashIcon /></button>
      </div>
    </div>
  );
};

export const TasksView: React.FC<TasksViewProps> = ({ tasks, contacts, onUpdateTask, onAddTask, onDeleteTask, onSelectContact }) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskContactId, setNewTaskContactId] = useState<string>('');
  
  const contactsMap = useMemo(() => new Map(contacts.map(c => [c.id, c])), [contacts]);

  const sortedTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    
    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const upcoming: Task[] = [];
    const completed: Task[] = [];
    
    [...tasks].sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).forEach(task => {
        if (task.completed) {
            completed.push(task);
            return;
        }
        const dueDate = new Date(task.dueDate);
        if (dueDate < today) overdue.push(task);
        else if (dueDate >= today && dueDate < tomorrow) todayTasks.push(task);
        else upcoming.push(task);
    });
    return { overdue, today: todayTasks, upcoming, completed: completed.slice(0, 10) }; // Show last 10 completed
  }, [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDueDate) return;
    onAddTask({
      title: newTaskTitle,
      dueDate: newTaskDueDate,
      completed: false,
      contactId: newTaskContactId || undefined,
    });
    setNewTaskTitle('');
    setNewTaskDueDate('');
    setNewTaskContactId('');
  };

  const renderTaskList = (taskList: Task[], title: string) => (
    <section>
      <h3 className="text-xl font-bold text-white mb-4">{title} ({taskList.length})</h3>
      <div className="space-y-3">
        {taskList.length > 0 
          ? taskList.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                contactName={task.contactId ? contactsMap.get(task.contactId)?.name : undefined}
                onUpdate={onUpdateTask}
                onDelete={onDeleteTask}
                onContactClick={() => task.contactId && onSelectContact(contactsMap.get(task.contactId)!)}
              />
            ))
          : <p className="text-text-secondary text-sm">No tasks in this category.</p>
        }
      </div>
    </section>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">My Tasks</h2>
      </div>

      <div className="bg-secondary p-6 rounded-lg shadow-lg">
        <h3 className="text-xl font-semibold text-white mb-4">Add a New Task</h3>
        <form onSubmit={handleAddTask} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-sm text-text-secondary mb-1 block">Task Title</label>
            <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="e.g., Follow up with Alex about demo" required className="w-full bg-accent p-2 rounded-md text-white"/>
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Due Date</label>
            <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} required className="w-full bg-accent p-2 rounded-md text-white"/>
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Link to Contact (Optional)</label>
            <select value={newTaskContactId} onChange={e => setNewTaskContactId(e.target.value)} className="w-full bg-accent p-2 rounded-md text-white">
                <option value="">None</option>
                {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
           <button type="submit" className="md:col-start-4 bg-highlight text-white px-4 py-2 rounded-md font-medium hover:bg-blue-500 flex items-center justify-center space-x-2">
             <PlusIcon /> <span>Add Task</span>
           </button>
        </form>
      </div>

      <div className="space-y-8">
        {renderTaskList(sortedTasks.overdue, 'Overdue')}
        {renderTaskList(sortedTasks.today, 'Today')}
        {renderTaskList(sortedTasks.upcoming, 'Upcoming')}
        {renderTaskList(sortedTasks.completed, 'Recently Completed')}
      </div>
    </div>
  );
};
