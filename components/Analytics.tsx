
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Funnel, FunnelChart, LabelList } from 'recharts';
import { Contact } from '../types';

interface AnalyticsProps {
  contacts: Contact[];
  pipelineStages: string[];
}

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6'];

export const Analytics: React.FC<AnalyticsProps> = ({ contacts, pipelineStages }) => {
  const pipelineData = useMemo(() => {
    return pipelineStages.map(stage => ({
      name: stage,
      count: contacts.filter(c => c.pipelineStage === stage).length,
    }));
  }, [contacts, pipelineStages]);

  const successData = useMemo(() => {
    const successful = contacts.filter(c => c.pipelineStage === 'Closed - Success').length;
    const unsuccessful = contacts.filter(c => c.pipelineStage === 'Closed - Unsuccessful').length;
    const ongoing = contacts.length - successful - unsuccessful;
    return [
      { name: 'Successful', value: successful, color: '#10b981' },
      { name: 'Unsuccessful', value: unsuccessful, color: '#ef4444' },
      { name: 'Ongoing', value: ongoing, color: '#3b82f6' },
    ];
  }, [contacts]);

  const conversionFunnelData = useMemo(() => {
    let funnelData: { stage: string, count: number }[] = [];
    let cumulativeCount = 0;
    
    // Assume contacts can only be in one stage at a time and stages are ordered
    const stageSet = new Set(contacts.map(c => c.pipelineStage));
    const contactsByStage = pipelineStages.reduce((acc, stage) => {
        acc[stage] = contacts.filter(c => c.pipelineStage === stage).length;
        return acc;
    }, {} as Record<string, number>);
    
    // We can assume anyone in a later stage must have passed through an earlier one.
    let totalInFunnel = contacts.length - (contactsByStage['Closed - Unsuccessful'] || 0);

    pipelineStages.forEach(stage => {
        if (stage === 'Closed - Unsuccessful') return;

        funnelData.push({ stage, count: totalInFunnel });

        if (stage !== 'Closed - Success') {
            totalInFunnel -= (contactsByStage[stage] || 0);
        }
    });

    return funnelData.map((data, index) => ({
      value: data.count,
      name: data.stage,
      fill: COLORS[index % COLORS.length]
    }));

  }, [contacts, pipelineStages]);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-bold text-white">Analytics & Reports</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-secondary p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6">Conversion Funnel</h3>
           <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip
                  contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }}
                  labelStyle={{ color: '#f7fafc' }}
              />
              <Funnel dataKey="value" data={conversionFunnelData} isAnimationActive>
                <LabelList position="right" fill="#fff" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-secondary p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6">Pipeline Stage Distribution</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={pipelineData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
              <XAxis type="number" stroke="#a0aec0" />
              <YAxis type="category" dataKey="name" stroke="#a0aec0" width={120} />
              <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }} />
              <Bar dataKey="count" fill="#3b82f6" name="Contacts" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-secondary p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6">Deal Outcome Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={successData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {successData.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.color} />))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }}/>
               <Legend wrapperStyle={{ color: '#a0aec0' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-secondary p-6 rounded-lg shadow-lg">
           <h3 className="text-xl font-semibold text-white mb-6">Key Metrics</h3>
           <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-accent rounded-md"><span className="font-medium text-text-secondary">Total Contacts</span><span className="font-bold text-2xl text-white">{contacts.length}</span></div>
             <div className="flex justify-between items-center p-4 bg-accent rounded-md"><span className="font-medium text-text-secondary">Deals Won</span><span className="font-bold text-2xl text-white">{successData.find(d=>d.name==='Successful')?.value || 0}</span></div>
             <div className="flex justify-between items-center p-4 bg-accent rounded-md"><span className="font-medium text-text-secondary">Average Followers</span><span className="font-bold text-2xl text-white">{ contacts.length > 0 ? (contacts.reduce((acc, c) => acc + (c.followers || 0), 0) / contacts.filter(c => c.followers).length).toFixed(0) : 0 }</span></div>
           </div>
        </div>
      </div>
    </div>
  );
};
