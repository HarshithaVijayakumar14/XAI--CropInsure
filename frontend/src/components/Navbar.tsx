import React, { useState } from 'react';
import { api } from '../api/client';
import { Sparkles, RefreshCw, CheckCircle2, Globe, Users, ChevronDown } from 'lucide-react';
import { useRole } from '../context/RoleContext';
import { SUPPORTED_LANGUAGES } from '../i18n';

interface NavbarProps {
  pageTitle: string;
  onDemoLoaded?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ pageTitle, onDemoLoaded }) => {
  const { role, setRole, user, language, setLanguage, switchDemoUser, demoUsers, t } = useRole();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  const handleQuickDemoLoad = async () => {
    try {
      setLoadingDemo(true);
      const res = await api.loadDemoDataset(150);
      setDemoMessage(`Loaded ${res.rows_generated} records & ${res.demo_claims_created} demo claims.`);
      if (onDemoLoaded) onDemoLoaded();
      setTimeout(() => setDemoMessage(null), 4000);
    } catch (err: any) {
      alert(`Error loading demo data: ${err.message}`);
    } finally {
      setLoadingDemo(false);
    }
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0 shadow-sm gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-base md:text-lg font-bold text-slate-800 tracking-tight truncate">
          {t(pageTitle) || pageTitle}
        </h2>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Sarvam AI Regional Language Selector */}
        <div className="relative flex items-center bg-emerald-50/80 border border-emerald-300 rounded-xl px-2.5 py-1 text-xs shadow-2xs hover:border-emerald-500 transition">
          <Globe className="w-3.5 h-3.5 text-emerald-700 mr-1.5 shrink-0" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-emerald-950 font-bold focus:outline-none cursor-pointer pr-1"
            title="Select Regional Language (Sarvam AI Integration)"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.native_name}
              </option>
            ))}
          </select>
        </div>

        {/* Demo Persona Switcher (For seamless testing of data scoping) */}
        <div className="relative hidden sm:flex items-center bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs shadow-2xs">
          <Users className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
          <select
            value={user?.username || (role === 'farmer' ? 'farmer_ramesh' : 'officer_verma')}
            onChange={(e) => switchDemoUser(e.target.value)}
            className="bg-transparent text-slate-800 font-medium focus:outline-none cursor-pointer"
            title="Switch Authenticated Persona to verify farmer data isolation"
          >
            <optgroup label="Farmers (Individual Scoped Data)">
              <option value="farmer_ramesh">👨‍🌾 Ramesh Patel (Dharwad, Karnataka)</option>
              <option value="farmer_sunita">👩‍🌾 Sunita Devi (Barabanki, UP)</option>
            </optgroup>
            <optgroup label="Assessor (Overall Portfolio Statistics)">
              <option value="officer_verma">🛡️ R. K. Verma (Claims Assessor)</option>
            </optgroup>
          </select>
        </div>

        {/* Role Switcher Pill */}
        <div className="bg-slate-100 p-0.5 rounded-xl border border-slate-200 flex items-center">
          <button
            onClick={() => setRole('farmer')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              role === 'farmer'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Switch to Simple Farmer Dashboard"
          >
            <span>👨‍🌾</span>
            <span className="hidden sm:inline">{t('nav.roleFarmer') || 'Farmer'}</span>
          </button>
          <button
            onClick={() => setRole('officer')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              role === 'officer'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Switch to Insurance Officer Review Dashboard"
          >
            <span>🛡️</span>
            <span className="hidden sm:inline">{t('nav.roleOfficer') || 'Officer'}</span>
          </button>
        </div>

        {demoMessage && (
          <div className="hidden lg:flex items-center gap-1.5 text-xs bg-agri-50 text-agri-700 px-3 py-1 rounded-full border border-agri-200 animate-fade-in font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-agri-600" />
            <span>{demoMessage}</span>
          </div>
        )}

        <button
          onClick={handleQuickDemoLoad}
          disabled={loadingDemo}
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-agri-800 bg-agri-50 hover:bg-agri-100 border border-agri-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          title="Generates and imports 150 synthetic records and seeds claims"
        >
          {loadingDemo ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-agri-600" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-agri-600" />
          )}
          <span>Seed Data</span>
        </button>

        {/* User Identity Indicator */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
            role === 'farmer' ? 'bg-agri-100 text-agri-800 border-agri-300' : 'bg-slate-100 text-slate-800 border-slate-300'
          }`}>
            {role === 'farmer' ? '🌾' : '🏛️'}
          </div>
          <div className="hidden md:block text-left text-xs">
            <p className="font-semibold text-slate-800 truncate max-w-[120px]">
              {user?.full_name || (role === 'farmer' ? 'Ramesh Patel' : 'R. K. Verma')}
            </p>
            <p className="text-[10px] text-slate-500">
              {role === 'farmer' ? 'Verified Farmer' : 'Authorised Officer'}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
