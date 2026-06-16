import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import api from '@api/axios';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Network, Building2, Users, Maximize, Minus, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function OrgChart() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Transform state for pan/zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Side Panel state
  const [selectedNode, setSelectedNode] = useState(null);

  useEffect(() => {
    const company = currentCompanyId
      ? companies.find(c => c.id === currentCompanyId)
      : companies[0];
    if (company) { 
      setSelectedCompany(company); 
      loadDepartments(company.id); 
    } else {
      setLoading(false);
    }
  }, [currentCompanyId, companies]);

  const loadDepartments = async (companyId) => {
    setLoading(true);
    setSelectedNode(null);
    setTransform({ x: 0, y: 0, scale: 1 }); // reset view
    try {
      const { data } = await api.get('/departments', { params: { company_id: companyId } });
      const depts = Array.isArray(data) ? data : (data.data || []);
      
      // Load job titles for each department
      for (const dept of depts) {
        try {
          const jtRes = await api.get('/job-titles', { params: { department_id: dept.id, company_id: companyId } });
          dept.jobTitles = Array.isArray(jtRes.data) ? jtRes.data : (jtRes.data.data || []);
        } catch { dept.jobTitles = []; }
      }
      setDepartments(depts);
    } catch { toast.error('Failed to load org structure'); }
    finally { setLoading(false); }
  };

  // Pan & Zoom Handlers
  const handleWheel = (e) => {
    e.preventDefault();
    const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(p => ({ ...p, scale: Math.min(Math.max(p.scale * scaleAdjust, 0.3), 3) }));
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('.org-node')) return; // Don't drag if clicking a node
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setTransform(p => ({ ...p, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
  };

  const handleMouseUp = () => setIsDragging(false);

  // Keyboard controls
  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });
  const zoomIn = () => setTransform(p => ({ ...p, scale: Math.min(p.scale * 1.2, 3) }));
  const zoomOut = () => setTransform(p => ({ ...p, scale: Math.max(p.scale * 0.8, 0.3) }));

  // Tree Node Component
  const TreeNode = ({ title, subtitle, count, color, onClick, isRoot }) => (
    <div 
      className="org-node cursor-pointer group flex flex-col items-center mx-2 my-4 relative"
      onClick={onClick}
    >
      <div 
        className="w-48 bg-white border-2 rounded-xl p-3 shadow-md transition-transform group-hover:scale-105 group-hover:shadow-lg relative z-10"
        style={{ borderColor: color || '#e2e8f0' }}
      >
        <div className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: color || '#94a3b8' }}>
          {isRoot ? <Building2 size={16} /> : <Users size={16} />}
        </div>
        <h3 className="font-bold text-surface-800 text-sm leading-tight mb-1">{title}</h3>
        <p className="text-xs text-surface-500">{subtitle}</p>
        {count !== undefined && (
          <div className="mt-3 flex justify-between items-center pt-2 border-t border-surface-100">
            <span className="text-[10px] font-medium text-surface-400">{t('org_chart.roles')}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>{count}</span>
          </div>
        )}
      </div>
      {/* CSS connecting lines are handled by the container */}
    </div>
  );

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col animate-fade-in">
      <style dangerouslySetInnerHTML={{__html: `
        .org-tree ul { padding-top: 20px; position: relative; transition: all 0.5s; display: flex; justify-content: center; }
        .org-tree li { float: left; text-align: center; list-style-type: none; position: relative; padding: 20px 5px 0 5px; transition: all 0.5s; }
        .org-tree li::before, .org-tree li::after { content: ''; position: absolute; top: 0; right: 50%; border-top: 2px solid #cbd5e1; width: 50%; height: 20px; }
        .org-tree li::after { right: auto; left: 50%; border-left: 2px solid #cbd5e1; }
        .org-tree li:only-child::after, .org-tree li:only-child::before { display: none; }
        .org-tree li:only-child { padding-top: 0; }
        .org-tree li:first-child::before, .org-tree li:last-child::after { border: 0 none; }
        .org-tree li:last-child::before { border-right: 2px solid #cbd5e1; border-radius: 0 5px 0 0; }
        .org-tree li:first-child::after { border-radius: 5px 0 0 0; }
        .org-tree ul ul::before { content: ''; position: absolute; top: 0; left: 50%; border-left: 2px solid #cbd5e1; width: 0; height: 20px; }
      `}} />

      <div className="flex items-center justify-between mb-4 shrink-0">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('org_chart.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('org_chart.subtitle')}</p></div>
        
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-surface-50 p-1 rounded-xl">
            {companies.map(c => (
              <button key={c.id} onClick={() => { setSelectedCompany(c); loadDepartments(c.id); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${selectedCompany?.id === c.id ? 'text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100'}`}
                style={selectedCompany?.id === c.id ? { backgroundColor: c.color_primary || '#6D28D9' } : {}}>
                <Building2 size={13} /> {c.short_code}
              </button>
            ))}
          </div>
          
          <div className="flex gap-1 bg-surface-50 p-1 rounded-xl">
            <button onClick={zoomOut} className="p-2 text-surface-600 hover:bg-surface-200 rounded-lg"><Minus size={16} /></button>
            <button onClick={resetView} className="p-2 text-surface-600 hover:bg-surface-200 rounded-lg"><Maximize size={16} /></button>
            <button onClick={zoomIn} className="p-2 text-surface-600 hover:bg-surface-200 rounded-lg"><Plus size={16} /></button>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="!p-6 flex-1 flex items-center justify-center animate-pulse"><div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></Card>
      ) : !selectedCompany || departments.length === 0 ? (
        <Card className="flex-1"><EmptyState icon={<Network className="w-8 h-8 text-surface-400" />} title={t('org_chart.no_structure')} description={t('org_chart.no_structure_desc')} /></Card>
      ) : (
        <div className="flex-1 flex gap-4 overflow-hidden relative">
          
          {/* Main Chart Area */}
          <Card className="flex-1 !p-0 overflow-hidden relative bg-slate-50 cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            ref={containerRef}
          >
            <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-30"></div>
            
            <div 
              className="absolute top-1/2 left-1/2 org-tree"
              style={{ transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`, transformOrigin: 'center', transition: isDragging ? 'none' : 'transform 0.1s' }}
            >
              <ul>
                <li>
                  <TreeNode 
                    isRoot
                    title={selectedCompany.name} 
                    subtitle={`${departments.length} Departments`} 
                    color={selectedCompany.color_primary || '#6D28D9'}
                    onClick={() => setSelectedNode({ type: 'company', data: selectedCompany })}
                  />
                  {departments.length > 0 && (
                    <ul>
                      {departments.map(dept => (
                        <li key={dept.id}>
                          <TreeNode 
                            title={dept.name}
                            subtitle={dept.jobTitles?.length ? t('org_chart.roles_defined', { count: dept.jobTitles.length }) : t('org_chart.no_roles_defined')}
                            count={dept.jobTitles?.length || 0}
                            color={selectedCompany.color_primary || '#0ea5e9'}
                            onClick={() => setSelectedNode({ type: 'department', data: dept, company: selectedCompany })}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              </ul>
            </div>
            
            <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg text-xs font-medium text-surface-500 shadow-sm border border-surface-200">
              {t('org_chart.instructions')}
            </div>
          </Card>

          {/* Details Side Panel */}
          {selectedNode && (
            <Card className="w-80 shrink-0 !p-0 flex flex-col h-full animate-slide-in-right border-l-4" style={{ borderLeftColor: selectedCompany.color_primary || '#6D28D9' }}>
              <div className="p-4 border-b border-surface-100 flex justify-between items-center bg-surface-50">
                <h3 className="font-bold text-surface-800 flex items-center gap-2">
                  {selectedNode.type === 'company' ? <Building2 size={16} className="text-brand-600"/> : <Network size={16} className="text-brand-600"/>}
                  {selectedNode.type === 'company' ? t('org_chart.company_details') : t('org_chart.department_details')}
                </h3>
                <button onClick={() => setSelectedNode(null)} className="text-surface-400 hover:text-surface-700 bg-white rounded-full p-1 shadow-sm">✕</button>
              </div>
              
              <div className="p-5 flex-1 overflow-y-auto">
                {selectedNode.type === 'company' ? (
                  <div className="space-y-4">
                    <div className="text-center pb-4 border-b border-surface-100">
                      <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold shadow-md" style={{ backgroundColor: selectedCompany.color_primary || '#6D28D9' }}>
                        {selectedCompany.short_code}
                      </div>
                      <h2 className="text-lg font-bold text-surface-900">{selectedCompany.name}</h2>
                      <p className="text-sm text-surface-500">{t('org_chart.departments_configured', { count: departments.length })}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-surface-400 uppercase mb-2 tracking-wider">{t('org_chart.departments_overview')}</h4>
                      <ul className="space-y-2">
                        {departments.map(d => (
                          <li key={d.id} className="flex justify-between items-center p-2 bg-surface-50 rounded-lg">
                            <span className="text-sm font-medium text-surface-700">{d.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{d.jobTitles?.length || 0} roles</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="pb-4 border-b border-surface-100">
                      <Badge style={{ backgroundColor: `${selectedCompany.color_primary}20`, color: selectedCompany.color_primary }} className="mb-2">
                        {selectedCompany.short_code}
                      </Badge>
                      <h2 className="text-xl font-bold text-surface-900 leading-tight">{selectedNode.data.name}</h2>
                      <p className="text-sm text-surface-500 mt-1">{t('org_chart.roles_defined', { count: selectedNode.data.jobTitles?.length || 0 })}</p>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-bold text-surface-400 uppercase mb-3 tracking-wider flex items-center gap-1"><Users size={12}/> {t('org_chart.job_roles')}</h4>
                      {selectedNode.data.jobTitles && selectedNode.data.jobTitles.length > 0 ? (
                        <div className="space-y-3">
                          {selectedNode.data.jobTitles.map(jt => (
                            <div key={jt.id} className="p-3 bg-white border border-surface-200 rounded-xl hover:border-brand-300 transition-colors shadow-sm">
                              <h5 className="font-bold text-surface-800 text-sm">{jt.title}</h5>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-surface-500 bg-surface-100 px-2 py-1 rounded">{jt.seniority_level || 'Standard'}</span>
                                {jt.salary_min && jt.salary_max && (
                                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                    {Number(jt.salary_min).toLocaleString()} - {Number(jt.salary_max).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center p-4 bg-surface-50 rounded-xl border border-surface-100 text-surface-400 text-sm">
                          {t('org_chart.no_roles_defined_desc')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
