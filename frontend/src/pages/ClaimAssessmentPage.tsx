import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Claim, ClaimAssessment, TrainedModel, HumanReview, AuditEvent } from '../types';
import {
  ShieldCheck,
  Brain,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  UserCheck,
  Sparkles,
  ArrowLeft,
  Calendar,
  CloudRain,
  Activity,
  History,
  RotateCcw,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';

export const ClaimAssessmentPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [claim, setClaim] = useState<Claim | null>(null);
  const [assessment, setAssessment] = useState<ClaimAssessment | null>(null);
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(undefined);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [reviews, setReviews] = useState<HumanReview[]>([]);

  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Human Review Form State
  const [reviewerName, setReviewerName] = useState('Senior Assessor R. K. Verma');
  const [reviewerRole, setReviewerRole] = useState('Claim Assessor');
  const [reviewDecision, setReviewDecision] = useState('Approved');
  const [differsFromModel, setDiffersFromModel] = useState(false);
  const [rationale, setRationale] = useState('');
  const [requiredEvidence, setRequiredEvidence] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // Claim selector for when id is not in URL
  const [allClaims, setAllClaims] = useState<Claim[]>([]);

  const fetchClaimData = async (targetId: number) => {
    try {
      setLoading(true);
      setError(null);
      const [claimRes, modelsRes, auditRes, reviewsRes] = await Promise.all([
        api.getClaim(targetId),
        api.getModels(),
        api.getClaimAudit(targetId),
        api.getClaimReviews(targetId)
      ]);

      setClaim(claimRes);
      setModels(modelsRes);
      setAuditEvents(auditRes);
      setReviews(reviewsRes);

      // Try fetching existing assessment
      try {
        const assessRes = await api.getAssessment(targetId);
        setAssessment(assessRes);
      } catch {
        setAssessment(null);
      }

      // Default selected model to active model
      const active = modelsRes.find((m) => m.is_active);
      if (active) setSelectedModelId(active.id);
      else if (modelsRes.length > 0) setSelectedModelId(modelsRes[0].id);

    } catch (err: any) {
      setError(err.message || 'Failed to load claim');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchClaimData(parseInt(id, 10));
    } else {
      // Load all claims so user can pick
      api.getClaims({ limit: 50 }).then((res) => {
        setAllClaims(res.items);
        if (res.items.length > 0) {
          fetchClaimData(res.items[0].id);
        } else {
          setLoading(false);
        }
      });
    }
  }, [id]);

  const handleRunAssessment = async () => {
    if (!claim) return;
    try {
      setAssessing(true);
      setError(null);
      const res = await api.runAssessment(claim.id, selectedModelId);
      setAssessment(res);

      // Refresh claim and audit
      const [updatedClaim, updatedAudit] = await Promise.all([
        api.getClaim(claim.id),
        api.getClaimAudit(claim.id)
      ]);
      setClaim(updatedClaim);
      setAuditEvents(updatedAudit);
    } catch (err: any) {
      setError(err.message || 'Model assessment failed');
    } finally {
      setAssessing(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim) return;
    if (!rationale.trim()) {
      alert("Please enter a rationale explaining your review decision.");
      return;
    }

    try {
      setSubmittingReview(true);
      await api.recordReview(claim.id, {
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        review_decision: reviewDecision,
        differs_from_model: differsFromModel,
        rationale: rationale,
        required_evidence: requiredEvidence || undefined
      });

      setReviewSuccess(true);
      // Refresh claim, audit, and reviews
      const [updatedClaim, updatedAudit, updatedReviews] = await Promise.all([
        api.getClaim(claim.id),
        api.getClaimAudit(claim.id),
        api.getClaimReviews(claim.id)
      ]);
      setClaim(updatedClaim);
      setAuditEvents(updatedAudit);
      setReviews(updatedReviews);

      setTimeout(() => setReviewSuccess(false), 5000);
    } catch (err: any) {
      alert(`Failed to record review: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3">
        <div className="w-10 h-10 border-4 border-agri-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading claim assessment workspace...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
        <h3 className="font-bold text-slate-800 text-base">No Claim Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Please register a claim or select one from the Claims Management directory to initiate an Explainable AI assessment.
        </p>
        <button
          onClick={() => navigate('/claims')}
          className="px-4 py-2 bg-agri-600 text-white text-xs font-semibold rounded-lg hover:bg-agri-700 transition"
        >
          Go to Claims Management
        </button>
      </div>
    );
  }

  const rainDeficit = claim.reference_rainfall - claim.observed_rainfall;
  const relDeficit = claim.reference_rainfall > 0 ? (rainDeficit / claim.reference_rainfall) * 100 : 0;
  const ndviChange = claim.current_ndvi - claim.reference_ndvi;
  const tempAnomaly = claim.observed_temperature - claim.reference_temperature;
  const dataQualityFlags: string[] = JSON.parse(claim.data_quality_flags || '[]');

  // Prepare SHAP chart data
  const shapChartData = assessment
    ? assessment.shap_contributions.map((c) => ({
        name: c.feature_name_display,
        shap_value: c.shap_value,
        direction: c.direction,
        observed: c.observed_value
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Top Decision Support Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Important Decision Support Notice:</strong> The AI helps assess your claim. It does not make the final insurance decision. An authorized insurance officer reviews the evidence and makes the final decision.
        </div>
      </div>

      {/* Top Claim Selector & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/claims')}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
            title="Back to Claims List"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold text-slate-800">{claim.claim_reference}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {claim.status}
              </span>
              {claim.is_demo_record && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                  DEMO RECORD
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Farmer: <strong className="text-slate-700">{claim.farmer_name}</strong> • Policy: {claim.policy_reference} • {claim.district}, {claim.state}
            </p>
          </div>
        </div>

        {/* Claim Selector Switcher */}
        {allClaims.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Select Claim:</span>
            <select
              value={claim.id}
              onChange={(e) => fetchClaimData(parseInt(e.target.value, 10))}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
            >
              {allClaims.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.claim_reference} - {c.farmer_name} ({c.crop_type})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Environmental & Agronomic Evidence Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Rainfall Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Rainfall Deficit</span>
            <CloudRain className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {rainDeficit.toFixed(1)} <span className="text-xs font-normal text-slate-500">mm</span>
          </p>
          <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-100">
            <span>Obs: {claim.observed_rainfall}mm</span>
            <span>Ref: {claim.reference_rainfall}mm</span>
          </div>
        </div>

        {/* NDVI Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>NDVI Vigor Change</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <p className={`text-2xl font-bold ${ndviChange < -0.1 ? 'text-rose-600' : 'text-slate-800'}`}>
            {ndviChange > 0 ? `+${ndviChange.toFixed(3)}` : ndviChange.toFixed(3)}
          </p>
          <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-100">
            <span>Cur: {claim.current_ndvi.toFixed(2)}</span>
            <span>Ref: {claim.reference_ndvi.toFixed(2)}</span>
          </div>
        </div>

        {/* Temperature Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Temp Anomaly</span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {tempAnomaly > 0 ? `+${tempAnomaly.toFixed(1)}` : tempAnomaly.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span>
          </p>
          <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-100">
            <span>Obs: {claim.observed_temperature}°C</span>
            <span>Ref: {claim.reference_temperature}°C</span>
          </div>
        </div>

        {/* Agronomic Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Agronomic Profile</span>
            <Info className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-800 truncate">{claim.crop_type} ({claim.season})</p>
          <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-slate-100">
            <span>Area: {claim.cultivated_area} ha</span>
            <span>Soil: {claim.soil_type || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Data Quality Warning Alert */}
      {dataQualityFlags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Data Quality & Evidence Notices Detected:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-amber-800">
            {dataQualityFlags.map((flag, idx) => (
              <li key={idx}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Model Assessment Control & Status */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Brain className="w-4 h-4 text-agri-600" />
              AI Decision Support Engine
            </h3>
            <p className="text-xs text-slate-500">
              Evaluate agro-environmental records and calculate the main factors influencing the AI assessment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {models.length > 0 ? (
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(parseInt(e.target.value, 10))}
                className="text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.model_name} ({m.model_version}) {m.is_active ? '★ Active' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-red-600 font-medium">No trained model available</span>
            )}

            <button
              onClick={handleRunAssessment}
              disabled={assessing || models.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-agri-600 hover:bg-agri-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {assessing ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" /> Assessing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {assessment ? 'Re-run AI Assessment' : 'Run AI Assessment'}
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Assessment Results View */}
        {assessment ? (
          <div className="space-y-6 pt-2">
            {/* Prediction Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">AI Assessment</span>
                <div className="flex items-center gap-2">
                  <p className={`text-xl font-bold ${assessment.prediction_label === 'Approved' ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {assessment.prediction_label || 'Evaluated'}
                  </p>
                  {assessment.prediction_probability !== undefined && (
                    <span className="text-xs font-mono bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-600" title="How Certain Is the AI?">
                      {(assessment.prediction_probability * 100).toFixed(1)}% certainty
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">How Certain Is the AI: {(assessment.prediction_probability !== undefined ? (assessment.prediction_probability * 100).toFixed(1) + '%' : 'N/A')}</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Payout Estimation Benchmark</span>
                <p className="text-xl font-bold text-slate-800">
                  {assessment.payout_estimate !== null && assessment.payout_estimate !== undefined
                    ? `₹${assessment.payout_estimate.toLocaleString('en-IN')}`
                    : 'N/A (Classification Only)'}
                </p>
                <p className="text-[10px] text-slate-400">Statistical benchmark if regression model configured.</p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
                <span className="text-xs text-slate-500 font-medium">Base Reference Output E[f(x)]</span>
                <p className="text-xl font-bold text-slate-800">
                  {assessment.base_value !== null && assessment.base_value !== undefined ? assessment.base_value.toFixed(4) : '0.0000'}
                </p>
                <p className="text-[10px] text-slate-400">Dataset prior baseline prior to feature contributions.</p>
              </div>
            </div>

            {/* Local SHAP Waterfall Breakdown Chart */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">How Each Factor Influenced the Result (Main Reasons)</h4>
                  <p className="text-[11px] text-slate-500">
                    How each agricultural factor shifted the AI assessment toward approval (green +) or rejection (red -)
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rounded-sm" /> Supports Claim (+)
                  </span>
                  <span className="flex items-center gap-1 text-rose-700">
                    <span className="w-2.5 h-2.5 bg-rose-600 rounded-sm" /> Opposes Claim (-)
                  </span>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={shapChartData}
                    margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val > 0 ? '+' : ''}${val.toFixed(4)} (Observed: ${item.payload.observed})`,
                        'Influence on Decision'
                      ]}
                    />
                    <ReferenceLine x={0} stroke="#475569" strokeWidth={1} />
                    <Bar dataKey="shap_value" radius={[2, 2, 2, 2]}>
                      {shapChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.shap_value >= 0 ? '#16a34a' : '#dc2626'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Feature Contribution Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Agricultural Factor</th>
                    <th className="py-2.5 px-3">Observed Value</th>
                    <th className="py-2.5 px-3">Influence (SHAP)</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Plain Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assessment.shap_contributions.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-medium text-slate-800">{c.feature_name_display}</td>
                      <td className="py-2 px-3 text-slate-600 font-mono">{String(c.observed_value)}</td>
                      <td className="py-2 px-3 font-mono font-bold">
                        <span className={c.shap_value >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {c.shap_value >= 0 ? `+${c.shap_value.toFixed(4)}` : c.shap_value.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.direction === 'positive'
                            ? 'bg-emerald-50 text-emerald-700'
                            : c.direction === 'negative'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {c.direction === 'positive' ? 'SUPPORTS' : c.direction === 'negative' ? 'OPPOSES' : 'NEUTRAL'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[11px] max-w-xs">{c.interpretation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Farmer-Friendly Explanation Card */}
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <h4 className="text-sm font-bold text-emerald-950">Why Was This Claim Given This Result? (Plain Explanation)</h4>
              </div>
              <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white/80 p-4 rounded-lg border border-emerald-100 shadow-2xs font-sans">
                {assessment.farmer_friendly_summary}
              </div>
            </div>

            {/* Download Report Actions */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-slate-800">Claim Assessment Documentation</p>
                <p className="text-[11px] text-slate-500">
                  Generate print-ready official PDF report containing evidence tables, SHAP attributions, and assessor signature block.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={api.getExportCsvUrl(claim.id)}
                  download
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-white transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </a>
                <a
                  href={api.getReportPdfUrl(claim.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF Report
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center space-y-2">
            <Brain className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Click "Run Model Assessment" above to generate genuine SHAP explanations.</p>
          </div>
        )}
      </div>

      {/* Authorized Human Review & Decision Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Authorized Human Assessor Review
            </h3>
            <p className="text-xs text-slate-500">
              Record official human judgment. Human review decisions remain distinct from statistical model predictions.
            </p>
          </div>
          {reviewSuccess && (
            <div className="flex items-center gap-1 text-xs text-agri-700 bg-agri-50 px-3 py-1.5 rounded-full border border-agri-200 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Review recorded and logged to audit trail.</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assessor Name</label>
              <input
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Assessor Role</label>
              <select
                value={reviewerRole}
                onChange={(e) => setReviewerRole(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Claim Assessor">Claim Assessor</option>
                <option value="Agricultural Officer">Agricultural Officer</option>
                <option value="System Administrator">System Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Official Decision</label>
              <select
                value={reviewDecision}
                onChange={(e) => setReviewDecision(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-800"
              >
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Additional Evidence Required">Additional Evidence Required</option>
                <option value="Escalated">Escalated to District Committee</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="differs"
              checked={differsFromModel}
              onChange={(e) => setDiffersFromModel(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <label htmlFor="differs" className="text-xs font-medium text-slate-700 cursor-pointer">
              Decision differs from the ML model's pattern match (Mandatory explanation required in rationale)
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Assessor Rationale & Field Verification Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Ground crop cutting experiment (CCE) data verifies severe yield loss in this village panchayat, corroborating satellite vegetation stress."
              required
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {reviewDecision === 'Additional Evidence Required' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Additional Evidence Needed</label>
              <input
                type="text"
                value={requiredEvidence}
                onChange={(e) => setRequiredEvidence(e.target.value)}
                placeholder="e.g. Request block-level automatic weather station (AWS) hourly log and local revenue patwari report."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingReview}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {submittingReview ? 'Recording...' : 'Submit Official Review Decision'}
            </button>
          </div>
        </form>

        {/* Existing Reviews on this claim */}
        {reviews.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <h4 className="text-xs font-bold text-slate-700">Previous Review Actions:</h4>
            <div className="space-y-2">
              {reviews.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-800">{r.reviewer_name} ({r.reviewer_role})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {r.review_decision}
                    </span>
                  </div>
                  <p className="text-slate-600">{r.rationale}</p>
                  <p className="text-[10px] text-slate-400">{new Date(r.reviewed_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Claim Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <History className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-bold text-slate-800">Claim Chronological Audit Trail</h3>
        </div>
        <div className="space-y-2.5">
          {auditEvents.map((ev) => (
            <div key={ev.id} className="text-xs border-l-2 border-slate-300 pl-3 py-1 space-y-0.5">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>{ev.event_type}</span>
                <span className="text-[10px] font-normal text-slate-400">{new Date(ev.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-slate-600">{ev.details}</p>
              <p className="text-[10px] text-slate-400">Actor: {ev.actor}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
