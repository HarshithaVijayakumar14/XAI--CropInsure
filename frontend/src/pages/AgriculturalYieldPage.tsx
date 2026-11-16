import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  AgriculturalYieldOptions,
  AgriculturalYieldCrop,
  AgriculturalYieldResponse
} from '../types';
import { useRole } from '../context/RoleContext';
import { useVoice } from '../hooks/useVoice';
import { SpeakButton } from '../components/SpeakButton';
import {
  Sprout,
  Wheat,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Info,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  CheckCircle2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Scale,
  Cpu,
  BarChart3,
  HelpCircle,
  Activity,
  CloudRain,
  Thermometer,
  FlaskConical,
  Bug,
  ChevronDown,
  ChevronUp,
  Radio,
  FileCheck2,
  FileX2,
  Volume2,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Minus
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

interface FormState {
  state: string;
  district: string;
  crop: string;
  season: string;
  area: string;
  annual_rainfall: string;
  avg_temperature: string;
  fertilizer_per_ha: string;
  pesticide_per_ha: string;
}

const PRESET_EXAMPLES = [
  {
    name: 'Karnataka Rice (Healthy)',
    desc: '2.5 Ha, Kharif in Dharwad (Expected normal harvest)',
    data: {
      state: 'Karnataka',
      district: 'Dharwad',
      crop: 'Rice',
      season: 'Kharif',
      area: '2.5',
      annual_rainfall: '',
      avg_temperature: '',
      fertilizer_per_ha: '',
      pesticide_per_ha: ''
    }
  },
  {
    name: 'Punjab Wheat (High Output)',
    desc: '4.0 Ha, Rabi in Ludhiana (Intensive irrigated wheat)',
    data: {
      state: 'Punjab',
      district: 'Ludhiana',
      crop: 'Wheat',
      season: 'Rabi',
      area: '4.0',
      annual_rainfall: '',
      avg_temperature: '',
      fertilizer_per_ha: '',
      pesticide_per_ha: ''
    }
  },
  {
    name: 'Maharashtra Sugarcane',
    desc: '1.5 Ha, Kharif in Kolhapur (Cash crop high biomass)',
    data: {
      state: 'Maharashtra',
      district: 'Kolhapur',
      crop: 'Sugarcane',
      season: 'Kharif',
      area: '1.5',
      annual_rainfall: '',
      avg_temperature: '',
      fertilizer_per_ha: '',
      pesticide_per_ha: ''
    }
  },
  {
    name: 'Rajasthan Bajra (Drought Risk)',
    desc: '3.0 Ha, Kharif in Barmer (Deficit rain, shortfall risk)',
    data: {
      state: 'Rajasthan',
      district: 'Barmer',
      crop: 'Bajra',
      season: 'Kharif',
      area: '3.0',
      annual_rainfall: '280',
      avg_temperature: '32.0',
      fertilizer_per_ha: '30',
      pesticide_per_ha: '0.05'
    }
  }
];

export const AgriculturalYieldPage: React.FC = () => {
  const navigate = useNavigate();
  const { language, t } = useRole();
  const { speak, stopAudio, isPlaying, activeSpeechId } = useVoice();

  // Form State
  const [form, setForm] = useState<FormState>({
    state: 'Karnataka',
    district: 'Dharwad',
    crop: 'Rice',
    season: 'Kharif',
    area: '2.5',
    annual_rainfall: '',
    avg_temperature: '',
    fertilizer_per_ha: '',
    pesticide_per_ha: ''
  });

  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);

  // Metadata / options from backend
  const [options, setOptions] = useState<AgriculturalYieldOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Prediction State
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<AgriculturalYieldResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch available options and model metadata on mount
  useEffect(() => {
    let mounted = true;
    api.getCropYieldOptions()
      .then((res) => {
        if (mounted) {
          setOptions(res);
          setLoadingOptions(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load agricultural model options');
          setLoadingOptions(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Handle Form Change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // If state changes, adjust district to first available district in state if known
      if (name === 'state' && options?.districts_by_state && options.districts_by_state[value]?.length > 0) {
        next.district = options.districts_by_state[value][0];
      }
      return next;
    });
  };

  // Apply Preset
  const handleApplyPreset = (preset: typeof PRESET_EXAMPLES[0]) => {
    setForm(preset.data);
    setError(null);
  };

  // Submit Prediction
  const handlePredict = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const areaNum = parseFloat(form.area);
    if (isNaN(areaNum) || areaNum <= 0) {
      setError('Please enter a valid cultivated area greater than 0 hectares.');
      return;
    }
    if (!form.state.trim() || !form.district.trim() || !form.crop.trim()) {
      setError('Please fill in State, District, and Crop.');
      return;
    }

    try {
      setPredicting(true);
      setError(null);

      const payload: any = {
        state: form.state.trim(),
        district: form.district.trim(),
        crop: form.crop.trim(),
        season: form.season.trim(),
        area: areaNum
      };

      if (form.annual_rainfall.trim() !== '') {
        payload.annual_rainfall = parseFloat(form.annual_rainfall);
      }
      if (form.avg_temperature.trim() !== '') {
        payload.avg_temperature = parseFloat(form.avg_temperature);
      }
      if (form.fertilizer_per_ha.trim() !== '') {
        payload.fertilizer_per_ha = parseFloat(form.fertilizer_per_ha);
      }
      if (form.pesticide_per_ha.trim() !== '') {
        payload.pesticide_per_ha = parseFloat(form.pesticide_per_ha);
      }

      const res = await api.predictCropYield(payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Yield prediction failed');
    } finally {
      setPredicting(false);
    }
  };

  // Reset Form
  const handleReset = () => {
    setForm({
      state: 'Karnataka',
      district: 'Dharwad',
      crop: 'Rice',
      season: 'Kharif',
      area: '2.5',
      annual_rainfall: '',
      avg_temperature: '',
      fertilizer_per_ha: '',
      pesticide_per_ha: ''
    });
    setResult(null);
    setError(null);
  };

  // Auto-retrieved baseline preview for selected state and district
  const distKey = `${form.state}|${form.district}`;
  const regionalBaseline =
    options?.district_defaults?.[distKey] ||
    options?.state_defaults?.[form.state] || {
      Annual_Rainfall: 1150.0,
      Avg_Temp: 26.5,
      Fertilizer_per_ha: 140.0,
      Pesticide_per_ha: 0.45
    };

  // Prepare chart data for SHAP waterfall / horizontal bars
  const chartData = result
    ? result.shap_explanation.feature_contributions.map((c) => ({
        feature: c.feature,
        label: `${c.label} (${c.input_value})`,
        shap_value: c.shap_value,
        direction: c.direction,
        impact: c.impact_description
      }))
    : [];

  // Available crops list
  const cropNames: string[] = options?.crops
    ? options.crops.map((c) => (typeof c === 'string' ? c : (c as AgriculturalYieldCrop).crop_name))
    : ['Rice', 'Wheat', 'Maize', 'Sugarcane', 'Cotton', 'Soybean', 'Gram'];

  // Available districts for current state
  const currentDistricts: string[] =
    options?.districts_by_state?.[form.state] || [form.district];

  // Selected crop info if available
  const selectedCropObj = options?.crops?.find(
    (c) => typeof c !== 'string' && (c as AgriculturalYieldCrop).crop_name === form.crop
  ) as AgriculturalYieldCrop | undefined;

  // Audio explanation text
  const audioText = result ? result.farmer_friendly_explanation : '';

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sprout className="w-3.5 h-3.5" />
              Agronomic Decision Support & Insurance Indication
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Agricultural Crop Yield Predictor
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
              Assesses expected crop yield (Tonnes / Ha), total harvest production, and potential crop shortfall risk using an upgraded dual Random Forest model trained on 310,813 harmonized Indian district records (APY 1997–2020), IMD annual rainfall, and agricultural input consumption with genuine SHAP explainability.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {result && (
              <SpeakButton
                id="agri-yield-audio"
                text={audioText}
                lang={language}
                label="Listen in Voice"
                activeId={activeSpeechId}
                isPlaying={isPlaying}
                onSpeak={speak}
                onStop={stopAudio}
                size="md"
              />
            )}
            <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-right">
              <div className="text-[11px] text-slate-400 font-medium">Model Registered</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 justify-end">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Model ID 2 (Inactive for Claims)
              </div>
            </div>
          </div>
        </div>

        {/* Advisory / Disclaimer Strip */}
        <div className="mt-5 p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-start gap-3 text-amber-200 text-xs leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Statutory Insurance Notice & Legal Distinction: </span>
            This tool provides agronomic yield estimates and preliminary crop shortfall indications based on historical Indian agricultural datasets. It is operated completely independent from the official PMFBY claim adjudication engine (Model 1). Crop yield predictions do <strong>not</strong> constitute an official insurance claim approval, rejection, or compensation decision. Official claim settlements require statutory loss verification under PMFBY guidelines.
          </div>
        </div>
      </div>

      {/* Main Grid: Form Left, Output Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Preset Buttons */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Quick-Test Scenarios
              </span>
              <span className="text-[11px] text-slate-400">Click to fill</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_EXAMPLES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="p-2.5 rounded-xl bg-slate-800/70 hover:bg-emerald-950/50 hover:border-emerald-500/40 border border-slate-700/60 text-left transition group"
                >
                  <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition">
                    {preset.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                    {preset.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Input Form Card */}
          <form onSubmit={handlePredict} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                Farm & Crop Parameters
              </h2>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            </div>

            {/* State Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                State
              </label>
              {options && options.states.length > 0 ? (
                <select
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                >
                  {options.states.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="state"
                  value={form.state}
                  onChange={handleChange}
                  placeholder="e.g. Karnataka"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              )}
            </div>

            {/* District Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                District
              </label>
              {currentDistricts && currentDistricts.length > 1 ? (
                <select
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                >
                  {currentDistricts.map((dst) => (
                    <option key={dst} value={dst}>
                      {dst}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="district"
                  value={form.district}
                  onChange={handleChange}
                  placeholder="e.g. Dharwad, Ludhiana, Kolhapur"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                />
              )}
            </div>

            {/* Crop Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Wheat className="w-3.5 h-3.5 text-amber-400" />
                  Crop Type
                </label>
                {selectedCropObj && (
                  <span className="text-[10px] text-emerald-400 font-mono">
                    Median: {selectedCropObj.historical_median_yield.toFixed(2)} T/Ha | Shortfall: &lt;{selectedCropObj.shortfall_threshold.toFixed(2)} T/Ha
                  </span>
                )}
              </div>
              <select
                name="crop"
                value={form.crop}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                required
              >
                {cropNames.map((cr) => (
                  <option key={cr} value={cr}>
                    {cr}
                  </option>
                ))}
              </select>
            </div>

            {/* Season and Area Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Season */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  Season
                </label>
                <select
                  name="season"
                  value={form.season}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                >
                  <option value="Kharif">Kharif (Monsoon)</option>
                  <option value="Rabi">Rabi (Winter)</option>
                  <option value="Whole Year">Whole Year</option>
                  <option value="Summer">Summer</option>
                  <option value="Autumn">Autumn</option>
                  <option value="Winter">Winter</option>
                </select>
              </div>

              {/* Cultivated Area */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Cultivated Area (Ha)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100000"
                  name="area"
                  value={form.area}
                  onChange={handleChange}
                  placeholder="e.g. 2.5"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                />
              </div>
            </div>

            {/* Regional Auto-Retrieved Baselines Pill */}
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  Regional Meteorological Baseline
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Auto-Retrieved</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-slate-400">
                <div>
                  Rainfall: <strong className="text-slate-200">{regionalBaseline.Annual_Rainfall} mm</strong>
                </div>
                <div>
                  Temperature: <strong className="text-slate-200">{regionalBaseline.Avg_Temp} °C</strong>
                </div>
                <div>
                  Fertilizer: <strong className="text-slate-200">{regionalBaseline.Fertilizer_per_ha} kg/ha</strong>
                </div>
                <div>
                  Pesticide: <strong className="text-slate-200">{regionalBaseline.Pesticide_per_ha} kg/ha</strong>
                </div>
              </div>
            </div>

            {/* Collapsible Advanced Weather & Input Overrides */}
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <button
                type="button"
                onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:text-white transition"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  Customize Weather & Inputs (Optional Overrides)
                </span>
                {showAdvancedInputs ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {showAdvancedInputs && (
                <div className="p-3.5 border-t border-slate-800 space-y-3 text-xs">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Leave blank to automatically use official historical IMD weather & state input averages, or enter local ground observations if available.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <CloudRain className="w-3 h-3 text-sky-400" />
                        Rainfall (mm)
                      </label>
                      <input
                        type="number"
                        name="annual_rainfall"
                        value={form.annual_rainfall}
                        onChange={handleChange}
                        placeholder={`e.g. ${regionalBaseline.Annual_Rainfall}`}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <Thermometer className="w-3 h-3 text-rose-400" />
                        Temperature (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        name="avg_temperature"
                        value={form.avg_temperature}
                        onChange={handleChange}
                        placeholder={`e.g. ${regionalBaseline.Avg_Temp}`}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <FlaskConical className="w-3 h-3 text-emerald-400" />
                        Fertilizer (kg/ha)
                      </label>
                      <input
                        type="number"
                        name="fertilizer_per_ha"
                        value={form.fertilizer_per_ha}
                        onChange={handleChange}
                        placeholder={`e.g. ${regionalBaseline.Fertilizer_per_ha}`}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                        <Bug className="w-3 h-3 text-amber-400" />
                        Pesticide (kg/ha)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="pesticide_per_ha"
                        value={form.pesticide_per_ha}
                        onChange={handleChange}
                        placeholder={`e.g. ${regionalBaseline.Pesticide_per_ha}`}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Remote sensing status indicator */}
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-[10px] text-slate-400">
              <Radio className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                <strong>Remote Sensing Context:</strong> Satellite NDVI is utilized during formal claim assessments in Model 1. Yield forecasting uses IMD meteorological & APY historical series.
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={predicting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
            >
              {predicting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating Dual Models & SHAP...</span>
                </>
              ) : (
                <>
                  <Sprout className="w-4 h-4" />
                  <span>Predict Expected Crop Yield</span>
                </>
              )}
            </button>
          </form>

          {/* Model Specs Card */}
          {options && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  Trained Model Specifications (v2 Engine)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                  {options.model_metadata.model_version}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-400 text-[11px] block">Architecture</span>
                  <span className="font-semibold text-slate-200">Dual Random Forest</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Training Records</span>
                  <span className="font-semibold text-slate-200">
                    {options.model_metadata.training_records?.toLocaleString() || '310,813'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Random Split R²</span>
                  <span className="font-semibold text-emerald-400">
                    {((options.model_metadata.regression_metrics?.random_split_r2 || options.model_metadata.r2_score || 0.9136) * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Temporal Split R² (2016-20)</span>
                  <span className="font-semibold text-emerald-400">
                    {((options.model_metadata.regression_metrics?.temporal_split_r2 || 0.8400) * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Classification F1 Score</span>
                  <span className="font-semibold text-emerald-400">
                    {((options.model_metadata.classification_metrics?.temporal_f1 || 0.8748) * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Leakage Check</span>
                  <span className="font-semibold text-emerald-400">Production Excluded</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Prediction Results & SHAP Explanations (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <>
              {/* SECTION A: Hero Prediction Card (Numerical Crop Yield) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                      Core Prediction 1 • Expected Harvest Output
                    </span>
                    <h2 className="text-xl font-bold text-white mt-0.5">
                      {form.crop} in {form.district}, {form.state}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {form.season} Season • {form.area} Hectares Cultivated
                    </p>
                  </div>

                  <div className="text-right bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-4 py-2.5">
                    <div className="text-[11px] text-emerald-300 font-medium">Predicted Yield</div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                      {result.predicted_yield_tonnes_per_ha}
                      <span className="text-xs text-emerald-300 font-semibold ml-1.5">T/Ha</span>
                    </div>
                    <div className="text-[11px] text-emerald-200/80 font-mono mt-0.5">
                      ≈ {result.predicted_yield_quintals_per_acre ?? (result.predicted_yield_tonnes_per_ha * 4.047).toFixed(2)} Quintals / Acre
                    </div>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Total Production</span>
                    <span className="text-base font-bold text-white mt-0.5 block">
                      {result.predicted_total_production_tonnes}{' '}
                      <span className="text-xs text-slate-400 font-normal">Tonnes</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ≈ {result.predicted_total_quintals ?? (result.predicted_total_production_tonnes * 10).toFixed(1)} Quintals
                    </span>
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Historical Median</span>
                    <span className="text-base font-bold text-slate-200 mt-0.5 block">
                      {result.crop_historical_median_yield}{' '}
                      <span className="text-xs text-slate-400 font-normal">T/Ha</span>
                    </span>
                    <span className="text-[10px] text-slate-400">APY reference baseline</span>
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Shortfall Threshold</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-base font-bold text-amber-400">
                        {result.crop_yield_threshold}
                      </span>
                      <span className="text-xs text-slate-400 font-normal">T/Ha</span>
                    </div>
                    <span className="text-[10px] text-slate-400">70% of crop median</span>
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Harvest Expectation</span>
                    <span className={`text-base font-bold mt-0.5 block ${result.yield_classification === 'YES' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {result.yield_classification_label}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(result.classification_probability * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              </div>

              {/* DEDICATED SECTION: AI Crop Insurance Eligibility Prediction */}
              <div
                className={`rounded-2xl p-6 shadow-sm border transition ${
                  result.predicted_insurance_eligibility === 'Likely Eligible for Insurance Claim'
                    ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/50'
                    : result.predicted_insurance_eligibility === 'Likely Not Eligible for Insurance Claim'
                    ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 border-slate-700'
                    : 'bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/50'
                }`}
              >
                {/* Header & Eligibility Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      AI Crop Insurance Eligibility Prediction
                    </span>
                    <h3 className="text-lg font-extrabold text-white mt-1">
                      Preliminary Claim Eligibility Indication
                    </h3>
                  </div>

                  <div>
                    {result.predicted_insurance_eligibility === 'Likely Eligible for Insurance Claim' ? (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20">
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        Likely Eligible for Insurance Claim
                      </span>
                    ) : result.predicted_insurance_eligibility === 'Likely Not Eligible for Insurance Claim' ? (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase bg-slate-800 border border-slate-600 text-slate-200 shadow-sm">
                        <XCircle className="w-4 h-4 text-slate-400" />
                        Likely Not Eligible for Insurance Claim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase bg-amber-500 text-slate-950 shadow-sm">
                        <AlertTriangle className="w-4 h-4 text-slate-950" />
                        Insufficient Information to Predict
                      </span>
                    )}
                  </div>
                </div>

                {/* Indication Detail Banner */}
                <div className="mt-4 p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs leading-relaxed space-y-1">
                  <div className="font-bold text-white text-sm">
                    {result.insurance_indication}
                  </div>
                  <p className="text-slate-300">
                    {result.insurance_indication_detail}
                  </p>
                </div>

                {/* Reasons Behind Prediction (Plain Farmer Language) */}
                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    Reasons Behind Prediction (Plain Language)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Supporting Factors */}
                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-emerald-900/40 space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Factors Supporting Claim (Stress / Deficit)
                      </div>
                      {result.reasons_supporting_claim && result.reasons_supporting_claim.length > 0 ? (
                        <ul className="space-y-1.5">
                          {result.reasons_supporting_claim.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No significant agronomic deficits detected for this scenario.</p>
                      )}
                    </div>

                    {/* Opposing Factors */}
                    <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2">
                      <div className="flex items-center gap-1.5 text-sky-400 font-bold text-[11px] uppercase tracking-wider">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Factors Indicating Crop Health / Favorable Yield
                      </div>
                      {result.reasons_against_claim && result.reasons_against_claim.length > 0 ? (
                        <ul className="space-y-1.5">
                          {result.reasons_against_claim.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-300 text-[11px] leading-relaxed">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No strong opposing factors noted; weather and yield point to risk.</p>
                      )}
                    </div>
                  </div>

                  {/* Neutral Factors if available */}
                  {result.neutral_factors && result.neutral_factors.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                      <Minus className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                      <div>
                        <strong className="text-slate-300">Neutral Baseline Conditions: </strong>
                        {result.neutral_factors.join(' • ')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Button: Apply for Insurance Claim */}
                <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-300">
                    <span className="font-semibold text-white block">Want to submit an insurance claim for this farm?</span>
                    <span className="text-[11px] text-slate-400">All entered farm and yield details will be automatically pre-filled.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/new-claim', {
                        state: {
                          fromPredictor: true,
                          state: form.state,
                          district: form.district,
                          crop: form.crop,
                          season: form.season,
                          area: form.area,
                          predicted_yield: result.predicted_yield_tonnes_per_ha,
                          predicted_total: result.predicted_total_production_tonnes,
                          predicted_eligibility: result.predicted_insurance_eligibility,
                          rainfall: form.annual_rainfall || result.environmental_inputs?.annual_rainfall_mm,
                          temperature: form.avg_temperature || result.environmental_inputs?.avg_temperature_c,
                          fertilizer: form.fertilizer_per_ha || result.environmental_inputs?.fertilizer_kg_per_ha,
                          pesticide: form.pesticide_per_ha || result.environmental_inputs?.pesticide_kg_per_ha
                        }
                      });
                    }}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-700/30 flex items-center justify-center gap-2 transition transform active:scale-98 cursor-pointer"
                  >
                    <span>Apply for Insurance Claim</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Statutory Disclaimer */}
                <div className="mt-3 text-[11px] text-slate-400 leading-relaxed italic border-t border-slate-800/60 pt-2.5">
                  <strong>Notice:</strong> This is a preliminary AI indication based on historical agricultural and meteorological datasets. It is NOT a guaranteed actual yield or insurance decision. Official claims are adjudicated independently under PMFBY guidelines by authorized officers.
                </div>
              </div>

              {/* SECTION F: Plain English Farmer Explanation with Audio */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    Plain-Language Farmer Explanation
                  </h3>
                  <SpeakButton
                    id="farmer-plain-audio"
                    text={result.farmer_friendly_explanation}
                    lang={language}
                    label="Listen"
                    activeId={activeSpeechId}
                    isPlaying={isPlaying}
                    onSpeak={speak}
                    onStop={stopAudio}
                    size="sm"
                  />
                </div>
                <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs leading-relaxed text-slate-200">
                  <p>{result.farmer_friendly_explanation}</p>
                </div>
              </div>

              {/* SECTION E: Genuine SHAP Feature Attribution (TreeExplainer) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      Core Question 3 • Why Did The Model Give This Result? (SHAP Explainability)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Genuine SHAP TreeExplainer values showing the exact positive, negative, and neutral factors influencing this forecast.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Positive (+)
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /> Negative (-)
                    </span>
                  </div>
                </div>

                {/* Horizontal Bar Chart */}
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={chartData}
                      margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fill: '#e2e8f0', fontSize: 11 }}
                        width={180}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '0.75rem',
                          color: '#fff',
                          fontSize: '12px'
                        }}
                        formatter={(value: any, name: any, item: any) => [
                          `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(4)} Tonnes/Ha`,
                          item.payload.impact
                        ]}
                      />
                      <ReferenceLine x={0} stroke="#64748b" strokeWidth={1.5} />
                      <Bar dataKey="shap_value" radius={[4, 4, 4, 4]}>
                        {chartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.shap_value > 0.02
                                ? '#10b981'
                                : entry.shap_value < -0.02
                                ? '#f43f5e'
                                : '#64748b'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Contribution Breakdown Cards */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-300 block mb-1">
                    Individual Agro-Climatic Factor Drivers:
                  </span>
                  {result.shap_explanation.feature_contributions.map((feat) => {
                    const isPos = feat.shap_value > 0.02;
                    const isNeg = feat.shap_value < -0.02;
                    return (
                      <div
                        key={feat.feature}
                        className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{feat.label}</span>
                            <span className="text-[11px] font-normal text-slate-400">
                              (Value: <strong className="text-slate-200">{feat.input_value}</strong>)
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{feat.impact_description}</p>
                        </div>

                        <div className="text-right shrink-0 ml-3">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-slate-400'
                            }`}
                          >
                            {feat.shap_value > 0 ? '+' : ''}
                            {feat.shap_value.toFixed(4)}
                          </span>
                          <span className="text-[10px] text-slate-400 block">T/Ha</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Environmental Parameters Used Card */}
              {result.environmental_inputs && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm text-xs space-y-3">
                  <div className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                    <CloudRain className="w-4 h-4 text-sky-400" />
                    Environmental & Input Parameters Evaluated
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-slate-300">
                    <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-slate-400 text-[10px] block">Monsoon Rainfall</span>
                      <span className="font-bold text-white">{result.environmental_inputs.annual_rainfall_mm} mm</span>
                      <span className="text-[10px] text-slate-500 block truncate">{result.environmental_inputs.annual_rainfall_provenance}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-slate-400 text-[10px] block">Surface Temperature</span>
                      <span className="font-bold text-white">{result.environmental_inputs.avg_temperature_c} °C</span>
                      <span className="text-[10px] text-slate-500 block truncate">{result.environmental_inputs.avg_temperature_provenance}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-slate-400 text-[10px] block">Fertilizer Rate</span>
                      <span className="font-bold text-white">{result.environmental_inputs.fertilizer_kg_per_ha} kg/ha</span>
                      <span className="text-[10px] text-slate-500 block truncate">{result.environmental_inputs.fertilizer_provenance}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
                      <span className="text-slate-400 text-[10px] block">Plant Protection</span>
                      <span className="font-bold text-white">{result.environmental_inputs.pesticide_kg_per_ha} kg/ha</span>
                      <span className="text-[10px] text-slate-500 block truncate">{result.environmental_inputs.pesticide_provenance}</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty State / Prompt to Run */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Sprout className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">
                  Ready to Predict Agricultural Crop Yield
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Enter your farm location, crop, season, and cultivated hectares on the left (or pick one of the quick test presets), then click <strong>"Predict Expected Crop Yield"</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePredict()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run Default Scenario (Karnataka Rice)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
