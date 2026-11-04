import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AgriculturalYieldOptions, AgriculturalYieldResponse } from '../types';
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
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Cpu,
  BarChart3,
  HelpCircle,
  Activity
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
}

const PRESET_EXAMPLES = [
  {
    name: 'Karnataka Rice',
    desc: '2.5 Ha, Kharif season in Dharwad',
    data: { state: 'Karnataka', district: 'Dharwad', crop: 'Rice', season: 'Kharif', area: '2.5' }
  },
  {
    name: 'Punjab Wheat',
    desc: '4.0 Ha, Rabi season in Ludhiana',
    data: { state: 'Punjab', district: 'Ludhiana', crop: 'Wheat', season: 'Rabi', area: '4.0' }
  },
  {
    name: 'Maharashtra Sugarcane',
    desc: '1.5 Ha, Kharif season in Kolhapur',
    data: { state: 'Maharashtra', district: 'Kolhapur', crop: 'Sugarcane', season: 'Kharif', area: '1.5' }
  },
  {
    name: 'Gujarat Cotton',
    desc: '3.0 Ha, Kharif season in Rajkot',
    data: { state: 'Gujarat', district: 'Rajkot', crop: 'Cotton', season: 'Kharif', area: '3.0' }
  }
];

export const AgriculturalYieldPage: React.FC = () => {
  const { role, language, t } = useRole();
  const { speak, stopAudio, isPlaying, activeSpeechId } = useVoice();

  // Form State
  const [form, setForm] = useState<FormState>({
    state: 'Karnataka',
    district: 'Dharwad',
    crop: 'Rice',
    season: 'Kharif',
    area: '2.5'
  });

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
    setForm((prev) => ({ ...prev, [name]: value }));
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
      const res = await api.predictCropYield({
        state: form.state.trim(),
        district: form.district.trim(),
        crop: form.crop.trim(),
        season: form.season.trim(),
        area: areaNum
      });
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
      area: '2.5'
    });
    setResult(null);
    setError(null);
  };

  // Prepare chart data for SHAP waterfall / horizontal bars
  const chartData = result
    ? result.shap_explanation.feature_contributions.map((c) => ({
        feature: c.feature,
        label: `${c.feature} (${c.input_value})`,
        shap_value: c.shap_value,
        direction: c.direction,
        impact: c.impact_description
      }))
    : [];

  // Audio explanation text
  const audioText = result
    ? `Agricultural Crop Yield Prediction Result. Estimated harvest yield for ${form.crop} in ${form.district}, ${form.state} is ${result.predicted_yield_tonnes_per_ha} Tonnes per Hectare. Total expected production is ${result.predicted_total_production_tonnes} Tonnes across ${form.area} hectares. ${result.shap_explanation.plain_text_summary} Please note: This prediction is an estimate based on historical agricultural data and is not an insurance claim decision.`
    : '';

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
              <Sprout className="w-3.5 h-3.5" />
              Agronomic Decision Support
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Agricultural Crop Yield Predictor
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-2 leading-relaxed">
              Estimate expected harvest yield (Tonnes / Ha) using a genuine machine learning model trained on 331,653 historical Indian crop production records (APY 1997–2020), with transparent SHAP feature explanations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {result && (
              <SpeakButton
                id="agri-yield-audio"
                text={audioText}
                lang={language}
                label="Listen to Prediction"
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
            <span className="font-bold text-amber-300">Important Advisory & Legal Distinction: </span>
            This tool provides agronomic yield estimates based solely on historical Indian production statistics. It is kept strictly independent from the insurance claim approval/rejection pipeline. Yield predictions do <strong>not</strong> constitute an insurance claim approval, rejection, or compensation decision under PMFBY.
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
                Quick-Test Presets
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
              <input
                type="text"
                name="district"
                value={form.district}
                onChange={handleChange}
                placeholder="e.g. Dharwad, Ludhiana, Kolhapur"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Enter district name. The model handles novel or variation spellings automatically.
              </p>
            </div>

            {/* Crop Input */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5 text-amber-400" />
                Crop Type
              </label>
              {options && options.crops.length > 0 ? (
                <select
                  name="crop"
                  value={form.crop}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  required
                >
                  {options.crops.map((cr) => (
                    <option key={cr} value={cr}>
                      {cr}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="crop"
                  value={form.crop}
                  onChange={handleChange}
                  placeholder="e.g. Rice, Wheat, Sugarcane"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              )}
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
                  <span>Computing Prediction & SHAP...</span>
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
                  Trained Model Specifications
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                  {options.model_metadata.model_version}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-400 text-[11px] block">Algorithm</span>
                  <span className="font-semibold text-slate-200">{options.model_metadata.algorithm}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Variable</span>
                  <span className="font-semibold text-slate-200">Yield (Tonnes / Ha)</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Test R² Score</span>
                  <span className="font-semibold text-emerald-400">
                    {(options.model_metadata.r2_score * 100).toFixed(2)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Test MAE / RMSE</span>
                  <span className="font-semibold text-slate-200">
                    {options.model_metadata.mae.toFixed(2)} / {options.model_metadata.rmse.toFixed(2)} T/Ha
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Clean Training Records</span>
                  <span className="font-semibold text-slate-200">
                    {options.model_metadata.train_records.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Target Leakage Protection</span>
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
              {/* Hero Prediction Result Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
                      Estimated Harvest Output
                    </span>
                    <h2 className="text-lg font-bold text-white mt-0.5">
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
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-5">
                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Total Production</span>
                    <span className="text-lg font-bold text-white mt-0.5 block">
                      {result.predicted_total_production_tonnes}{' '}
                      <span className="text-xs text-slate-400 font-normal">Tonnes</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {result.predicted_yield_tonnes_per_ha} T/Ha × {result.cultivated_area_ha} Ha
                    </span>
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                    <span className="text-[11px] text-slate-400 block">Historical National Baseline</span>
                    <span className="text-lg font-bold text-slate-200 mt-0.5 block">
                      {result.baseline_mean_yield}{' '}
                      <span className="text-xs text-slate-400 font-normal">T/Ha</span>
                    </span>
                    <span className="text-[10px] text-slate-400">APY all-crop Indian mean</span>
                  </div>

                  <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-slate-400 block">Variance from Baseline</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {result.difference_from_baseline >= 0 ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span className="text-lg font-bold text-emerald-400">
                            +{result.difference_from_baseline}
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-4 h-4 text-amber-400" />
                          <span className="text-lg font-bold text-amber-400">
                            {result.difference_from_baseline}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-slate-400 font-normal">T/Ha</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Net SHAP push</span>
                  </div>
                </div>

                {/* Plain-Language Explanation */}
                <div className="mt-5 p-4 rounded-xl bg-slate-800/80 border border-slate-700/70 text-xs leading-relaxed text-slate-200">
                  <div className="font-bold text-white flex items-center gap-1.5 mb-1 text-sm">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Plain-Language Explanation
                  </div>
                  <p>{result.shap_explanation.plain_text_summary}</p>
                </div>

                {/* Warnings or Unknown Notice if any */}
                {result.warnings && result.warnings.length > 0 && (
                  <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Data Baseline Notices
                    </div>
                    {result.warnings.map((w, idx) => (
                      <p key={idx} className="text-[11px] text-amber-200/90 pl-5">
                        • {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* SHAP Feature Contribution Waterfall / Bar Chart */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                      SHAP Feature Attribution (TreeExplainer)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Shows how each specific input shifted the prediction away from the {result.baseline_mean_yield} T/Ha baseline.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Increased Yield (+)
                    </span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Decreased Yield (-)
                    </span>
                  </div>
                </div>

                {/* Horizontal Bar Chart */}
                <div className="h-64 w-full">
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
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={{ fill: '#e2e8f0', fontSize: 11 }}
                        width={140}
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
                            fill={entry.shap_value >= 0 ? '#10b981' : '#f59e0b'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Contribution Breakdown Cards */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-300 block mb-1">
                    Detailed Feature Influence Breakdown:
                  </span>
                  {result.shap_explanation.feature_contributions.map((feat) => {
                    const isPos = feat.shap_value > 0.01;
                    const isNeg = feat.shap_value < -0.01;
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
                              isPos ? 'text-emerald-400' : isNeg ? 'text-amber-400' : 'text-slate-400'
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
            </>
          ) : (
            /* Empty State / Prompt to Run */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Sprout className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">
                  Ready to Predict Agricultural Yield
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Enter your farm location, crop, season, and cultivated hectares on the left (or pick one of the quick presets), then click <strong>"Predict Expected Crop Yield"</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePredict()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Run Default Example (Karnataka Rice)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

