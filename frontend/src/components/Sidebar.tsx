import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FilePlus,
  ClipboardList,
  ShieldCheck,
  Brain,
  Database,
  Cpu,
  FileText,
  History,
  Settings,
  Sprout
} from 'lucide-react';
import { useRole } from '../context/RoleContext';

export const Sidebar: React.FC = () => {
  const { role, t } = useRole();

  // Role-scoped navigation items
  const farmerNavigation = [
    { key: 'nav.dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { key: 'nav.newClaim', name: 'Apply for Insurance', href: '/new-claim', icon: FilePlus },
    { key: 'nav.myClaims', name: 'My Claims', href: '/claims', icon: ClipboardList },
    { key: 'nav.assessment', name: 'AI Assessment', href: '/claims/assessment', icon: ShieldCheck },
    { key: 'nav.settings', name: 'Profile & Settings', href: '/settings', icon: Settings }
  ];

  const officerNavigation = [
    { key: 'nav.dashboard', name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { key: 'nav.newClaim', name: 'Submit New Claim', href: '/new-claim', icon: FilePlus },
    { key: 'nav.myClaims', name: 'Claims Management', href: '/claims', icon: ClipboardList },
    { key: 'nav.assessment', name: 'AI Assessment', href: '/claims/assessment', icon: ShieldCheck },
    { key: 'nav.explainability', name: 'Main Reasons (XAI)', href: '/explainability', icon: Brain },
    { key: 'nav.data', name: 'Claim Records (Data)', href: '/data', icon: Database },
    { key: 'nav.models', name: 'AI Performance', href: '/models', icon: Cpu },
    { key: 'nav.reports', name: 'Assessment Reports', href: '/reports', icon: FileText },
    { key: 'nav.audit', name: 'Audit History', href: '/audit', icon: History },
    { key: 'nav.settings', name: 'Settings', href: '/settings', icon: Settings }
  ];

  const currentNav = role === 'farmer' ? farmerNavigation : officerNavigation;

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800 bg-slate-950/40">
        <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
          <Sprout className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-tight">XAI-CropInsure</h1>
          <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
            {role === 'farmer' ? t('nav.roleFarmer') : t('nav.roleOfficer')} Portal
          </p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {currentNav.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            <span>{t(item.key) || item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-400 bg-slate-950/20">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-300">
            {role === 'farmer' ? t('Farmer AI Assistant') : 'Decision Support System'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {t('nav.decisionSupportNotice') || 'The AI assists claim evaluation. Authorized officers make legal decisions.'}
        </p>
      </div>
    </aside>
  );
};
