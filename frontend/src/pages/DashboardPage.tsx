import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  FarmerClaimSummary,
  FarmerClaimDetails,
  TimelineResponse,
  DamageInfoResponse,
  FarmerExplanationResponse,
  ChatMessageResponse,
  RegionalLanguage
} from '../types';
import { useRole } from '../context/RoleContext';
import { useVoice } from '../hooks/useVoice';
import { SpeakButton } from '../components/SpeakButton';
import { SUPPORTED_LANGUAGES } from '../i18n';
import {
  Sprout,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Phone,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  RefreshCw,
  User,
  MapPin,
  Calendar,
  Layers,
  FilePlus,
  Info,
  Building2,
  Volume2,
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Globe,
  Check,
  X,
  AlertTriangle,
  SlidersHorizontal,
  Square
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { role, user, language, setLanguage, t, switchDemoUser } = useRole();
  const {
    isPlaying,
    activeSpeechId,
    isRecording,
    recordingId,
    voiceNotice,
    speak,
    stopAudio,
    startRecording,
    stopRecording
  } = useVoice();

  // Farmer scoped states
  const [farmerClaims, setFarmerClaims] = useState<FarmerClaimSummary[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<number | null>(null);
  const [claimDetails, setClaimDetails] = useState<FarmerClaimDetails | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [damageInfo, setDamageInfo] = useState<DamageInfoResponse | null>(null);
  const [explanation, setExplanation] = useState<FarmerExplanationResponse | null>(null);

  // Officer overall states
  const [officerSummary, setOfficerSummary] = useState<any | null>(null);
  const [officerClaims, setOfficerClaims] = useState<any[]>([]);
  const [officerFilter, setOfficerFilter] = useState<'all' | 'waiting' | 'approved' | 'attention'>('all');
  const [reviewingClaim, setReviewingClaim] = useState<any | null>(null);
  const [reviewDecision, setReviewDecision] = useState('Approved');
  const [reviewRationale, setReviewRationale] = useState('');
  const [verifiedLossPct, setVerifiedLossPct] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // AI Assistant states
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: t("Welcome to CropInsure!") + " " + (t("assistant.subtitle") || "Ask me anything about your claim progress, required documents, or assessment reasons.")
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([
    "What is happening with my claim?",
    "Why is my claim being checked?",
    "Which documents do I need to submit?",
    "What should I do next?"
  ]);

  // UI loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Load Farmer or Officer data whenever role, user, or selected claim changes
  useEffect(() => {
    loadDashboardData();
  }, [role, user?.username]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (role === 'farmer') {
        const myClaims = await api.farmer.getMyClaims();
        setFarmerClaims(myClaims);

        if (myClaims.length > 0) {
          const defaultClaim = myClaims[0];
          setSelectedClaimId(defaultClaim.id);
          await loadClaimDetails(defaultClaim.id);
        } else {
          setClaimDetails(null);
          setTimeline(null);
          setDamageInfo(null);
          setExplanation(null);
        }
      } else {
        const [sumRes, claimsRes] = await Promise.all([
          api.officer.getSummary(),
          api.officer.getClaims('all')
        ]);
        setOfficerSummary(sumRes);
        setOfficerClaims(claimsRes);
      }
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      setError(err.message || 'Unable to load claims information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadClaimDetails = async (claimId: number) => {
    try {
      const [detailsRes, timelineRes, damageRes, expRes] = await Promise.all([
        api.farmer.getMyClaimDetails(claimId),
        api.farmer.getTimeline(claimId),
        api.farmer.getDamageInfo(claimId),
        api.farmer.getExplanation(claimId)
      ]);
      setClaimDetails(detailsRes);
      setTimeline(timelineRes);
      setDamageInfo(damageRes);
      setExplanation(expRes);

      // Translate initial suggested questions into current language if regional
      if (language && language !== 'en-IN') {
        api.regional.translateBatch([
          "What is happening with my claim?",
          "Why is my claim being checked?",
          "Which documents do I need to submit?",
          "What should I do next?"
        ], language).then(res => {
          if (res.translations && res.translations.length === 4) {
            setSuggestedQuestions(res.translations);
          }
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error("Failed to fetch detailed claim record:", err);
    }
  };

  const handleSelectClaim = async (claimId: number) => {
    setSelectedClaimId(claimId);
    stopAudio();
    await loadClaimDetails(claimId);
  };

  // Farmer AI Assistant send message
  const handleSendChat = async (messageText?: string) => {
    const textToSend = messageText || inputMessage;
    if (!textToSend.trim() || sendingChat) return;

    const newChatHistory = [...chatMessages, { role: 'user' as const, content: textToSend }];
    setChatMessages(newChatHistory);
    setInputMessage('');
    setSendingChat(true);

    try {
      const res: ChatMessageResponse = await api.farmer.chatAssistant(
        selectedClaimId || 1,
        textToSend,
        language || 'kn-IN'
      );

      const updatedHistory = [...newChatHistory, { role: 'assistant' as const, content: res.content }];
      setChatMessages(updatedHistory);

      // Speak assistant response automatically or make button ready
      speak(res.content, language, `assistant-msg-${updatedHistory.length - 1}`);
    } catch (err: any) {
      setChatMessages([
        ...newChatHistory,
        {
          role: 'assistant',
          content: "Sorry, I could not check your claim records right now. Please try again or contact your insurance officer."
        }
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  // Officer review submit
  const handleRecordOfficerReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingClaim) return;
    try {
      setSubmittingReview(true);
      await api.officer.recordReview(reviewingClaim.id, {
        decision: reviewDecision,
        rationale: reviewRationale,
        verified_crop_loss: verifiedLossPct ? parseFloat(verifiedLossPct) : undefined
      });
      const [sumRes, claimsRes] = await Promise.all([
        api.officer.getSummary(),
        api.officer.getClaims(officerFilter)
      ]);
      setOfficerSummary(sumRes);
      setOfficerClaims(claimsRes);
      setReviewingClaim(null);
      setReviewRationale('');
      setVerifiedLossPct('');
    } catch (err: any) {
      alert(`Failed to record review: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Overall page speech text
  const getPageSummaryText = (): string => {
    if (!claimDetails) {
      return `${t("Welcome to CropInsure!")}. ${t("No Claim Submitted Yet")}.`;
    }
    const cropStr = t(claimDetails.crop_name) || claimDetails.crop_name;
    const statusStr = t(claimDetails.status) || claimDetails.status;
    const stageStr = timeline ? t(timeline.current_stage) : '';
    const nextAct = timeline ? timeline.next_expected_action : '';
    return `${t("Welcome to CropInsure!")}. ${t("My Crop Details")}: ${claimDetails.farmer_name}, ${cropStr}, ${claimDetails.land_area_acres} Acres, ${claimDetails.village}, ${claimDetails.district}. ${t("Current Status")}: ${statusStr}. ${t("YOUR CLAIM PROGRESS")}: ${stageStr}. ${t("What Should I Do Next?")}: ${nextAct}.`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[440px] space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-base font-semibold text-slate-700">Loading your claims portal...</p>
        <p className="text-xs text-slate-400">Verifying authorized records from database...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 my-8">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-rose-900">Unable to Load Portal</h3>
        <p className="text-sm text-rose-700">{error}</p>
        <button
          onClick={loadDashboardData}
          className="px-5 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* =========================================================================
          VIEW A: FARMER DASHBOARD — STRICTLY INDIVIDUAL SCOPED INFORMATION
         ========================================================================= */}
      {role === 'farmer' && (
        <div className="space-y-6">
          {/* 1. Welcome Section & Read This Page Button */}
          <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md relative overflow-hidden">
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  Pradhan Mantri Fasal Bima Yojana (PMFBY)
                </span>
                <span className="text-xs text-emerald-200 bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-400/30">
                  👨‍🌾 {user?.full_name || 'Ramesh Patel'} ({user?.village || 'Dharwad'}, {user?.district || 'Karnataka'})
                </span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                    {t("Welcome to CropInsure!")}
                  </h1>
                  <p className="text-emerald-100 text-sm md:text-base max-w-2xl leading-relaxed mt-1">
                    {t("Understand your crop insurance and track your claim easily.")}
                  </p>
                </div>

                {/* Read Entire Page Aloud Button */}
                <div className="shrink-0">
                  <SpeakButton
                    id="dashboard-whole-page"
                    text={getPageSummaryText()}
                    lang={language}
                    label={t("dashboard.readThisPage") || "Read This Page Aloud"}
                    activeId={activeSpeechId}
                    isPlaying={isPlaying}
                    onSpeak={speak}
                    onStop={stopAudio}
                    size="lg"
                    className="bg-white text-emerald-900 border-white hover:bg-emerald-50 font-bold"
                  />
                </div>
              </div>

              {/* Multi-Claim Application Switcher */}
              {farmerClaims.length > 1 && (
                <div className="mt-4 pt-4 border-t border-white/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-300" />
                    {t("dashboard.selectApplication") || "Select Claim / Crop Application:"}
                  </span>
                  <select
                    value={selectedClaimId || ''}
                    onChange={(e) => handleSelectClaim(Number(e.target.value))}
                    className="bg-white text-slate-800 font-bold px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none w-full sm:w-auto shadow-sm cursor-pointer"
                  >
                    {farmerClaims.map((c) => (
                      <option key={c.id} value={c.id}>
                        {t(c.crop_type) || c.crop_type} ({c.season}) — Ref: {c.claim_reference}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {voiceNotice && (
            <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 text-xs">
              {voiceNotice}
            </div>
          )}

          {claimDetails ? (
            <>
              {/* Prominent Active Application Reference Banner */}
              <div className="bg-slate-50 border border-slate-300 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Currently Viewing Claim:</span>
                  <span className="font-mono text-sm font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300 shadow-2xs">
                    {claimDetails.claim_application_number}
                  </span>
                  <span className="font-bold text-slate-800">({t(claimDetails.crop_name) || claimDetails.crop_name})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t("Current Status")}:</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {t(claimDetails.status) || claimDetails.status}
                  </span>
                </div>
              </div>

              {/* 2. My Crop and Insurance Details Card */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <Sprout className="w-5 h-5 text-emerald-600" /> {t("My Crop Details")}
                    </h2>
                    <SpeakButton
                      id="crop-details-audio"
                      text={`${t("My Crop Details")}. ${t("Farmer's Name")}: ${claimDetails.farmer_name}. ${t("Crop Name")}: ${t(claimDetails.crop_name) || claimDetails.crop_name}. ${t("Village / District")}: ${claimDetails.village}, ${claimDetails.district}. ${t("Insured Land Area")}: ${claimDetails.land_area_acres} Acres.`}
                      lang={language}
                      activeId={activeSpeechId}
                      isPlaying={isPlaying}
                      onSpeak={speak}
                      onStop={stopAudio}
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Policy: {claimDetails.policy_number}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">{t("Farmer's Name")}</span>
                    <span className="font-bold text-slate-800 text-sm">{claimDetails.farmer_name}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">{t("Crop Name")}</span>
                    <span className="font-bold text-slate-800 text-sm">{t(claimDetails.crop_name) || claimDetails.crop_name}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">{t("Village / District")}</span>
                    <span className="font-bold text-slate-800 text-sm">{claimDetails.village}, {claimDetails.district}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">{t("Insured Land Area")}</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {claimDetails.land_area_hectares} ha ({claimDetails.land_area_acres} Acres)
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">Season / Year</span>
                    <span className="font-bold text-slate-800 text-sm">{claimDetails.season_year}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">{t("Date Submitted")}</span>
                    <span className="font-bold text-slate-800 text-sm">{claimDetails.date_of_application}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">{t("Reported Crop Damage")}</span>
                    <span className="font-bold text-rose-700 text-sm">{claimDetails.reported_crop_damage}</span>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-0.5">
                    <span className="text-slate-400 block font-medium">Payment Status</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {claimDetails.payment_status}
                      {claimDetails.payment_amount ? ` (₹${claimDetails.payment_amount.toLocaleString('en-IN')})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. My Claim Progress Timeline Tracker */}
              {timeline && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <Clock className="w-5 h-5 text-blue-600" /> {t("YOUR CLAIM PROGRESS")}
                        </h2>
                        <p className="text-xs text-slate-500">
                          Application Ref: <strong className="text-slate-700">{timeline.claim_reference}</strong> • Last update: {timeline.last_status_update}
                        </p>
                      </div>
                      <SpeakButton
                        id="timeline-audio"
                        text={`${t("YOUR CLAIM PROGRESS")}. Current stage: ${t(timeline.current_stage)}. ${t("Next Expected Action")}: ${timeline.next_expected_action}.`}
                        lang={language}
                        activeId={activeSpeechId}
                        isPlaying={isPlaying}
                        onSpeak={speak}
                        onStop={stopAudio}
                      />
                    </div>
                    {timeline.missing_documents.length > 0 && (
                      <span className="px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 rounded-full text-xs font-bold">
                        ⚠️ Action Required: Missing Document
                      </span>
                    )}
                  </div>

                  {/* Step Timeline */}
                  <div className="space-y-3 pt-2">
                    {timeline.stages.map((st, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${
                          st.status === 'completed'
                            ? 'bg-emerald-50/60 border-emerald-200 text-slate-800'
                            : st.status === 'in_progress'
                            ? 'bg-blue-50/80 border-blue-300 text-blue-950 ring-2 ring-blue-400/20 shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {st.status === 'completed' ? (
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                              ✓
                            </div>
                          ) : st.status === 'in_progress' ? (
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs animate-pulse">
                              ●
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 text-slate-300 flex items-center justify-center text-xs">
                              ○
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <span className="font-bold text-sm text-slate-800">
                              {t(st.title) || st.title}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              {st.status === 'completed' ? st.date : st.status === 'in_progress' ? 'In Progress' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">{st.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Missing documents callout if any */}
                  {timeline.missing_documents.length > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs space-y-1">
                      <div className="flex items-center gap-2 font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Missing Documents Needed to Finalise Review:</span>
                      </div>
                      <ul className="list-disc pl-5 text-amber-800 space-y-0.5">
                        {timeline.missing_documents.map((doc, idx) => (
                          <li key={idx} className="font-medium">{doc}</li>
                        ))}
                      </ul>
                      <p className="text-[11px] text-amber-700 pt-1">
                        Please upload these documents or submit a hardcopy to your nearest Taluka Agriculture Office or CSC center.
                      </p>
                    </div>
                  )}

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <strong>{t("Next Expected Action")}:</strong> {timeline.next_expected_action}
                  </div>
                </div>
              )}

              {/* 4. Information About My Crop Damage */}
              {damageInfo && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-600" /> {t("Information About My Crop Damage")}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Clear distinction between what you reported, external weather readings, AI estimates, and officer verification.
                      </p>
                    </div>
                    <SpeakButton
                      id="damage-info-audio"
                      text={`${t("Information About My Crop Damage")}. Farmer reported crop damage of ${damageInfo.farmer_reported.reported_loss_pct}. Weather station recorded rainfall deficit of ${damageInfo.external_sources.rainfall_deficit}. Officer verified crop loss: ${damageInfo.officer_verified.officer_verified_crop_loss}.`}
                      lang={language}
                      activeId={activeSpeechId}
                      isPlaying={isPlaying}
                      onSpeak={speak}
                      onStop={stopAudio}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* A. Reported by Farmer */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                        <span className="font-bold text-slate-800 text-sm">{t('damage.farmerReported') || '1. Reported by Farmer'}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">Self-Declaration</span>
                      </div>
                      <p><strong>{t('forms.cropType') || 'Crop Type'}:</strong> {t(damageInfo.farmer_reported.crop_type) || damageInfo.farmer_reported.crop_type}</p>
                      <p><strong>{t('Reported Damage') || 'Reported Damage'}:</strong> <span className="font-bold text-rose-700">{damageInfo.farmer_reported.reported_loss_pct}</span></p>
                      <p><strong>{t('Date of Loss') || 'Date of Loss'}:</strong> {damageInfo.farmer_reported.date_of_damage}</p>
                      <p className="text-slate-600"><strong>{t('Reported Reason') || 'Reported Reason'}:</strong> {damageInfo.farmer_reported.loss_cause_description}</p>
                    </div>

                    {/* B. External Weather Sources */}
                    <div className="bg-cyan-50/50 border border-cyan-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-cyan-200">
                        <span className="font-bold text-cyan-950 text-sm">{t('damage.weatherReadings') || '2. Weather & Rainfall Readings'}</span>
                        <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-medium">AWS / IMD Stations</span>
                      </div>
                      <p><strong>{t('forms.observedRainfall') || 'Observed Rainfall'}:</strong> {damageInfo.external_sources.observed_rainfall} ({t('forms.referenceRainfall') || 'Normal'}: {damageInfo.external_sources.normal_seasonal_rainfall})</p>
                      <p><strong>{t('Rainfall Deficit') || 'Rainfall Deficit'}:</strong> <span className="font-bold text-cyan-900">{damageInfo.external_sources.rainfall_deficit}</span></p>
                      <p><strong>{t('Observed Temperature') || 'Observed Temperature'}:</strong> {damageInfo.external_sources.observed_temperature} ({damageInfo.external_sources.temperature_anomaly})</p>
                      <p className="text-[11px] text-cyan-800 italic">Source: {damageInfo.external_sources.source_type}</p>
                    </div>

                    {/* C. AI Estimated Pattern Match */}
                    <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-amber-200">
                        <span className="font-bold text-amber-950 text-sm">{t('damage.aiPatternMatch') || '3. AI Pattern Match (Estimate)'}</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-medium">Decision Support</span>
                      </div>
                      <p><strong>{t('Satellite Greenness Change') || 'Satellite Greenness Change'}:</strong> {damageInfo.ai_estimated.satellite_ndvi_vegetation_drop}</p>
                      <p><strong>{t('AI Pattern Resemblance') || 'AI Pattern Resemblance'}:</strong> <span className="font-bold text-amber-900">{damageInfo.ai_estimated.ai_pattern_resemblance}</span></p>
                      <p><strong>{t('Certainty Score') || 'Certainty Score'}:</strong> {damageInfo.ai_estimated.ai_certainty}</p>
                      <p className="text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg">
                        <strong>Important:</strong> AI pattern matching provides decision support to assessors. It is not confirmed physical ground damage.
                      </p>
                    </div>

                    {/* D. Verified by Authorised Officer */}
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
                        <span className="font-bold text-emerald-950 text-sm">{t('damage.officerVerified') || '4. Officer Verification'}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">Authorised Assessor</span>
                      </div>
                      <p><strong>{t('Assessor Status') || 'Assessor Status'}:</strong> <span className="font-bold text-emerald-900">{damageInfo.officer_verified.status}</span></p>
                      <p><strong>{t('Verified Crop Loss') || 'Verified Crop Loss'}:</strong> <span className="font-bold text-emerald-900">{damageInfo.officer_verified.officer_verified_crop_loss}</span></p>
                      <p><strong>{t('Assigned Officer') || 'Assigned Officer'}:</strong> {damageInfo.officer_verified.officer_name}</p>
                      <p className="text-slate-600"><strong>{t('Observation') || 'Observation'}:</strong> {damageInfo.officer_verified.field_survey_notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Plain-Language Explainable AI (XAI) Reasons */}
              {explanation && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-emerald-600" /> {t("Why Was My Claim Assessed This Way?")}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Application Ref: <strong className="text-slate-700">{explanation.claim_reference}</strong> ({t(explanation.crop_type) || explanation.crop_type})
                      </p>
                    </div>
                    <SpeakButton
                      id="xai-explanation-audio"
                      text={`${t("Why Was My Claim Assessed This Way?")}. ${explanation.main_reasons.map(r => `${r.factor_name}: ${r.what_we_know}. ${r.why_it_matters}`).join('. ')}`}
                      lang={language}
                      activeId={activeSpeechId}
                      isPlaying={isPlaying}
                      onSpeak={speak}
                      onStop={stopAudio}
                    />
                  </div>

                  {/* Main Reasons Considered */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      {t("Main Reasons Considered for My Claim")}:
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {explanation.main_reasons.map((reason, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-800">{reason.factor_name}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              reason.influence === 'supports'
                                ? 'bg-emerald-100 text-emerald-800'
                                : reason.influence === 'requires_checking'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {reason.influence === 'supports' ? 'Supports Claim (+)' : reason.influence === 'requires_checking' ? 'Needs Checking (!)' : 'Neutral'}
                            </span>
                          </div>

                          <p><strong className="text-slate-600">What we know:</strong> {reason.what_we_know}</p>
                          <p><strong className="text-slate-600">Why it matters:</strong> {reason.why_it_matters}</p>
                          <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                            <strong>Verification Status:</strong> {reason.verification_status}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Visual Summary: How Different Factors Influenced This Claim */}
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-slate-800">
                      {t("How Different Factors Influenced This Claim")} ({explanation.claim_reference})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      This summary applies strictly to this specific application and does not represent other farmers' claims.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {explanation.visual_summary.map((item, idx) => (
                        <span
                          key={idx}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                            item.color === 'emerald'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.color === 'rose'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {item.factor}: {item.status}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Statutory Legal Disclaimer */}
                  <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-700">
                    <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Important Notice:</strong> {t(explanation.statutory_note) || explanation.statutory_note}
                    </p>
                  </div>
                </div>
              )}

              {/* 6. Farmer AI Assistant (Interactive Chat with Voice STT & TTS) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-emerald-600" /> {t("Farmer AI Assistant")}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Ask questions about your claim in your language ({SUPPORTED_LANGUAGES.find(l => l.code === language)?.native_name || 'English'}).
                    </p>
                  </div>
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium">
                    Integrated with Sarvam AI Voice & Language
                  </span>
                </div>

                {/* Suggested Questions Chips */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">
                    Suggested Questions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedQuestions.map((qText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(qText)}
                        disabled={sendingChat}
                        className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer text-left"
                      >
                        {qText}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat Message Window */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3 max-h-80 overflow-y-auto">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-br-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs'
                        }`}
                      >
                        <p>{msg.content}</p>
                        {msg.role === 'assistant' && (
                          <div className="mt-2 pt-1 border-t border-slate-100 flex items-center gap-2">
                            <SpeakButton
                              id={`assistant-reply-${idx}`}
                              text={msg.content}
                              lang={language}
                              label={t("dashboard.listen") || "Listen"}
                              activeId={activeSpeechId}
                              isPlaying={isPlaying}
                              onSpeak={speak}
                              onStop={stopAudio}
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {sendingChat && (
                    <div className="text-xs text-slate-400 italic">Thinking and checking your claim records...</div>
                  )}
                </div>

                {/* Input Bar with Microphone Voice Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (isRecording && recordingId === 'assistant_input') {
                        stopRecording();
                      } else {
                        startRecording(language, (transcript) => {
                          setInputMessage(transcript);
                        }, 'assistant_input');
                      }
                    }}
                    className={`px-3 py-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition shadow-xs cursor-pointer ${
                      isRecording && recordingId === 'assistant_input'
                        ? 'bg-rose-600 text-white border-rose-600 animate-pulse ring-2 ring-rose-400/40'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                    }`}
                    title={isRecording ? 'Stop recording' : 'Click to speak your question'}
                  >
                    {isRecording && recordingId === 'assistant_input' ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="hidden sm:inline">Speak</span>
                      </>
                    )}
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      isRecording && recordingId === 'assistant_input'
                        ? (t("assistant.listening") || "Listening... Speak your question now")
                        : (t("assistant.placeholder") || "Ask a question about your claim (or click mic to speak)...")
                    }
                    className="flex-1 text-xs px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !inputMessage.trim()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" /> {t("assistant.send") || "Send"}
                  </button>
                </form>
              </div>

              {/* 7. What Should I Do Next? */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <ArrowRight className="w-5 h-5 text-blue-600" /> {t("What Should I Do Next?")}
                  </h2>
                  <SpeakButton
                    id="next-steps-audio"
                    text={`${t("What Should I Do Next?")}. ${
                      timeline && timeline.missing_documents.length > 0
                        ? `Submit your pending documents (${timeline.missing_documents.join(', ')}) at your earliest to proceed.`
                        : claimDetails.status === 'Approved'
                        ? 'Your claim has been approved. Please verify your bank account details with your local cooperative or primary agricultural credit society.'
                        : 'Wait while your claim is being checked. You do not need to do anything right now.'
                    }`}
                    lang={language}
                    activeId={activeSpeechId}
                    isPlaying={isPlaying}
                    onSpeak={speak}
                    onStop={stopAudio}
                  />
                </div>
                <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl text-xs md:text-sm font-medium text-blue-950 space-y-2">
                  <p>
                    {timeline && timeline.missing_documents.length > 0
                      ? `Submit your pending documents (${timeline.missing_documents.join(', ')}) at your earliest to proceed.`
                      : claimDetails.status === 'Approved'
                      ? 'Your claim has been approved. Please verify your bank account details with your local cooperative or primary agricultural credit society.'
                      : 'Wait while your claim is being checked. You do not need to do anything right now.'}
                  </p>
                  <p className="text-xs text-blue-800 font-normal">
                    If you require help, contact your local Gram Sevak or call the Kisan Call Centre at 1800-180-1551.
                  </p>
                </div>
              </div>

              {/* 8. How Crop Insurance Works & FAQ */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-emerald-600" /> {t("How Crop Insurance Works")} (PMFBY Guide)
                  </h2>
                  <SpeakButton
                    id="faq-help-audio"
                    text={`${t("How Crop Insurance Works")}. Kisan Call Centre toll-free 1800-180-1551. PMFBY Helpline 14447.`}
                    lang={language}
                    activeId={activeSpeechId}
                    isPlaying={isPlaying}
                    onSpeak={speak}
                    onStop={stopAudio}
                  />
                </div>

                <div className="space-y-3">
                  {[
                    {
                      q: "1. When can a farmer apply for crop insurance?",
                      a: "Farmers can enroll through banks, Primary Agricultural Credit Societies (PACS), Common Service Centres (CSCs), or the national PMFBY portal before the seasonal cut-off dates (usually July 31 for Kharif and December 31 for Rabi)."
                    },
                    {
                      q: "2. How is crop damage assessed?",
                      a: "Assessments combine automated weather station rainfall data, remote-sensing satellite indices (NDVI vegetation health), and physical Crop Cutting Experiments (CCEs) or ground surveys conducted by state agricultural officers."
                    },
                    {
                      q: "3. What does Explainable AI (XAI) do in this system?",
                      a: "The AI system analyzes weather patterns, rainfall anomalies, and satellite greenness to highlight which factors support or contradict a claim. It provides transparency so you understand the reasons behind every assessment."
                    },
                    {
                      q: "4. Who makes the legal decision on my insurance claim?",
                      a: "The AI model does not make legally binding insurance approvals or rejections. The final decision is always recorded by an authorized human insurance assessor or government district committee."
                    }
                  ].map((faq, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-2xl overflow-hidden">
                      <button
                        onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                        className="w-full text-left p-4 font-bold text-xs md:text-sm text-slate-800 bg-slate-50 hover:bg-slate-100 transition flex items-center justify-between"
                      >
                        <span>{faq.q}</span>
                        {activeFaq === idx ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />}
                      </button>
                      {activeFaq === idx && (
                        <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Government Helplines */}
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-950 font-medium">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {t("dashboard.kisanCallCentre") || "Kisan Call Centre (Toll-Free): 1800-180-1551"} • {t("dashboard.pmfbyHelpline") || "PMFBY Helpline: 14447"}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                    Govt. of India
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-4">
              <Sprout className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">{t("No Claim Submitted Yet")}</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You do not have any registered claims under this profile. You can apply for crop insurance right now.
              </p>
              <button
                onClick={() => navigate('/new-claim')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
              >
                {t("nav.newClaim") || "Apply for Insurance"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW B: INSURANCE OFFICER DASHBOARD — OVERALL CLAIM STATISTICS & AUDIT
         ========================================================================= */}
      {role === 'officer' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Authorised Assessor Workspace
                </span>
                <span className="text-xs text-slate-400">
                  Officer: <strong>{user?.full_name || 'R. K. Verma'}</strong> (Regional Headquarters)
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Overall Claim Statistics & Portfolio Oversight
              </h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-2xl">
                Aggregated claims intelligence across registered districts, crops, and automated explainable AI benchmarks.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={loadDashboardData}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Statistics
              </button>
            </div>
          </div>

          {officerSummary && (
            <>
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Total Claims</span>
                  <span className="text-2xl font-black text-slate-900">{officerSummary.total_claims}</span>
                  <span className="text-[10px] text-slate-400 block">Across all states</span>
                </div>

                <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm space-y-1 bg-blue-50/20">
                  <span className="text-[11px] font-semibold text-blue-600 block uppercase">Under Review</span>
                  <span className="text-2xl font-black text-blue-900">{officerSummary.claims_awaiting_review}</span>
                  <span className="text-[10px] text-blue-500 block">Awaiting officer action</span>
                </div>

                <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm space-y-1 bg-emerald-50/20">
                  <span className="text-[11px] font-semibold text-emerald-600 block uppercase">Approved</span>
                  <span className="text-2xl font-black text-emerald-900">{officerSummary.approved_claims}</span>
                  <span className="text-[10px] text-emerald-600 block">Decision recorded</span>
                </div>

                <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm space-y-1 bg-rose-50/20">
                  <span className="text-[11px] font-semibold text-rose-600 block uppercase">Rejected</span>
                  <span className="text-2xl font-black text-rose-900">{officerSummary.rejected_claims}</span>
                  <span className="text-[10px] text-rose-500 block">Insufficient damage</span>
                </div>

                <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm space-y-1 bg-amber-50/20">
                  <span className="text-[11px] font-semibold text-amber-600 block uppercase">Needs Info</span>
                  <span className="text-2xl font-black text-amber-900">{officerSummary.claims_requiring_additional_info}</span>
                  <span className="text-[10px] text-amber-600 block">Pending documents</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">AI Model Health</span>
                  <span className="text-xl font-black text-emerald-700">92.4%</span>
                  <span className="text-[10px] text-slate-400 block">ROC-AUC Accuracy</span>
                </div>
              </div>

              {/* District & Crop Distribution Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>District-wise Claim Inflow</span>
                    <span className="text-xs text-slate-400 font-normal">Top agricultural regions</span>
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={officerSummary.district_distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="claims" fill="#059669" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>Crop-wise Claim Distribution</span>
                    <span className="text-xs text-slate-400 font-normal">By crop category</span>
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={officerSummary.crop_distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="crop" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="claims" fill="#0284c7" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Review Workspace Table */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Claims Queue for Assessor Action
                    </h3>
                    <p className="text-xs text-slate-400">
                      Authorised officers must review evidence before finalising payouts.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setOfficerFilter('all')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        officerFilter === 'all' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      All ({officerSummary.total_claims})
                    </button>
                    <button
                      onClick={() => setOfficerFilter('waiting')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        officerFilter === 'waiting' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Waiting ({officerSummary.claims_awaiting_review})
                    </button>
                    <button
                      onClick={() => setOfficerFilter('attention')}
                      className={`px-3 py-1 rounded-lg font-semibold transition ${
                        officerFilter === 'attention' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600'
                      }`}
                    >
                      Missing Docs ({officerSummary.claims_requiring_additional_info})
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Claim Ref</th>
                        <th className="py-3 px-4">Farmer Details</th>
                        <th className="py-3 px-4">Crop & Season</th>
                        <th className="py-3 px-4">District</th>
                        <th className="py-3 px-4">Reported Loss</th>
                        <th className="py-3 px-4">Workflow Stage</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {officerClaims
                        .filter(c => {
                          if (officerFilter === 'waiting') return c.status === 'Submitted' || c.status === 'Ready for assessment' || c.workflow_stage === 'under_assessment';
                          if (officerFilter === 'attention') return c.workflow_stage === 'documents_checked' || c.status === 'Additional evidence required';
                          return true;
                        })
                        .map((claim) => (
                          <tr key={claim.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">{claim.claim_reference}</td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-slate-800">{claim.farmer_name}</p>
                              <p className="text-[11px] text-slate-400">{claim.policy_reference}</p>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {claim.crop_type} ({claim.season})
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {claim.district}, {claim.state}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {claim.crop_loss_percentage}%
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-md font-mono text-slate-700">
                                {claim.workflow_stage || 'application_submitted'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                                claim.status === 'Approved'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : claim.status === 'Rejected'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {claim.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <button
                                onClick={() => {
                                  setReviewingClaim(claim);
                                  setReviewDecision(claim.status === 'Approved' ? 'Approved' : 'Approved');
                                  setReviewRationale(claim.officer_notes || '');
                                  setVerifiedLossPct(claim.verified_crop_loss ? String(claim.verified_crop_loss) : String(claim.crop_loss_percentage));
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[11px] font-bold transition shadow-2xs"
                              >
                                Review & Decide
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Officer Review Modal */}
          {reviewingClaim && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
              <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Record Assessment Decision
                    </h3>
                    <p className="text-xs text-slate-500">
                      Application Ref: <strong className="font-mono text-slate-800">{reviewingClaim.claim_reference}</strong> ({reviewingClaim.farmer_name})
                    </p>
                  </div>
                  <button
                    onClick={() => setReviewingClaim(null)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleRecordOfficerReview} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Decision Outcome</label>
                    <select
                      value={reviewDecision}
                      onChange={(e) => setReviewDecision(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-agri-500 focus:outline-none"
                    >
                      <option value="Approved">Approve Claim for Payment</option>
                      <option value="Rejected">Reject Claim (Criteria Not Met)</option>
                      <option value="Additional evidence required">Request Additional Documents</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Verified Crop Loss (%)
                    </label>
                    <input
                      type="number"
                      value={verifiedLossPct}
                      onChange={(e) => setVerifiedLossPct(e.target.value)}
                      placeholder="e.g. 60"
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-agri-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assessor Rationale & Ground Notes
                    </label>
                    <textarea
                      rows={3}
                      value={reviewRationale}
                      onChange={(e) => setReviewRationale(e.target.value)}
                      placeholder="Enter verified ground inspection notes, rainfall deficit rationale, or justification..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-agri-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setReviewingClaim(null)}
                      className="px-4 py-2 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition shadow-sm disabled:opacity-50"
                    >
                      {submittingReview ? 'Recording...' : 'Commit Decision'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
