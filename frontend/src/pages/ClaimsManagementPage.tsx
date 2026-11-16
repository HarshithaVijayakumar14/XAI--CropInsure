import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Claim } from '../types';
import { useRole } from '../context/RoleContext';
import { useVoice } from '../hooks/useVoice';
import { SpeakButton } from '../components/SpeakButton';
import { translateShapText, translateFarmerParagraph } from '../i18n/shapTranslations';
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
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpDown,
  X,
  Activity,
  TrendingDown,
  TrendingUp,
  UserCheck,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Check,
  RotateCcw,
  Info
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
  'Rejected': 'bg-rose-100 text-rose-800 border-rose-300',
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
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleViewDetails = async (c: any) => {
    try {
      setLoadingDetail(true);
      const fullClaim = await api.getClaim(c.id);
      setSelectedClaim(fullClaim);
    } catch {
      setSelectedClaim(c);
    } finally {
      setLoadingDetail(false);
    }
  };

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
                          onClick={() => handleViewDetails(claim)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                          title="View Complete Claim Assessment Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t('claims.viewDetails') || 'View Details'}
                        </button>
                        {role === 'officer' && (
                          <>
                            <button
                              onClick={() => navigate(`/claims/${claim.id}/assessment`)}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer inline-flex items-center gap-1"
                              title="Adjudicate Claim in Officer Workspace"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                              Review
                            </button>
                            <button
                              onClick={() => handleDelete(claim.id, ref)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Delete Claim"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
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

      {/* Claim Detail & 5-Stage Assessment Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col my-auto">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-emerald-300">
                      {selectedClaim.claim_reference}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-200">
                      {selectedClaim.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {selectedClaim.crop_type} ({selectedClaim.cultivated_area} Ha) • {selectedClaim.village ? `${selectedClaim.village}, ` : ''}{selectedClaim.district}, {selectedClaim.state}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SpeakButton
                  id={`modal-claim-${selectedClaim.id}`}
                  text={`Claim reference ${selectedClaim.claim_reference}. Insured crop: ${selectedClaim.crop_type}, ${selectedClaim.cultivated_area} hectares in ${selectedClaim.district}, ${selectedClaim.state}. AI Assessment: ${selectedClaim.ai_assessment?.predicted_eligibility || selectedClaim.ai_prediction?.predicted_eligibility || 'Evaluated'}. Final Officer Decision: ${selectedClaim.officer_decision?.decision || 'Awaiting Officer Decision'}. Current stage: ${selectedClaim.workflow_stage || selectedClaim.status}.`}
                  lang={language}
                  label="Listen"
                  activeId={activeSpeechId}
                  isPlaying={isPlaying}
                  onSpeak={speak}
                  onStop={stopAudio}
                  size="sm"
                />
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* 1. 5-Stage Progress Tracker */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    5-Stage Claim Progress Tracker
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                    Stage: {selectedClaim.workflow_stage || selectedClaim.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
                  {(selectedClaim.timeline_stages || [
                    { stage_number: 1, key: 'submitted', title: 'Claim Submitted', status: 'completed', date: selectedClaim.created_at?.slice(0, 10), description: 'Claim registration received' },
                    { stage_number: 2, key: 'ai_assessed', title: 'AI Assessment', status: 'completed', date: selectedClaim.created_at?.slice(0, 10), description: 'AI preliminary loss evaluation' },
                    { stage_number: 3, key: 'officer_review', title: 'Officer Review', status: selectedClaim.officer_decision?.is_decided ? 'completed' : 'in_progress', date: selectedClaim.officer_decision?.decision_date?.slice(0, 10) || 'In Progress', description: 'Assessor inspection & review' },
                    { stage_number: 4, key: 'verification', title: 'Verification', status: selectedClaim.status === 'Additional evidence required' ? 'in_progress' : (selectedClaim.officer_decision?.is_decided ? 'completed' : 'pending'), date: selectedClaim.officer_decision?.is_decided ? 'Verified' : 'Pending', description: 'Field CCE or loss evidence' },
                    { stage_number: 5, key: 'final_decision', title: 'Final Decision', status: selectedClaim.officer_decision?.is_decided ? 'completed' : 'pending', date: selectedClaim.officer_decision?.decision_date?.slice(0, 10) || 'Pending', description: selectedClaim.officer_decision?.decision || 'Awaiting officer sign-off' }
                  ]).map((stg: any) => {
                    const isDone = stg.status === 'completed';
                    const isCurrent = stg.status === 'in_progress';
                    return (
                      <div
                        key={stg.stage_number}
                        className={`p-3 rounded-xl border transition ${
                          isDone
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                            : isCurrent
                            ? 'bg-blue-50 border-blue-400 text-blue-950 ring-2 ring-blue-300'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                              isDone
                                ? 'bg-emerald-600 text-white'
                                : isCurrent
                                ? 'bg-blue-600 text-white animate-pulse'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isDone ? '✓' : stg.stage_number}
                          </span>
                          <span className="text-[11px] font-bold truncate">{stg.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 line-clamp-1">{stg.description}</p>
                        <span className="text-[9px] font-mono text-slate-400 block mt-1">{stg.date}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Distinct Sections A & B */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* SECTION A: AI-Predicted Result */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Section A • AI-Predicted Result
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedClaim.ai_assessment?.assessed_at?.slice(0, 16) || selectedClaim.created_at?.slice(0, 16)}
                    </span>
                  </div>

                  {/* AI Eligibility Badge */}
                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1">{translateShapText("Predicted Claim Eligibility", language)}</span>
                    {selectedClaim.ai_assessment?.predicted_eligibility === 'Likely Eligible for Insurance Claim' || selectedClaim.ai_prediction?.predicted_eligibility === 'Likely Eligible for Insurance Claim' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-emerald-600 text-white shadow-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        {translateShapText("Likely Eligible for Insurance Claim", language)}
                      </span>
                    ) : selectedClaim.ai_assessment?.predicted_eligibility === 'Likely Not Eligible for Insurance Claim' || selectedClaim.ai_prediction?.predicted_eligibility === 'Likely Not Eligible for Insurance Claim' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-slate-800 text-slate-100 shadow-xs">
                        <XCircle className="w-4 h-4 text-slate-400" />
                        {translateShapText("Likely Not Eligible for Insurance Claim", language)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase bg-amber-500 text-slate-950 shadow-xs">
                        <AlertCircle className="w-4 h-4" />
                        {translateShapText("Insufficient Information to Predict", language)}
                      </span>
                    )}
                  </div>

                  {/* Predicted vs Reference Yield */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">{translateShapText("Predicted Yield", language)}</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {selectedClaim.ai_assessment?.predicted_yield_display || (selectedClaim.expected_yield ? `${selectedClaim.expected_yield} T/Ha` : '2.45 T/Ha')}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">{translateShapText("Historical Baseline", language)}</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {selectedClaim.ai_assessment?.reference_yield_display || '3.20 T/Ha'}
                      </span>
                    </div>
                  </div>

                  {/* Supporting Factors from SHAP */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                      <TrendingDown className="w-3.5 h-3.5 text-emerald-600" /> {translateShapText("Factors Supporting Claim:", language)}
                    </span>
                    {(selectedClaim.ai_assessment?.reasons_supporting || ['Deficit in seasonal precipitation corroborates yield shortfall']).map((r: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{translateShapText(r, language)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mitigating/Opposing Factors */}
                  {selectedClaim.ai_assessment?.reasons_against && selectedClaim.ai_assessment.reasons_against.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-sky-600" /> {translateShapText("Opposing Factors:", language)}
                      </span>
                      {selectedClaim.ai_assessment.reasons_against.map((r: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-600 text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                          <span>{translateShapText(r, language)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION B: Final Officer Decision */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      Section B • Final Officer Decision
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {selectedClaim.officer_decision?.decision_date ? selectedClaim.officer_decision.decision_date.slice(0, 16) : 'Pending'}
                    </span>
                  </div>

                  {selectedClaim.officer_decision?.is_decided ? (
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Official Decision</span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase shadow-xs ${
                            selectedClaim.officer_decision.decision === 'Approved'
                              ? 'bg-emerald-600 text-white'
                              : selectedClaim.officer_decision.decision === 'Rejected'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {selectedClaim.officer_decision.decision === 'Approved' ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {selectedClaim.officer_decision.decision}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Verified Crop Loss</span>
                          <span className="font-bold text-slate-800 text-sm">
                            {selectedClaim.officer_decision.verified_crop_loss_display || (selectedClaim.verified_crop_loss ? `${selectedClaim.verified_crop_loss}%` : `${selectedClaim.reported_loss_pct || 50}%`)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                          <span className="text-[10px] text-slate-400 block">Verified Yield</span>
                          <span className="font-bold text-slate-800 text-sm">
                            {selectedClaim.officer_decision.verified_crop_yield_display || (selectedClaim.observed_yield ? `${selectedClaim.observed_yield} T/Ha` : 'Not recorded')}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                        <div className="font-bold text-slate-900">
                          Assessor: {selectedClaim.officer_decision.officer_name} ({selectedClaim.officer_decision.officer_role})
                        </div>
                        <p className="text-slate-600 leading-relaxed">
                          <strong>Remarks:</strong> {selectedClaim.officer_decision.officer_remarks || selectedClaim.officer_notes || 'Ground survey verification completed.'}
                        </p>
                        {selectedClaim.officer_decision.reason_for_decision && (
                          <p className="text-[11px] text-slate-500">
                            <strong>Reason:</strong> {selectedClaim.officer_decision.reason_for_decision}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Not yet decided */
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <Clock className="w-4 h-4 text-amber-700 animate-pulse" />
                        Awaiting Officer Decision
                      </div>
                      <p className="text-amber-950 leading-relaxed">
                        Your claim is currently under review by the designated insurance officer. The final decision will be updated here once the officer completes the statutory loss verification.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. SECTION C: Predicted vs Actual Comparison */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Section C • Predicted vs Actual Comparison
                  </h4>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    selectedClaim.comparison?.agreement_status === 'Concurred' || (!selectedClaim.officer_decision?.differs_from_model && selectedClaim.officer_decision?.is_decided)
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedClaim.officer_decision?.differs_from_model
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {selectedClaim.comparison?.agreement_status || (selectedClaim.officer_decision?.differs_from_model ? 'Officer Manual Override' : 'Evaluation Synchronized')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* AI Prediction Side */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">{translateShapText("AI Model Forecast", language)}</span>
                    <div className="font-extrabold text-slate-800">
                      {translateShapText(selectedClaim.comparison?.ai_predicted_eligibility || selectedClaim.ai_assessment?.predicted_eligibility || 'Likely Eligible', language)}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Yield: {selectedClaim.comparison?.ai_predicted_yield_display || selectedClaim.ai_assessment?.predicted_yield_display || '2.45 T/Ha'}
                    </div>
                    <p className="text-[11px] text-slate-500 italic">
                      Main Factor: {translateShapText(selectedClaim.comparison?.ai_main_reason || selectedClaim.ai_assessment?.reasons_supporting?.[0] || 'Statistical pattern match', language)}
                    </p>
                  </div>

                  {/* Officer Decision Side */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Officer Final Adjudication</span>
                    <div className="font-extrabold text-slate-800">
                      {selectedClaim.comparison?.officer_final_decision || selectedClaim.officer_decision?.decision || 'Awaiting Officer Review'}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Verified Loss / Yield: {selectedClaim.comparison?.officer_verified_yield_display || selectedClaim.officer_decision?.verified_crop_loss_display || 'Field verification in progress'}
                    </div>
                    <p className="text-[11px] text-slate-500 italic">
                      Assessor Rationale: {selectedClaim.comparison?.officer_reason || selectedClaim.officer_decision?.officer_remarks || 'Pending final assessor sign-off'}
                    </p>
                  </div>
                </div>

                {/* Explanation Banner */}
                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 leading-relaxed flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="block text-blue-900 font-bold mb-0.5">Comparison Explanation:</strong>
                    <span>
                      {selectedClaim.comparison?.comparison_insight || (
                        selectedClaim.officer_decision?.differs_from_model
                          ? 'The authorized officer recorded a manual override based on local field crop-cutting experiments (CCE) or ground patwari reports that differed from regional statistical weather forecasts.'
                          : 'The officer concurred with the AI preliminary indication following standard PMFBY documentary and weather anomaly verification.'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {role === 'officer' ? (
                <button
                  type="button"
                  onClick={() => navigate(`/claims/${selectedClaim.id}/assessment`)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Open in Officer Assessment Workspace
                </button>
              ) : (
                <span className="text-xs text-slate-500">
                  Official Record under PMFBY Scheme
                </span>
              )}

              <button
                type="button"
                onClick={() => setSelectedClaim(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
