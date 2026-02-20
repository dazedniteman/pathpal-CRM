
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Funnel, FunnelChart, LabelList } from 'recharts';
import { Contact, EmailTemplate } from '../types';

interface AnalyticsProps {
  contacts: Contact[];
  pipelineStages: string[];
  templates?: EmailTemplate[];
}

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#ef4444', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6'];

export const Analytics: React.FC<AnalyticsProps> = ({ contacts, pipelineStages, templates = [] }) => {
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

  // Template A/B performance
  const templatePerformance = useMemo(() => {
    if (templates.length === 0) return { standalone: [], abGroups: [] };

    const withStats = templates.map(t => ({
      ...t,
      sends: t.sendCount || 0,
      opens: t.openCount || 0,
      openRate: t.sendCount ? Math.round(((t.openCount || 0) / t.sendCount) * 100) : null,
    }));

    // Group by variantGroup
    const grouped = new Map<string, typeof withStats>();
    const standalone: typeof withStats = [];
    for (const t of withStats) {
      if (!t.variantGroup) { standalone.push(t); continue; }
      if (!grouped.has(t.variantGroup)) grouped.set(t.variantGroup, []);
      grouped.get(t.variantGroup)!.push(t);
    }

    const abGroups = Array.from(grouped.entries()).map(([groupName, variants]) => {
      const winner = variants.reduce((best, v) =>
        (v.openRate ?? -1) > (best.openRate ?? -1) ? v : best, variants[0]);
      return { groupName, variants, winnerId: winner.opens > 0 ? winner.id : null };
    });

    return { standalone, abGroups };
  }, [templates]);

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

      {/* Template A/B Performance */}
      {templates.length > 0 && (
        <div className="bg-secondary p-6 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold text-white mb-6">Template Performance</h3>

          {/* A/B Groups */}
          {templatePerformance.abGroups.length > 0 && (
            <div className="mb-6 space-y-4">
              <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">A/B Test Groups</h4>
              {templatePerformance.abGroups.map(({ groupName, variants, winnerId }) => (
                <div key={groupName} className="border border-base-600 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 bg-base-700 border-b border-base-600 flex items-center gap-2">
                    <span className="text-xs font-mono text-text-muted uppercase">Group:</span>
                    <span className="text-sm font-medium text-text-primary">{groupName}</span>
                  </div>
                  <div className="divide-y divide-base-600">
                    {variants.map(v => (
                      <div key={v.id} className={`flex items-center gap-4 px-4 py-3 ${v.id === winnerId ? 'bg-partner-dim' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-text-primary truncate">{v.name}</p>
                            {v.id === winnerId && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-partner/20 text-partner-light font-medium flex-shrink-0">Winner</span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted truncate">{v.subject}</p>
                        </div>
                        <div className="flex items-center gap-6 flex-shrink-0 text-right">
                          <div>
                            <p className="text-sm font-mono font-semibold text-text-primary">{v.sends}</p>
                            <p className="text-xs text-text-muted">Sent</p>
                          </div>
                          <div>
                            <p className="text-sm font-mono font-semibold text-text-primary">{v.opens}</p>
                            <p className="text-xs text-text-muted">Opened</p>
                          </div>
                          <div>
                            <p className={`text-sm font-mono font-semibold ${v.openRate !== null ? (v.openRate >= 30 ? 'text-partner-light' : v.openRate >= 15 ? 'text-sold-light' : 'text-text-secondary') : 'text-text-muted'}`}>
                              {v.openRate !== null ? `${v.openRate}%` : '—'}
                            </p>
                            <p className="text-xs text-text-muted">Open rate</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Standalone templates */}
          {templatePerformance.standalone.length > 0 && (
            <div className="space-y-2">
              {templatePerformance.abGroups.length > 0 && (
                <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Individual Templates</h4>
              )}
              <div className="overflow-hidden rounded-lg border border-base-600">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-base-700 border-b border-base-600">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Template</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Sent</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Opened</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wide">Open Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-base-600">
                    {templatePerformance.standalone.map(t => (
                      <tr key={t.id} className="hover:bg-base-700 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-text-primary font-medium truncate max-w-xs">{t.name}</p>
                          <p className="text-xs text-text-muted capitalize">{t.templateType?.replace('_', ' ')}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">{t.sends}</td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">{t.opens}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          <span className={t.openRate !== null ? (t.openRate >= 30 ? 'text-partner-light' : t.openRate >= 15 ? 'text-sold-light' : 'text-text-secondary') : 'text-text-muted'}>
                            {t.openRate !== null ? `${t.openRate}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {templatePerformance.standalone.length === 0 && templatePerformance.abGroups.length === 0 && (
            <p className="text-text-muted text-sm italic">No template data yet. Start sending emails with templates to see performance here.</p>
          )}
        </div>
      )}
    </div>
  );
};
