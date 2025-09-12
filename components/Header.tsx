
import React from 'react';
import { View } from '../types';
import { ChartBarIcon, DashboardIcon, ImportIcon, KanbanIcon, SettingsIcon, TableIcon, PlusIcon, TasksIcon, ExportIcon } from './icons';

interface HeaderProps {
  activeView: View;
  onViewChange: (view: View) => void;
  onOpenImportModal: () => void;
  onOpenNewContactModal: () => void;
  onExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeView, onViewChange, onOpenImportModal, onOpenNewContactModal, onExport }) => {
  const navItems: { id: View; name: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'kanban', name: 'Pipeline', icon: <KanbanIcon /> },
    { id: 'table', name: 'Table', icon: <TableIcon /> },
    { id: 'tasks', name: 'Tasks', icon: <TasksIcon /> },
    { id: 'analytics', name: 'Analytics', icon: <ChartBarIcon /> },
    { id: 'settings', name: 'Settings', icon: <SettingsIcon /> },
  ];

  return (
    <header className="bg-secondary shadow-md sticky top-0 z-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white">Gemini CRM</h1>
          </div>
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center px-2 py-2 lg:px-3 rounded-md text-sm font-medium transition-colors duration-200 ${
                  activeView === item.id
                    ? 'bg-highlight text-white'
                    : 'text-text-secondary hover:bg-accent hover:text-white'
                }`}
              >
                {item.icon}
                <span className="ml-2">{item.name}</span>
              </button>
            ))}
          </nav>
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenNewContactModal}
              className="hidden sm:flex items-center bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-500 transition-colors duration-200"
            >
              <PlusIcon />
              <span className="ml-2">New Contact</span>
            </button>
            <button
              onClick={onOpenImportModal}
              className="flex items-center bg-highlight text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-500 transition-colors duration-200"
            >
              <ImportIcon />
              <span className="ml-2 hidden sm:inline">Import</span>
            </button>
             <button
              onClick={onExport}
              className="flex items-center bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-500 transition-colors duration-200"
            >
              <ExportIcon />
              <span className="ml-2 hidden sm:inline">Export</span>
            </button>
          </div>
        </div>
      </div>
       {/* Mobile Nav */}
      <nav className="md:hidden bg-secondary border-t border-accent">
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 flex justify-around">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex flex-col items-center px-2 py-2 rounded-md text-xs font-medium transition-colors duration-200 w-full ${
                  activeView === item.id
                    ? 'bg-highlight text-white'
                    : 'text-text-secondary hover:bg-accent hover:text-white'
                }`}
              >
                {item.icon}
                <span className="mt-1">{item.name}</span>
              </button>
            ))}
        </div>
      </nav>
    </header>
  );
};
