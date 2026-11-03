import React, { useState } from 'react';
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
  Volume2
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
    current_ndvi: '0.34',
    reference_ndvi: '0.68',
    latitude: '',
    longitude: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateForm = () => {
    const warns: string[] = [];
    if (!formData.farmer_name.trim()) warns.push(t('forms.errFarmerName') || 'Farmer name is required.');
    if (!formData.policy_reference.trim()) warns.push(t('forms.errPolicyRef') || 'Policy reference is required.');
    if (!formData.district.trim()) warns.push(t('forms.errDistrict') || 'District is required.');

    const area = parseFloat(formData.cultivated_area);
    if (isNaN(area) || area <= 0) warns.push(t('forms.errArea') || 'Cultivated area must be a positive number.');

    const curNdvi = parseFloat(formData.current_ndvi);
    if (isNaN(curNdvi) || curNdvi < -1.0 || curNdvi > 1.0) warns.push('Current NDVI must be between -1.0 and 1.0.');

    const refNdvi = parseFloat(formData.reference_ndvi);
    if (isNaN(refNdvi) || refNdvi < -1.0 || refNdvi > 1.0) warns.push('Reference NDVI must be between -1.0 and 1.0.');

    const obsRain = parseFloat(formData.observed_rainfall);
    if (isNaN(obsRain) || obsRain < 0) warns.push('Observed rainfall cannot be negative.');

    if (formData.sowing_date > formData.claim_start_date) {
      warns.push('Claim start date cannot precede sowing date.');
    }
    if (formData.claim_start_date > formData.claim_end_date) {
      warns.push('Claim end date cannot precede claim start date.');
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
      current_ndvi: '0.34',
      reference_ndvi: '0.68',
      latitude: '',
      longitude: ''
    });
    setWarnings([]);
    setError(null);
  };

  const instructionsText = `${t('forms.pageTitle')}. ${t('forms.pageSubtitle')}. ${t('forms.guidance') || ''}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with Read Aloud Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FilePlus className="w-6 h-6 text-emerald-600" />
            {t('forms.pageTitle') || 'Apply for Crop Insurance / Register Claim'}
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            {t('forms.pageSubtitle') || 'Provide your agricultural and damage details honestly. AI assists verification using weather and satellite sensors.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <SpeakButton
            id="form-instructions"
            text={instructionsText}
            lang={language}
            label={t('forms.listenInstructions') || 'Listen to Instructions'}
            activeId={activeSpeechId}
            isPlaying={isPlaying}
            onSpeak={speak}
            onStop={stopAudio}
            size="md"
          />
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition rounded-xl border border-slate-200 bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('nav.dashboard') || 'Dashboard'}
          </button>
        </div>
      </div>

      {/* Voice helper notice */}
      {voiceNotice && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl p-4 text-xs">
          {voiceNotice}
        </div>
      )}

      {/* Success banner */}
      {successRef && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-3xl p-6 text-center space-y-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-lg font-bold">
            {t('forms.successMessage') || 'Your insurance claim has been registered successfully!'}
          </h3>
          <p className="font-mono text-base font-bold text-emerald-800 bg-emerald-100/60 inline-block px-4 py-1.5 rounded-full">
            {successRef}
          </p>
          <p className="text-xs text-emerald-700">Redirecting to your dashboard in a few seconds...</p>
        </div>
      )}

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{t('forms.errorsHeading') || 'Please resolve the following fields before submitting:'}</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs flex items-center gap-2 text-rose-800 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
        {/* Section 1: Farmer & Policy */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Info className="w-4 h-4 text-emerald-600" />
            1. {t('Farmer & Policy Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.farmerName') || 'Farmer Name'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="farmer_name"
                value={formData.farmer_name}
                onChange={handleChange}
                placeholder={t('forms.farmerNamePlaceholder') || 'e.g. Ramesh Patel'}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.contactNumber') || 'Mobile Number'}
              </label>
              <input
                type="tel"
                name="contact_number"
                value={formData.contact_number}
                onChange={handleChange}
                placeholder={t('forms.contactPlaceholder') || '10-digit mobile number'}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.policyRef') || 'Policy Reference Number'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="policy_reference"
                value={formData.policy_reference}
                onChange={handleChange}
                placeholder={t('forms.policyPlaceholder') || 'e.g. PMFBY-2025-KA-88321'}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.scheme') || 'Insurance Scheme'}
              </label>
              <input
                type="text"
                name="insurance_scheme"
                value={formData.insurance_scheme}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Sum Insured (₹ INR)')}
              </label>
              <input
                type="number"
                name="sum_insured"
                value={formData.sum_insured}
                onChange={handleChange}
                placeholder="50000"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Geographical Location */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            2. {t('forms.location') || 'Geographical Location'}
          </h3>
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
                placeholder={t('forms.districtPlaceholder') || 'e.g. Dharwad'}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {t('forms.village') || 'Village / Locality'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording && recordingId === 'village') {
                      stopRecording();
                    } else {
                      startRecording(language, (text) => setFormData(p => ({ ...p, village: text })), 'village');
                    }
                  }}
                  className={`text-[11px] flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${
                    isRecording && recordingId === 'village'
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                  }`}
                  title="Speak village name"
                >
                  <Mic className="w-3 h-3" />
                  <span>{isRecording && recordingId === 'village' ? 'Listening...' : 'Speak'}</span>
                </button>
              </div>
              <input
                type="text"
                name="village"
                value={formData.village}
                onChange={handleChange}
                placeholder={t('forms.villagePlaceholder') || 'e.g. Alnavar'}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Agricultural Parameters */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            3. {t('Agricultural & Crop Information')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.cropType') || 'Crop Name'} <span className="text-rose-500">*</span>
              </label>
              <select
                name="crop_type"
                value={formData.crop_type}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium"
              >
                {CROPS.map((cr) => (
                  <option key={cr} value={cr}>{t(cr) || cr}</option>
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
                {t('forms.cultivatedArea') || 'Cultivated Area (Acres)'} <span className="text-rose-500">*</span>
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
                {t('forms.growthStage') || 'Growth Stage'}
              </label>
              <select
                name="growth_stage"
                value={formData.growth_stage}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {STAGES.map((stg) => (
                  <option key={stg} value={stg}>{stg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.soilType') || 'Soil Type'}
              </label>
              <select
                name="soil_type"
                value={formData.soil_type}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {SOILS.map((soil) => (
                  <option key={soil} value={soil}>{soil}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.irrigationType') || 'Irrigation Source'}
              </label>
              <select
                name="irrigation_type"
                value={formData.irrigation_type}
                onChange={handleChange}
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {IRRIGATIONS.map((irr) => (
                  <option key={irr} value={irr}>{irr}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.sowingDate') || 'Sowing Date'}
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
                {t('forms.claimStartDate') || 'Damage Incident Date'}
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
                {t('forms.reportedLoss') || 'Reported Loss (%)'}
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

        {/* Section 4: Environmental & Remote Sensing Observations */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center gap-2">
            <CloudRain className="w-4 h-4 text-cyan-600" />
            4. {t('Environmental & Remote Sensing Evidence')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.observedRainfall') || 'Observed Rainfall (mm)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                name="observed_rainfall"
                value={formData.observed_rainfall}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.referenceRainfall') || 'Normal Rainfall (mm)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                name="reference_rainfall"
                value={formData.reference_rainfall}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.currentNdvi') || 'Current NDVI'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="current_ndvi"
                value={formData.current_ndvi}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('forms.referenceNdvi') || 'Reference NDVI'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="reference_ndvi"
                value={formData.reference_ndvi}
                onChange={handleChange}
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

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
              placeholder={t('forms.lossDescriptionPlaceholder') || 'Describe drought, flood, pest, unseasonal rain, or crop damage...'}
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
