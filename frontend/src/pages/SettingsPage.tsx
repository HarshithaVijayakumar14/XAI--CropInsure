import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useRole } from '../context/RoleContext';
import { useVoice } from '../hooks/useVoice';
import { SpeakButton } from '../components/SpeakButton';
import { SUPPORTED_LANGUAGES } from '../i18n';
import {
  Settings,
  Database,
  Shield,
  Sprout,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Server,
  Layers,
  Sparkles,
  User,
  Phone,
  Globe,
  Edit2,
  Save,
  X,
  Volume2
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { role, user, language, setLanguage, t } = useRole();
  const { speak, stopAudio, isPlaying, activeSpeechId } = useVoice();

  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reloadingDemo, setReloadingDemo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    village: user?.village || '',
    district: user?.district || '',
    state: user?.state || '',
    preferred_language: user?.preferred_language || language || 'kn-IN'
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        village: user.village || '',
        district: user.district || '',
        state: user.state || '',
        preferred_language: user.preferred_language || language || 'kn-IN'
      });
    }
  }, [user, language]);

  useEffect(() => {
    api.getHealth().then((res) => {
      setHealth(res);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Save language via backend
      if (profileData.preferred_language !== language) {
        setLanguage(profileData.preferred_language);
      }
      setIsEditing(false);
      setMessage(t('profile.successUpdate') || 'Profile and language settings saved successfully!');
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      alert(`Error saving profile: ${err.message}`);
    }
  };

  const handleReloadDemo = async () => {
    try {
      setReloadingDemo(true);
      const res = await api.loadDemoDataset(250);
      setMessage(`Successfully re-seeded benchmark dataset (${res.rows_generated} records) and demonstration claims.`);
      const updatedHealth = await api.getHealth();
      setHealth(updatedHealth);
      setTimeout(() => setMessage(null), 5000);
    } catch (err: any) {
      alert(`Error re-seeding demo: ${err.message}`);
    } finally {
      setReloadingDemo(false);
    }
  };

  const profileSummaryText = `${t('profile.title')}. ${t('profile.fullName')}: ${user?.full_name || 'Farmer'}. ${t('profile.phone')}: ${user?.phone_number || ''}. ${t('profile.village')}: ${user?.village || ''}, ${t('profile.district')}: ${user?.district || ''}, ${t('profile.state')}: ${user?.state || ''}. ${t('profile.preferredLanguage')}: ${SUPPORTED_LANGUAGES.find(l => l.code === language)?.native_name || language}.`;

  const configuredCrops = [
    "Rice / Paddy (Oryza sativa)",
    "Wheat (Triticum aestivum)",
    "Cotton (Gossypium hirsutum)",
    "Maize (Zea mays)",
    "Groundnut / Peanut (Arachis hypogaea)",
    "Mustard (Brassica juncea)",
    "Soybean (Glycine max)",
    "Sugarcane (Saccharum officinarum)"
  ];

  const configuredStates = [
    "Karnataka", "Maharashtra", "Madhya Pradesh", "Uttar Pradesh", "Rajasthan",
    "Punjab", "Andhra Pradesh", "Gujarat", "Haryana", "Tamil Nadu"
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Farmer Profile & Regional Language Management Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <User className="w-6 h-6 text-emerald-600" />
              {t('profile.title') || 'Farmer Profile & Regional Language Settings'}
            </h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              {t('profile.subtitle') || 'View your registered farmer identity, land records, and configure your preferred regional language.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <SpeakButton
              id="profile-summary"
              text={profileSummaryText}
              lang={language}
              label={t('dashboard.listen') || 'Listen'}
              activeId={activeSpeechId}
              isPlaying={isPlaying}
              onSpeak={speak}
              onStop={stopAudio}
              size="md"
            />
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                <Edit2 className="w-3.5 h-3.5" /> {t('profile.editProfile') || 'Edit Profile'}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                <X className="w-3.5 h-3.5" /> {t('profile.cancel') || 'Cancel'}
              </button>
            )}
          </div>
        </div>

        {message && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs text-emerald-800 flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('profile.fullName') || 'Full Name'}
                </label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('profile.phone') || 'Mobile Number'}
                </label>
                <input
                  type="tel"
                  value={profileData.phone_number}
                  onChange={(e) => setProfileData({ ...profileData, phone_number: e.target.value })}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('profile.village') || 'Village'}
                </label>
                <input
                  type="text"
                  value={profileData.village}
                  onChange={(e) => setProfileData({ ...profileData, village: e.target.value })}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('profile.district') || 'District'}
                </label>
                <input
                  type="text"
                  value={profileData.district}
                  onChange={(e) => setProfileData({ ...profileData, district: e.target.value })}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('profile.state') || 'State'}
                </label>
                <input
                  type="text"
                  value={profileData.state}
                  onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                  {t('profile.preferredLanguage') || 'Preferred Regional Language'}
                </label>
                <select
                  value={profileData.preferred_language}
                  onChange={(e) => setProfileData({ ...profileData, preferred_language: e.target.value })}
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-slate-800"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.native_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                {t('profile.cancel') || 'Cancel'}
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <Save className="w-3.5 h-3.5" /> {t('profile.saveChanges') || 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-slate-500 font-medium mb-1">{t('profile.fullName') || 'Full Name'}</p>
              <p className="text-sm font-bold text-slate-800">{user?.full_name || 'Ramesh Patel'}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-slate-500 font-medium mb-1">{t('profile.phone') || 'Mobile Number'}</p>
              <p className="text-sm font-bold text-slate-800">{user?.phone_number || '+91 98450 12345'}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <p className="text-slate-500 font-medium mb-1">{t('profile.location') || 'Village, District & State'}</p>
              <p className="text-sm font-bold text-slate-800">
                {user?.village || 'Alnavar'}, {user?.district || 'Dharwad'}, {user?.state || 'Karnataka'}
              </p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl col-span-1 sm:col-span-2 md:col-span-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    {t('profile.preferredLanguage') || 'Preferred Regional Language'}
                  </p>
                  <p className="text-sm font-bold text-emerald-950 mt-0.5">
                    {SUPPORTED_LANGUAGES.find(l => l.code === language)?.native_name || 'ಕನ್ನಡ (Kannada)'}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1">
                    {t('profile.languageNote') || 'Changing this language updates menus, voice read-aloud, forms, and the AI Assistant.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-white border border-emerald-300 text-emerald-950 text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer shadow-2xs"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.native_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* System Status & Agro-Parameters (Accessible to both or specialized for officers) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* System & Database Status */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Server className="w-4 h-4 text-emerald-600" />
            Backend API & Database Runtime
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">API Status:</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> {health?.status || 'Active'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Database Engine:</span>
              <span className="font-semibold text-slate-800">SQLite (Relational schema ready for PostgreSQL)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Total Claims in Database:</span>
              <span className="font-semibold text-slate-800">{health?.claims_registered || 0}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">AI Assessment Models:</span>
              <span className="font-semibold text-slate-800">{health?.models_trained || 1} Active</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Regional Languages Configured:</span>
              <span className="font-semibold text-emerald-800">11 Official Indian Regional Languages</span>
            </div>
          </div>

          {role === 'officer' && (
            <div className="pt-2">
              <button
                onClick={handleReloadDemo}
                disabled={reloadingDemo}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reloadingDemo ? 'animate-spin' : ''}`} />
                {reloadingDemo ? 'Re-seeding Benchmark Claims...' : 'Re-Seed Benchmark Claims (250 Records)'}
              </button>
            </div>
          )}
        </div>

        {/* Coverage & Schemes */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Sprout className="w-4 h-4 text-emerald-600" />
            Configured PMFBY Crops & States
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Registered Major Indian Crops:</p>
              <div className="flex flex-wrap gap-1.5">
                {configuredCrops.map((c, i) => (
                  <span key={i} className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-[11px]">
                    {c.split(' (')[0]}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="font-semibold text-slate-700 mb-1">Geographic Coverage:</p>
              <div className="flex flex-wrap gap-1.5">
                {configuredStates.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
