import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useRole } from '../context/RoleContext';
import { useVoice } from '../hooks/useVoice';
import { SpeakButton } from '../components/SpeakButton';
import {
  FilePlus,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RotateCcw,
  Info,
  Calendar,
  CloudRain,
  Sun,
  Activity,
  MapPin,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  Edit3,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const CROPS = ["Rice/Paddy", "Wheat", "Cotton", "Maize", "Groundnut", "Mustard", "Soybean", "Sugarcane"];
const STATES = [
  "Karnataka", "Maharashtra", "Madhya Pradesh", "Uttar Pradesh", "Rajasthan",
  "Punjab", "Andhra Pradesh", "Gujarat", "Haryana", "Tamil Nadu", "Odisha", "West Bengal", "Kerala"
];
const SEASONS = ["Kharif", "Rabi", "Zaid"];
const SOILS = ["Black Cotton", "Alluvial", "Red Sandy Loam", "Clay Loam", "Sandy Soil"];
const IRRIGATIONS = ["Rainfed", "Canal", "Borewell / Tube well", "Drip Irrigation", "Sprinkler"];
const STAGES = ["Germination", "Vegetative Growth", "Flowering / Tasseling", "Grain Filling / Pod Formation", "Maturity"];

export const NewClaimPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, t, user } = useRole();
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

  // Mode Selection: 'auto' | 'manual' | 'combined'
  const [entryMode, setEntryMode] = useState<'auto' | 'manual' | 'combined'>('auto');

  const [formData, setFormData] = useState({
    farmer_name: user?.full_name || '',
    contact_number: user?.phone_number || '',
    policy_reference: '',
    insurance_scheme: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    sum_insured: '50000',
    state: user?.state || 'Karnataka',
    district: user?.district || '',
    village: user?.village || '',
    crop_type: 'Rice/Paddy',
    season: 'Kharif',
    sowing_date: '2025-06-20',
    claim_start_date: '2025-07-01',
    claim_end_date: '2025-11-01',
    reported_loss_pct: '50',
    loss_description: '',
    cultivated_area: '2.5',
    growth_stage: 'Flowering / Tasseling',
    soil_type: 'Black Cotton',
    irrigation_type: 'Rainfed',
    observed_rainfall: '320',
    reference_rainfall: '850',
    soil_moisture: '22',
    observed_temperature: '34.5',
    reference_temperature: '30.2',
    current_ndvi: '0.00',
    reference_ndvi: '0.00',
    latitude: '',
    longitude: ''
  });

  // Weather Ingestion State & Provenance
  const [weatherStatus, setWeatherStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [weatherDetails, setWeatherDetails] = useState<any>(null);
  const [weatherOriginal, setWeatherOriginal] = useState<any>(null);
  const [weatherManuallyEdited, setWeatherManuallyEdited] = useState<{ [key: string]: boolean }>({});

  // PMFBY Reference Lookup State
  const [pmfbyStatus, setPmfbyStatus] = useState<'idle' | 'loading' | 'success' | 'not_found' | 'error'>('idle');
  const [pmfbyDetails, setPmfbyDetails] = useState<any>(null);

  // Satellite NDVI Ingestion State
  const [ndviStatus, setNdviStatus] = useState<'idle' | 'loading' | 'unavailable' | 'available'>('idle');
  const [ndviDetails, setNdviDetails] = useState<any>(null);
  const [showManualNdvi, setShowManualNdvi] = useState(false);

  const [loading, setLoading] = useState(false);
  const [autoRetrieving, setAutoRetrieving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  // Handler for normal form fields
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handler for weather fields with manual edit tracking
  const handleWeatherChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Track whether this value differs from original auto-retrieved value
    if (weatherOriginal && weatherOriginal[name] !== undefined) {
      const origVal = String(weatherOriginal[name]);
      if (origVal !== value.trim()) {
        setWeatherManuallyEdited(prev => ({ ...prev, [name]: true }));
      } else {
        setWeatherManuallyEdited(prev => ({ ...prev, [name]: false }));
      }
    } else {
      setWeatherManuallyEdited(prev => ({ ...prev, [name]: true }));
    }
  };

  // Automated retrieval function
  const triggerAutoRetrieval = async () => {
    if (!formData.district.trim()) {
      setError(t('forms.errDistrict') || 'Please enter or select a district first.');
      return;
    }
    if (!formData.sowing_date || !formData.claim_start_date) {
      setError('Please provide sowing date and damage incident date for automated retrieval.');
      return;
    }

    try {
      setAutoRetrieving(true);
      setError(null);

      // 1. Fetch Weather from Open-Meteo ERA5 Reanalysis
      setWeatherStatus('loading');
      try {
        const wRes = await api.external.fetchWeather({
          state: formData.state,
          district: formData.district,
          start_date: formData.sowing_date,
          end_date: formData.claim_start_date,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined
        });

        if (wRes.status === 'SUCCESS' && wRes.data) {
          setWeatherStatus('success');
          setWeatherDetails(wRes);
          setWeatherOriginal({
            observed_rainfall: wRes.data.observed_rainfall,
            reference_rainfall: wRes.data.reference_rainfall,
            observed_temperature: wRes.data.observed_temperature,
            reference_temperature: wRes.data.reference_temperature
          });
          setWeatherManuallyEdited({});

          // Update form state with retrieved values
          setFormData(prev => ({
            ...prev,
            observed_rainfall: String(wRes.data!.observed_rainfall),
            reference_rainfall: String(wRes.data!.reference_rainfall),
            observed_temperature: String(wRes.data!.observed_temperature),
            reference_temperature: String(wRes.data!.reference_temperature)
          }));
        } else {
          setWeatherStatus('failed');
          setWeatherDetails(wRes);
        }
      } catch (err: any) {
        setWeatherStatus('failed');
        setWeatherDetails({ error: err.message || 'Weather service unreachable' });
      }

      // 2. Search PMFBY Reference Notified Scheme Database
      setPmfbyStatus('loading');
      try {
        const pRes = await api.external.fetchPmfbyReference({
          state: formData.state,
          district: formData.district,
          crop: formData.crop_type,
          season: formData.season,
          year: new Date(formData.sowing_date).getFullYear() || 2024
        });

        if (pRes.matched) {
          setPmfbyStatus('success');
          setPmfbyDetails(pRes);
        } else {
          setPmfbyStatus('not_found');
          setPmfbyDetails(pRes);
        }
      } catch (err: any) {
        setPmfbyStatus('error');
        setPmfbyDetails({ message: err.message || 'Reference lookup failed' });
      }

      // 3. Check Satellite NDVI Availability
      setNdviStatus('loading');
      try {
        const nRes = await api.external.fetchSatelliteNdvi({
          state: formData.state,
          district: formData.district,
          observation_date: formData.claim_start_date,
          latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
          longitude: formData.longitude ? parseFloat(formData.longitude) : undefined
        });
        setNdviStatus(nRes.status === 'AVAILABLE' ? 'available' : 'unavailable');
        setNdviDetails(nRes);
        if (nRes.data?.current_ndvi !== null && nRes.data?.current_ndvi !== undefined) {
          setFormData(prev => ({
            ...prev,
            current_ndvi: String(nRes.data!.current_ndvi),
            reference_ndvi: String(nRes.data!.reference_ndvi || 0.0)
          }));
        }
      } catch (err: any) {
        setNdviStatus('unavailable');
        setNdviDetails({ reason: err.message || 'Satellite service unavailable' });
      }

    } finally {
      setAutoRetrieving(false);
    }
  };

  // Optional: Apply PMFBY statutory sum insured to claim
  const handleApplyReferenceSumInsured = () => {
    if (pmfbyDetails?.sum_insured_per_ha) {
      const area = parseFloat(formData.cultivated_area) || 1.0;
      const totalSum = Math.round(pmfbyDetails.sum_insured_per_ha * area);
      setFormData(prev => ({ ...prev, sum_insured: String(totalSum) }));
    }
  };

  const validateForm = () => {
    const warns: string[] = [];
    if (!formData.farmer_name.trim()) warns.push(t('forms.errFarmerName') || 'Farmer name is required.');
    if (!formData.policy_reference.trim()) warns.push(t('forms.errPolicyRef') || 'Policy reference is required.');
    if (!formData.district.trim()) warns.push(t('forms.errDistrict') || 'District is required.');

    const area = parseFloat(formData.cultivated_area);
    if (isNaN(area) || area <= 0) warns.push(t('forms.errArea') || 'Cultivated area must be a positive number.');

    const obsRain = parseFloat(formData.observed_rainfall);
    if (isNaN(obsRain) || obsRain < 0) warns.push('Observed rainfall cannot be negative.');

    const refRain = parseFloat(formData.reference_rainfall);
    if (isNaN(refRain) || refRain < 0) warns.push('Normal rainfall cannot be negative.');

    const obsTemp = parseFloat(formData.observed_temperature);
    if (isNaN(obsTemp) || obsTemp < -20 || obsTemp > 60) warns.push('Observed temperature must be between -20°C and 60°C.');

    const refTemp = parseFloat(formData.reference_temperature);
    if (isNaN(refTemp) || refTemp < -20 || refTemp > 60) warns.push('Normal temperature must be between -20°C and 60°C.');

    const curNdvi = parseFloat(formData.current_ndvi);
    if (isNaN(curNdvi) || curNdvi < -1.0 || curNdvi > 1.0) warns.push('Current NDVI must be between -1.0 and 1.0.');

    if (formData.sowing_date > formData.claim_start_date) {
      warns.push('Damage incident date cannot precede sowing date.');
    }
    if (formData.claim_start_date > formData.claim_end_date) {
      warns.push('Claim end date cannot precede incident date.');
    }

    return warns;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setWarnings(validationErrors);
      setError(t('forms.errorsHeading') || 'Please resolve validation issues before submitting.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setWarnings([]);

      // Construct detailed provenance history
      const dataProvenance = {
        entry_mode: entryMode,
        retrieval_timestamp: new Date().toISOString(),
        weather: {
          status: weatherStatus === 'success' ? (Object.values(weatherManuallyEdited).some(Boolean) ? 'manually_corrected' : 'automatically_retrieved') : 'manually_entered',
          source: weatherDetails?.source || (weatherStatus === 'success' ? 'Open-Meteo ERA5-Land' : 'Farmer Manual Entry'),
          observation_period: weatherDetails?.observation_period || `${formData.sowing_date} to ${formData.claim_start_date}`,
          coordinates_used: weatherDetails ? { lat: weatherDetails.resolved_latitude, lon: weatherDetails.resolved_longitude } : null,
          original_retrieved_values: weatherOriginal,
          manual_corrections: weatherManuallyEdited
        },
        satellite_ndvi: {
          status: ndviStatus === 'available' ? 'automatically_retrieved' : (showManualNdvi ? 'manually_entered_surveyor' : 'unavailable'),
          source: ndviDetails?.source || 'Copernicus Sentinel-2 L2A',
          observation_date: formData.claim_start_date,
          reason_if_unavailable: ndviDetails?.reason || (ndviStatus === 'unavailable' ? 'Satellite imagery unprovisioned for farm coordinates' : null)
        },
        pmfby_reference: {
          matched: pmfbyDetails?.matched || false,
          source: pmfbyDetails?.source || 'PMFBY Notified Coverage Database',
          reference_period: pmfbyDetails?.reference_period || null,
          sum_insured_per_ha: pmfbyDetails?.sum_insured_per_ha || null,
          indemnity_level_pct: pmfbyDetails?.indemnity_level_pct || null,
          notified_insurance_company: pmfbyDetails?.insurance_company || null
        }
      };

      const payload = {
        ...formData,
        cultivated_area: parseFloat(formData.cultivated_area),
        observed_rainfall: parseFloat(formData.observed_rainfall),
        reference_rainfall: parseFloat(formData.reference_rainfall),
        soil_moisture: formData.soil_moisture ? parseFloat(formData.soil_moisture) : undefined,
        observed_temperature: parseFloat(formData.observed_temperature),
        reference_temperature: parseFloat(formData.reference_temperature),
        current_ndvi: parseFloat(formData.current_ndvi),
        reference_ndvi: parseFloat(formData.reference_ndvi),
        reported_loss_pct: formData.reported_loss_pct ? parseFloat(formData.reported_loss_pct) : undefined,
        sum_insured: formData.sum_insured ? parseFloat(formData.sum_insured) : undefined,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        data_provenance: dataProvenance
      };

      const created = await api.createClaim(payload);
      setSuccessRef(created.claim_reference || `CLM-${created.id}`);
      setTimeout(() => {
        navigate('/');
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to register claim');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      farmer_name: user?.full_name || '',
      contact_number: user?.phone_number || '',
      policy_reference: '',
      insurance_scheme: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      sum_insured: '50000',
      state: user?.state || 'Karnataka',
      district: user?.district || '',
      village: user?.village || '',
      crop_type: 'Rice/Paddy',
      season: 'Kharif',
      sowing_date: '2025-06-20',
      claim_start_date: '2025-07-01',
      claim_end_date: '2025-11-01',
      reported_loss_pct: '50',
      loss_description: '',
      cultivated_area: '2.5',
      growth_stage: 'Flowering / Tasseling',
      soil_type: 'Black Cotton',
      irrigation_type: 'Rainfed',
      observed_rainfall: '320',
      reference_rainfall: '850',
      soil_moisture: '22',
      observed_temperature: '34.5',
      reference_temperature: '30.2',
      current_ndvi: '0.00',
      reference_ndvi: '0.00',
      latitude: '',
      longitude: ''
    });
    setWeatherStatus('idle');
    setWeatherDetails(null);
    setWeatherOriginal(null);
    setWeatherManuallyEdited({});
    setPmfbyStatus('idle');
    setPmfbyDetails(null);
    setNdviStatus('idle');
    setNdviDetails(null);
    setWarnings([]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header with Read Aloud Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> {t('forms.back') || 'Back'}
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-emerald-600" />
            {t('forms.pageTitle') || 'Submit Crop Insurance Claim'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            {t('forms.pageSubtitle') || 'Easy step-by-step registration for your crop loss.'}
          </p>
        </div>
        <SpeakButton
          id="claim_form_header"
          text={`${t('forms.pageTitle') || 'Submit Crop Insurance Claim'}. ${t('forms.pageSubtitle') || 'Easy step-by-step registration for your crop loss.'}`}
          isPlaying={isPlaying}
          activeId={activeSpeechId}
          onSpeak={speak}
          onStop={stopAudio}
        />
      </div>

      {/* Voice Assistant / Activity Notice */}
      {voiceNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-600" />
            <span>{voiceNotice}</span>
          </div>
          {isPlaying && (
            <button
              onClick={stopAudio}
              className="px-2 py-0.5 bg-emerald-200 hover:bg-emerald-300 text-emerald-900 text-xs font-bold rounded-lg transition"
            >
              Stop Audio
            </button>
          )}
        </div>
      )}

      {/* Success Banner */}
      {successRef && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center space-y-2 animate-fadeIn">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h2 className="text-lg font-bold text-emerald-900">
            {t('forms.claimSubmittedSuccess') || 'Claim Application Submitted Successfully!'}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-700">
            {t('forms.claimRefMsg') || 'Your Reference Number is:'}{' '}
            <span className="font-mono font-bold bg-white px-2 py-1 rounded-md border border-emerald-300">
              {successRef}
            </span>
          </p>
          <p className="text-xs text-slate-500">Redirecting to your dashboard...</p>
        </div>
      )}

      {/* Validation Warnings / Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-rose-800 text-xs animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{error}</p>
            {warnings.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-rose-700">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Main Claim Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 space-y-8 shadow-sm">
        
        {/* Section 1: Farmer & Policy Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">1</span>
              {t('forms.farmerDetails') || '1. Farmer & Policy Information'}
            </h3>
            <SpeakButton
              id="sec_farmer_info"
              text="Farmer and Policy details. Please enter your name, contact number, policy reference, and sum insured."
              isPlaying={isPlaying}
              activeId={activeSpeechId}
              onSpeak={speak}
              onStop={stopAudio}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.farmerName') || "Farmer's Full Name"} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="farmer_name"
                value={formData.farmer_name}
                onChange={handleChange}
                required
                placeholder="e.g. Ramesh Patil"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.phoneNumber') || 'Mobile Phone Number'}
              </label>
              <input
                type="tel"
                name="contact_number"
                value={formData.contact_number}
                onChange={handleChange}
                placeholder="e.g. 9876543210"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.policyRef') || 'PMFBY Policy / Application No.'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="policy_reference"
                value={formData.policy_reference}
                onChange={handleChange}
                required
                placeholder="e.g. PMFBY-2025-098234"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.insuranceScheme') || 'Insurance Scheme'}
              </label>
              <input
                type="text"
                name="insurance_scheme"
                value={formData.insurance_scheme}
                readOnly
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.sumInsured') || 'Sum Insured (₹)'}
              </label>
              <input
                type="number"
                name="sum_insured"
                value={formData.sum_insured}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Farm Location */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">2</span>
              {t('forms.farmLocation') || '2. Farm Location'}
            </h3>
            <SpeakButton
              id="sec_location_info"
              text="Farm Location. Select your state, district, and enter village name or optional GPS coordinates."
              isPlaying={isPlaying}
              activeId={activeSpeechId}
              onSpeak={speak}
              onStop={stopAudio}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.state') || 'State'} <span className="text-rose-500">*</span>
              </label>
              <select
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.district') || 'District'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleChange}
                required
                placeholder="e.g. Belagavi, Fatehabad, Nagpur"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.village') || 'Village / Taluk'}
              </label>
              <input
                type="text"
                name="village"
                value={formData.village}
                onChange={handleChange}
                placeholder="e.g. Athani"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Crop & Agronomic Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">3</span>
              {t('forms.cropDetails') || '3. Crop & Damage Information'}
            </h3>
            <SpeakButton
              id="sec_crop_info"
              text="Crop and damage information. Select your crop, season, cultivated area, sowing date, and incident date."
              isPlaying={isPlaying}
              activeId={activeSpeechId}
              onSpeak={speak}
              onStop={stopAudio}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.cropType') || 'Crop Type'} <span className="text-rose-500">*</span>
              </label>
              <select
                name="crop_type"
                value={formData.crop_type}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {CROPS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.season') || 'Season'}
              </label>
              <select
                name="season"
                value={formData.season}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.cultivatedArea') || 'Cultivated Area (Hectares / Acres)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                name="cultivated_area"
                value={formData.cultivated_area}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.sowingDate') || 'Sowing Date'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="sowing_date"
                value={formData.sowing_date}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.claimStartDate') || 'Damage Incident Date'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="claim_start_date"
                value={formData.claim_start_date}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.reportedLoss') || 'Reported Loss (%)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                name="reported_loss_pct"
                value={formData.reported_loss_pct}
                onChange={handleChange}
                min="1"
                max="100"
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Section 4: Data Entry Choice & Agricultural Ingestion (CORE REQUIREMENT) */}
        {/* ========================================================================= */}
        <div className="space-y-6 pt-4 border-t-2 border-emerald-100">
          
          {/* 1. Give farmers a choice banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                  Farmer Choice
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  How would you like to provide Weather & Environmental Details?
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Choose automatic retrieval to fetch official weather and PMFBY data instantly, or enter details manually.
                </p>
              </div>

              {/* 3-Option Choice Toggle */}
              <div className="inline-flex bg-white p-1 rounded-xl border border-emerald-300 shadow-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setEntryMode('auto')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    entryMode === 'auto'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Automatic
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('manual')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    entryMode === 'manual'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setEntryMode('combined')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    entryMode === 'combined'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Combined
                </button>
              </div>
            </div>

            {/* Auto Fetch Action Button */}
            {(entryMode === 'auto' || entryMode === 'combined') && (
              <div className="mt-4 pt-3 border-t border-emerald-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-emerald-900">
                  <span className="font-semibold">Selected Location & Window:</span> {formData.district || 'Select district'}, {formData.state} ({formData.sowing_date} to {formData.claim_start_date})
                </div>
                <button
                  type="button"
                  onClick={triggerAutoRetrieval}
                  disabled={autoRetrieving}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${autoRetrieving ? 'animate-spin' : ''}`} />
                  {autoRetrieving ? 'Fetching Live Observations...' : 'Fetch Official Weather & Reference Data'}
                </button>
              </div>
            )}
          </div>

          {/* 4. PMFBY Reference Information Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                PMFBY Statutory Reference Scheme Data
              </h4>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                pmfbyStatus === 'success'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : pmfbyStatus === 'not_found'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {pmfbyStatus === 'success' ? '✓ Matching Scheme Record Found' : (pmfbyStatus === 'not_found' ? 'No Matching Reference Record Found' : 'Reference Lookup Ready')}
              </span>
            </div>

            {pmfbyStatus === 'success' && pmfbyDetails && (
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-xs space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Notified Crop / District</span>
                    <span className="font-bold text-slate-900">{pmfbyDetails.notified_crop} ({pmfbyDetails.notified_district})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Sum Insured per Hectare</span>
                    <span className="font-bold text-emerald-700">₹{pmfbyDetails.sum_insured_per_ha?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Indemnity Level</span>
                    <span className="font-bold text-slate-900">{pmfbyDetails.indemnity_level_pct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Notified Insurer</span>
                    <span className="font-semibold text-slate-800 truncate block">{pmfbyDetails.insurance_company}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                  <span>Source: {pmfbyDetails.source} (Reference Season: {pmfbyDetails.reference_period})</span>
                  {pmfbyDetails.sum_insured_per_ha && (
                    <button
                      type="button"
                      onClick={handleApplyReferenceSumInsured}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 transition text-[11px]"
                    >
                      Use Reference Sum Insured (₹{Math.round(pmfbyDetails.sum_insured_per_ha * (parseFloat(formData.cultivated_area) || 1.0)).toLocaleString()})
                    </button>
                  )}
                </div>
              </div>
            )}

            {pmfbyStatus === 'not_found' && (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">No matching reference record found in official PMFBY gazette table for {formData.state} - {formData.district} ({formData.crop_type}, {formData.season}).</p>
                <p className="text-[11px] text-amber-700">This does not invalidate your claim. You may proceed normally with your individual policy document details.</p>
              </div>
            )}

            <p className="text-[10px] text-slate-400 italic">
              ℹ️ Statutory PMFBY reference benchmarks provide regional threshold limits. This lookup is kept strictly separate from the insurance claim prediction model.
            </p>
          </div>

          {/* 2. Weather Observations Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <CloudRain className="w-4 h-4 text-cyan-600" />
                Weather Evidence (Rainfall & Temperature)
              </h4>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                weatherStatus === 'success'
                  ? (Object.values(weatherManuallyEdited).some(Boolean) ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300')
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {weatherStatus === 'success'
                  ? (Object.values(weatherManuallyEdited).some(Boolean) ? 'Combined (Auto + Manually Corrected)' : '✓ Automatically Retrieved')
                  : (entryMode === 'manual' ? '✍️ Manual Entry Mode' : 'Awaiting Retrieval')}
              </span>
            </div>

            {weatherStatus === 'success' && weatherDetails && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 text-xs text-cyan-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-bold">Source:</span> {weatherDetails.source}
                  <span className="mx-2">•</span>
                  <span className="font-bold">Observation Period:</span> {weatherDetails.observation_period}
                </div>
                <div className="text-[11px] text-cyan-700">
                  Resolved: {weatherDetails.resolved_latitude?.toFixed(2)}°N, {weatherDetails.resolved_longitude?.toFixed(2)}°E ({weatherDetails.coordinate_source})
                </div>
              </div>
            )}

            {weatherStatus === 'failed' && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                Weather retrieval was temporarily unavailable: {weatherDetails?.error || 'Network error'}. You can enter values manually below.
              </div>
            )}

            {/* Weather Input Fields with Source Badges & Validation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Observed Rainfall */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Observed Rainfall (mm) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    weatherManuallyEdited['observed_rainfall']
                      ? 'bg-amber-100 text-amber-800'
                      : (weatherStatus === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                  }`}>
                    {weatherManuallyEdited['observed_rainfall'] ? 'Manual Edit' : (weatherStatus === 'success' ? 'Auto' : 'Manual')}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  name="observed_rainfall"
                  value={formData.observed_rainfall}
                  onChange={handleWeatherChange}
                  required
                  min="0"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {weatherOriginal && weatherManuallyEdited['observed_rainfall'] && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Original retrieved: {weatherOriginal.observed_rainfall} mm
                  </p>
                )}
              </div>

              {/* Normal Reference Rainfall */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Normal Rainfall (mm) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    weatherManuallyEdited['reference_rainfall']
                      ? 'bg-amber-100 text-amber-800'
                      : (weatherStatus === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                  }`}>
                    {weatherManuallyEdited['reference_rainfall'] ? 'Manual Edit' : (weatherStatus === 'success' ? 'Auto' : 'Manual')}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  name="reference_rainfall"
                  value={formData.reference_rainfall}
                  onChange={handleWeatherChange}
                  required
                  min="0"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {weatherOriginal && weatherManuallyEdited['reference_rainfall'] && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Original retrieved: {weatherOriginal.reference_rainfall} mm
                  </p>
                )}
              </div>

              {/* Observed Temperature */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Observed Temp (°C) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    weatherManuallyEdited['observed_temperature']
                      ? 'bg-amber-100 text-amber-800'
                      : (weatherStatus === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                  }`}>
                    {weatherManuallyEdited['observed_temperature'] ? 'Manual Edit' : (weatherStatus === 'success' ? 'Auto' : 'Manual')}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  name="observed_temperature"
                  value={formData.observed_temperature}
                  onChange={handleWeatherChange}
                  required
                  min="-20"
                  max="60"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {weatherOriginal && weatherManuallyEdited['observed_temperature'] && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Original retrieved: {weatherOriginal.observed_temperature} °C
                  </p>
                )}
              </div>

              {/* Normal Reference Temperature */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Normal Temp (°C) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    weatherManuallyEdited['reference_temperature']
                      ? 'bg-amber-100 text-amber-800'
                      : (weatherStatus === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')
                  }`}>
                    {weatherManuallyEdited['reference_temperature'] ? 'Manual Edit' : (weatherStatus === 'success' ? 'Auto' : 'Manual')}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  name="reference_temperature"
                  value={formData.reference_temperature}
                  onChange={handleWeatherChange}
                  required
                  min="-20"
                  max="60"
                  className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                {weatherOriginal && weatherManuallyEdited['reference_temperature'] && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Original retrieved: {weatherOriginal.reference_temperature} °C
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 3. Satellite NDVI Observations Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                <Satellite className="w-4 h-4 text-indigo-600" />
                Satellite Vegetation Index (NDVI)
              </h4>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 border border-slate-300">
                {ndviStatus === 'available' ? '✓ Satellite Observation Verified' : 'NDVI data unavailable'}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-start gap-2.5 text-slate-700">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">
                    {ndviDetails?.reason || 'Real-time satellite NDVI ingestion requires configured Copernicus Sentinel-2 API or Google Earth Engine credentials. Live cloud-free imagery is currently unprovisioned for this plot.'}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    <strong>Rule:</strong> The application never invents, guesses, or fabricates an NDVI value. Farmers are not required to calculate or manually enter NDVI.
                  </p>
                </div>
              </div>

              {/* Optional Surveyor Manual Entry Toggle */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowManualNdvi(!showManualNdvi)}
                  className="text-[11px] text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1 transition"
                >
                  {showManualNdvi ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showManualNdvi ? 'Hide Surveyor Ground-Sensor NDVI Entry' : 'Insurance Surveyor: Enter Verified Sensor NDVI manually?'}
                </button>

                {showManualNdvi && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Current NDVI (-1.0 to 1.0) <span className="text-amber-600">(Surveyor Ground Reading)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="current_ndvi"
                        value={formData.current_ndvi}
                        onChange={handleChange}
                        min="-1.0"
                        max="1.0"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Reference Normal NDVI (-1.0 to 1.0)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="reference_ndvi"
                        value={formData.reference_ndvi}
                        onChange={handleChange}
                        min="-1.0"
                        max="1.0"
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Loss Description & Voice Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                {t('forms.lossDescription') || 'Describe Crop Loss & Causes'}
              </label>
              <button
                type="button"
                onClick={() => {
                  if (isRecording && recordingId === 'loss_desc') {
                    stopRecording();
                  } else {
                    startRecording(language, (text) => {
                      setFormData(p => ({
                        ...p,
                        loss_description: (p.loss_description ? p.loss_description + ' ' : '') + text
                      }));
                    }, 'loss_desc');
                  }
                }}
                className={`text-xs flex items-center gap-1.5 font-bold px-3 py-1 rounded-full transition shadow-xs ${
                  isRecording && recordingId === 'loss_desc'
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200'
                }`}
                title="Speak loss description"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>
                  {isRecording && recordingId === 'loss_desc'
                    ? (t('forms.listening') || 'Listening... Speak now')
                    : (t('forms.voiceInput') || 'Speak Description')}
                </span>
              </button>
            </div>
            <textarea
              name="loss_description"
              rows={3}
              value={formData.loss_description}
              onChange={handleChange}
              placeholder={t('forms.lossDescriptionPlaceholder') || 'Describe drought, flood, pest attack, unseasonal rain, or crop damage...'}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('forms.resetForm') || 'Reset Form'}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
          >
            {loading ? (t('forms.submitting') || 'Submitting Application...') : (t('forms.submitClaim') || 'Submit Crop Insurance Claim')}
          </button>
        </div>
      </form>
    </div>
  );
};
