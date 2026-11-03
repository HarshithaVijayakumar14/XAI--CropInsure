import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TrainedModel } from '../types';
import {
  Brain,
  Sparkles,
  Info,
  ShieldAlert,
  HelpCircle,
  BarChart3,
  TrendingUp,
  Layers,
  CloudRain,
  Activity,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const ExplainabilityPage: React.FC = () => {
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(undefined);
  const [globalImportance, setGlobalImportance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getModels().then((res) => {
      setModels(res);
      const active = res.find((m) => m.is_active);
      const defaultId = active ? active.id : res.length > 0 ? res[0].id : undefined;
      setSelectedModelId(defaultId);
      if (defaultId) {
        loadGlobalExplanation(defaultId);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  const loadGlobalExplanation = async (modelId: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGlobalExplanations(modelId);
      setGlobalImportance(res.feature_importance);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate global SHAP explanations');
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = parseInt(e.target.value, 10);
    setSelectedModelId(modelId);
    loadGlobalExplanation(modelId);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-agri-900 to-slate-900 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg bg-agri-500/20 border border-agri-400/30 flex items-center justify-center text-agri-400">
            <Brain className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Main Reasons (XAI) & Transparency Hub</h2>
        </div>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          Grounding complex AI decisions in transparent, explainable factors.
          Understand how agricultural and weather variables influence claim assessments without black-box confusion.
        </p>
      </div>

      {/* Prominent Decision Support Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Important Decision Support Notice:</strong> The AI helps assess your claim. It does not make the final insurance decision. An authorized insurance officer reviews the evidence and makes the final decision.
        </div>
      </div>

      {/* Global Feature Importance Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-agri-600" />
              Main Reasons Influencing AI Decisions (Feature Importance)
            </h3>
            <p className="text-xs text-slate-500">
              How strongly each agricultural factor influenced the AI's assessments across claim records.
            </p>
          </div>

          {models.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Selected Model:</span>
              <select
                value={selectedModelId}
                onChange={handleModelChange}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.model_name} ({m.model_version}) {m.is_active ? '★' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-3 border-agri-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Computing genuine SHAP values across background samples...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            {error}
          </div>
        ) : globalImportance.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={globalImportance}
                margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                  formatter={(val: any) => [`${val}`, 'Mean |SHAP| Impact']}
                />
                <Bar dataKey="importance" fill="#15803d" radius={[0, 4, 4, 0]} name="Importance" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">
            No global SHAP data available. Train a model in Model Performance first.
          </div>
        )}
      </div>

      {/* Educational Walkthrough Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* What is SHAP? */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">How SHAP Works in Crop Insurance</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            SHAP (SHapley Additive exPlanations) is grounded in cooperative game theory. It treats each agro-climatic feature
            (such as rainfall deficit, NDVI vegetation vigor drop, and temperature anomaly) as a "player" in a coalition that produces
            the claim outcome.
          </p>
          <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-agri-600 shrink-0 mt-0.5" />
              <span><strong>Local Accuracy:</strong> The sum of all feature SHAP values plus the base reference value equals the model's exact output.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-agri-600 shrink-0 mt-0.5" />
              <span><strong>Directional Impact:</strong> Positive values push the assessment toward approval; negative values push toward rejection.</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-agri-600 shrink-0 mt-0.5" />
              <span><strong>Fair Distribution:</strong> Features that contribute more across all permutations receive proportionally higher magnitude.</span>
            </div>
          </div>
        </div>

        {/* Scientific Limitations & Ethics */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-rose-700">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="font-bold text-slate-800 text-sm">Scientific & Ethical Governance</h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            While SHAP provides transparent attribution, it must be interpreted responsibly by agricultural officers and assessors:
          </p>
          <ul className="space-y-2 text-xs text-slate-700 list-disc pl-5">
            <li>
              <strong>Attribution ≠ Causality:</strong> A high SHAP value indicates statistical contribution to the model's output, not physical proof of root rot or water stress in the field.
            </li>
            <li>
              <strong>No Automated Determinations:</strong> Machine-learning outputs must support, never replace, human review and Crop Cutting Experiment (CCE) data.
            </li>
            <li>
              <strong>Administrative Labels:</strong> Historical claim outcomes reflect past administrative processing and may contain inherent human biases.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

