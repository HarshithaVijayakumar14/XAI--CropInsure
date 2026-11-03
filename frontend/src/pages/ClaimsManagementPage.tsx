import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Claim } from '../types';
import { useRole } from '../context/RoleContext';
import { useVoice } from '../hooks/useVoice';
import { SpeakButton } from '../components/SpeakButton';
import {
  Search,
  Filter,
  FilePlus,
  ShieldCheck,
  Download,
  Trash2,
  AlertCircle,
  Eye,
  CheckCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  'Draft': 'bg-slate-100 text-slate-700 border-slate-200',
  'Submitted': 'bg-blue-50 text-blue-700 border-blue-200',
  'Ready for assessment': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Model assessed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Awaiting human review': 'bg-amber-50 text-amber-700 border-amber-200',
  'Additional evidence required': 'bg-rose-50 text-rose-700 border-rose-200',
  'Human review completed': 'bg-green-100 text-green-800 border-green-300',
  'Approved': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Under Assessment': 'bg-amber-50 text-amber-800 border-amber-200'
};

export const ClaimsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { role, language, t, user } = useRole();
  const { speak, stopAudio, isPlaying, activeSpeechId } = useVoice();

  const [claims, setClaims] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const fetchClaims = async () => {
    try {
      setLoading(true);
      setError(null);
      if (role === 'farmer') {
        const farmerClaims = await api.farmer.getMyClaims();
        let filtered: any[] = farmerClaims;
        if (search.trim()) {
          const q = search.toLowerCase();
          filtered = filtered.filter((c: any) => 
            c.claim_reference.toLowerCase().includes(q) ||
            c.crop_type.toLowerCase().includes(q) ||
            c.status.toLowerCase().includes(q)
          );
        }
        if (statusFilter) {
          filtered = filtered.filter((c: any) => c.status === statusFilter);
        }
        if (cropFilter) {
          filtered = filtered.filter((c: any) => c.crop_type === cropFilter);
        }
        setClaims(filtered);
        setTotal(filtered.length);
      } else {
        const res = await api.getClaims({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          crop_type: cropFilter || undefined,
          state: stateFilter || undefined,
          limit: 100
        });
        setClaims(res.items);
        setTotal(res.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch claims');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [role, statusFilter, cropFilter, stateFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClaims();
  };

  const handleDelete = async (id: number, ref: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete claim ${ref}? This will be recorded in the audit log.`)) {
      return;
    }
    try {
      await api.deleteClaim(id);
      fetchClaims();
    } catch (err: any) {
      alert(`Error deleting claim: ${err.message}`);
    }
  };

  const claimsSummaryAudio = role === 'farmer'
    ? `${t('claims.title')}. ${total} ${t('claims.claimsFound') || 'claims registered'}. ${claims.map(c => `${c.crop_name || c.crop_type}: ${t(c.status)}`).join('. ')}`
    : `Total of ${total} claims in review portfolio.`;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">
            {role === 'farmer' ? (t('claims.title') || 'My Crop Insurance Claims') : (t('claims.officerClaimsTitle') || 'Insurance Claims Management & Portfolio')}
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            {role === 'farmer'
              ? (t('claims.subtitle') || 'Track all claims submitted under your farmer account.')
              : 'View, search, filter, and review insured farmer claims with transparent AI decision support.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <SpeakButton
            id="claims-summary-audio"
            text={claimsSummaryAudio}
            lang={language}
            label={t('dashboard.listen') || 'Listen'}
            activeId={activeSpeechId}
            isPlaying={isPlaying}
            onSpeak={speak}
            onStop={stopAudio}
            size="md"
          />
          <button
            onClick={() => navigate('/new-claim')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
          >
            <FilePlus className="w-4 h-4" /> {t('nav.newClaim') || 'Apply for Insurance'}
          </button>
        </div>
      </div>

      {/* Decision Support Banner */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 leading-relaxed font-medium">
          <strong>{t('Important Decision Support Notice') || 'Important Decision Support Notice:'}</strong>{' '}
          {t('nav.decisionSupportNotice') || 'The AI assists claim evaluation. Authorized officers make legal decisions.'}
        </div>
      </div>

      {/* Search & Filters Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('claims.searchPlaceholder') || 'Search by claim reference or crop...'}
              className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition w-full md:w-auto"
          >
            {t('Search') || 'Search'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>{t('Filter') || 'Filters'}:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-slate-50 font-medium text-slate-700 focus:outline-none"
          >
            <option value="">{t('claims.filterStatus') || 'All Statuses'}</option>
            <option value="Submitted">{t('Submitted') || 'Submitted'}</option>
            <option value="Under Assessment">{t('Claim Under Assessment') || 'Under Assessment'}</option>
            <option value="Approved">{t('Approved') || 'Approved'}</option>
            <option value="Awaiting human review">{t('Awaiting human review') || 'Awaiting human review'}</option>
            <option value="Additional evidence required">{t('Additional evidence required') || 'Additional evidence required'}</option>
          </select>

          <select
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-slate-50 font-medium text-slate-700 focus:outline-none"
          >
            <option value="">{t('claims.filterCrop') || 'All Crops'}</option>
            <option value="Rice/Paddy">Rice/Paddy</option>
            <option value="Wheat">Wheat</option>
            <option value="Cotton">Cotton</option>
            <option value="Maize">Maize</option>
            <option value="Soybean">Soybean</option>
          </select>

          {(statusFilter || cropFilter || search) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setCropFilter('');
                setSearch('');
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
            >
              Clear Filters
            </button>
          )}

          <span className="ml-auto text-xs font-semibold text-slate-500">
            {total} {t('claims registered') || 'records found'}
          </span>
        </div>

        {loading ? (
          <div className="h-48 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading claims list...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">{t('claims.noClaims') || 'No claims match the selected criteria.'}</p>
            <button
              onClick={() => navigate('/new-claim')}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition"
            >
              {t('nav.newClaim') || 'Apply for Insurance'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{t('claims.claimRef') || 'Claim Ref'}</th>
                  <th className="py-3 px-4">{t('claims.crop') || 'Crop'}</th>
                  <th className="py-3 px-4">{t('Village / District') || 'Village / District'}</th>
                  <th className="py-3 px-4">{t('claims.loss') || 'Loss (%)'}</th>
                  <th className="py-3 px-4">{t('claims.status') || 'Status'}</th>
                  <th className="py-3 px-4 text-right">{t('claims.actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => {
                  const ref = claim.claim_reference || `CLM-${claim.id}`;
                  const cropName = claim.crop_name || claim.crop_type;
                  const statusStyle = STATUS_COLORS[claim.status] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <tr key={claim.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {ref}
                        {claim.is_demo_record && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-800 rounded font-sans font-bold">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {t(cropName) || cropName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {claim.village ? `${claim.village}, ` : ''}{claim.district || claim.state}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {claim.reported_loss_pct || claim.crop_loss_percentage || 0}%
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusStyle}`}>
                          {t(claim.status) || claim.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => navigate('/')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
                          title="View on Dashboard"
                        >
                          {t('claims.viewDetails') || 'View Details'}
                        </button>
                        {role === 'officer' && (
                          <button
                            onClick={() => handleDelete(claim.id, ref)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            title="Delete Claim"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
