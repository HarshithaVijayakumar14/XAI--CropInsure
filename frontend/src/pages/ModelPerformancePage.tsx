import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { TrainedModel, ImportedDataset } from '../types';
import {
  Cpu,
  Brain,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  BarChart,
  ShieldCheck,
  Award,
  Layers,
  Info
} from 'lucide-react';

const FEATURE_OPTIONS = [
  { id: 'rainfall_deficit', label: 'Rainfall Deficit (mm)' },
  { id: 'relative_rainfall_deficit', label: 'Relative Rainfall Deficit (%)' },
  { id: 'ndvi_change', label: 'NDVI Vegetation Change' },
  { id: 'temperature_anomaly', label: 'Temperature Anomaly (°C)' },
  { id: 'soil_moisture', label: 'Soil Moisture (%)' },
  { id: 'cultivated_area', label: 'Cultivated Area (Hectares)' },
  { id: 'crop_type', label: 'Crop Type' },
  { id: 'season', label: 'Crop Season' }
];

export const ModelPerformancePage: React.FC = () => {
  const [models, setModels] = useState<TrainedModel[]>([]);
  const [datasets, setDatasets] = useState<ImportedDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | undefined>(undefined);
  const [taskType, setTaskType] = useState<'classification' | 'regression'>('classification');
  const [algorithm, setAlgorithm] = useState('Random Forest');
  const [targetColumn, setTargetColumn] = useState('historical_outcome');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(FEATURE_OPTIONS.map((f) => f.id));
  const [testSize, setTestSize] = useState(0.2);

  const [training, setTraining] = useState(false);
  const [selectedModel, setSelectedModel] = useState<TrainedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [modelsRes, dsRes] = await Promise.all([
        api.getModels(),
        api.getDatasets(),
      ]);
      setModels(modelsRes);
      setDatasets(dsRes);

      if (dsRes.length > 0 && !selectedDatasetId) {
        setSelectedDatasetId(dsRes[0].id);
      }
      if (modelsRes.length > 0 && !selectedModel) {
        const active = modelsRes.find((m) => m.is_active) || modelsRes[0];
        setSelectedModel(active);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load models data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTaskTypeChange = (type: 'classification' | 'regression') => {
    setTaskType(type);
    if (type === 'classification') {
      setAlgorithm('Random Forest');
      setTargetColumn('historical_outcome');
    } else {
      setAlgorithm('Random Forest Regressor');
      setTargetColumn('payout_amount');
    }
  };

  const handleFeatureToggle = (featId: string) => {
    if (selectedFeatures.includes(featId)) {
      if (selectedFeatures.length <= 2) {
        alert("At least 2 features are required.");
        return;
      }
      setSelectedFeatures(selectedFeatures.filter((f) => f !== featId));
    } else {
      setSelectedFeatures([...selectedFeatures, featId]);
    }
  };

  const handleTrain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDatasetId) {
      alert("Please select a training dataset.");
      return;
    }

    try {
      setTraining(true);
      setError(null);
      const trained = await api.trainModel({
        dataset_id: selectedDatasetId,
        task_type: taskType,
        algorithm: algorithm,
        target_column: targetColumn,
        features: selectedFeatures,
        test_size: testSize,
        model_name: `${algorithm} (${taskType.charAt(0).toUpperCase() + taskType.slice(1)})`
      });

      setSuccess(`Model ${trained.model_version} trained successfully with held-out validation!`);
      await fetchData();
      setSelectedModel(trained);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Model training failed');
    } finally {
      setTraining(false);
    }
  };

  const handleActivate = async (modelId: number) => {
    try {
      await api.activateModel(modelId);
      await fetchData();
      setSuccess("Active model updated for decision support assessments.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      alert(`Failed to activate model: ${err.message}`);
    }
  };

  const metricsObj = selectedModel ? JSON.parse(selectedModel.metrics_json || '{}') : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">How Well the AI Performs</h2>
        <p className="text-xs text-slate-500">
          Inspect model accuracy, evaluate agricultural risk classifiers, and check how reliably the AI assesses claims.
        </p>
      </div>

      {/* Decision Support Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 leading-relaxed">
          <strong>Important Decision Support Notice:</strong> The AI helps assess your claim. It does not make the final insurance decision. An authorized insurance officer reviews the evidence and makes the final decision.
        </div>
      </div>

      {success && (
        <div className="p-3 bg-agri-50 border border-agri-200 rounded-lg text-xs text-agri-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-agri-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Training Workbench Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-agri-600" />
              Model Training Workbench
            </h3>
            <p className="text-xs text-slate-500">
              Pipeline trains exclusively on training fold with median imputation and scaling; evaluated on held-out test set.
            </p>
          </div>

          {/* Task Type Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleTaskTypeChange('classification')}
              className={`px-3 py-1.5 rounded-md transition ${
                taskType === 'classification' ? 'bg-white text-agri-800 shadow-2xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Task A: Claim Category (Classification)
            </button>
            <button
              type="button"
              onClick={() => handleTaskTypeChange('regression')}
              className={`px-3 py-1.5 rounded-md transition ${
                taskType === 'regression' ? 'bg-white text-agri-800 shadow-2xs' : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Task B: Payout Amount Estimation
            </button>
          </div>
        </div>

        <form onSubmit={handleTrain} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Training Claim Records (Dataset)</label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(parseInt(e.target.value, 10))}
                required
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
              >
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.row_count} rows) {ds.is_synthetic ? '• Synthetic' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Algorithm Selection</label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
              >
                {taskType === 'classification' ? (
                  <>
                    <option value="Random Forest">Random Forest Classifier (Interpretable Ensemble)</option>
                    <option value="Gradient Boosting">Gradient Boosting Classifier</option>
                    <option value="Decision Tree">Decision Tree Classifier</option>
                    <option value="Logistic Regression">Logistic Regression (Linear Baseline)</option>
                  </>
                ) : (
                  <>
                    <option value="Random Forest Regressor">Random Forest Regressor</option>
                    <option value="Gradient Boosting Regressor">Gradient Boosting Regressor</option>
                    <option value="Linear Regression">Linear Regression (Baseline)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Held-Out Test Size ({(testSize * 100).toFixed(0)}%)
              </label>
              <input
                type="range"
                min="0.1"
                max="0.4"
                step="0.05"
                value={testSize}
                onChange={(e) => setTestSize(parseFloat(e.target.value))}
                className="w-full accent-agri-600 cursor-pointer mt-2"
              />
            </div>
          </div>

          {/* Feature Checkboxes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Features for Pipeline:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FEATURE_OPTIONS.map((feat) => {
                const isSelected = selectedFeatures.includes(feat.id);
                return (
                  <button
                    type="button"
                    key={feat.id}
                    onClick={() => handleFeatureToggle(feat.id)}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-agri-50/80 border-agri-300 text-agri-900 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {feat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={training || datasets.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-agri-600 hover:bg-agri-700 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
            >
              {training ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" /> Training Model Pipeline...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> Train Model & Validate
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Models Registry & Evaluation Report Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Registry List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Trained Model Registry</h3>
            <span className="text-xs text-slate-500">{models.length} Models</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {models.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m)}
                className={`p-3.5 text-xs cursor-pointer transition flex items-center justify-between ${
                  selectedModel?.id === m.id ? 'bg-agri-50/70 border-l-4 border-agri-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-slate-800">{m.model_name}</p>
                    {m.is_active && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Version: {m.model_version} • {m.task_type} • {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Selected Model Evaluation Report Card */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          {selectedModel ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-800">{selectedModel.model_name}</h3>
                    <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {selectedModel.model_version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Algorithm: {selectedModel.algorithm} • Target: {selectedModel.target_column} • Dataset: {selectedModel.dataset_name || 'N/A'}
                  </p>
                </div>

                {!selectedModel.is_active && (
                  <button
                    onClick={() => handleActivate(selectedModel.id)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Set as Active Model
                  </button>
                )}
              </div>

              {/* Evaluation Metrics Grid */}
              {metricsObj && selectedModel.task_type === 'classification' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-500">Held-Out Accuracy</span>
                      <p className="text-xl font-bold text-slate-800">
                        {(metricsObj.accuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-500">Precision (Approved)</span>
                      <p className="text-xl font-bold text-slate-800">
                        {(metricsObj.precision * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-500">Recall (Approved)</span>
                      <p className="text-xl font-bold text-slate-800">
                        {(metricsObj.recall * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                      <span className="text-slate-500">F1 Score</span>
                      <p className="text-xl font-bold text-emerald-700">
                        {metricsObj.f1_score?.toFixed(3)}
                      </p>
                    </div>
                  </div>

                  {/* Confusion Matrix Display */}
                  {metricsObj.confusion_matrix && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <h4 className="text-xs font-bold text-slate-700">Held-Out Test Results (Confusion Matrix):</h4>
                      <div className="grid grid-cols-2 gap-2 max-w-lg text-center text-xs">
                        <div className="bg-white p-2.5 rounded border border-slate-200">
                          <span className="text-[10px] text-slate-500 block font-medium">Correctly Flagged as Rejected</span>
                          <span className="font-bold text-slate-800 text-base">{metricsObj.confusion_matrix[0][0]}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-rose-200 bg-rose-50/20">
                          <span className="text-[10px] text-rose-600 block font-medium">Incorrectly Flagged as Approved/Eligible</span>
                          <span className="font-bold text-rose-700 text-base">{metricsObj.confusion_matrix[0][1]}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-amber-200 bg-amber-50/20">
                          <span className="text-[10px] text-amber-600 block font-medium">Incorrectly Flagged as Not Approved/Eligible</span>
                          <span className="font-bold text-amber-700 text-base">{metricsObj.confusion_matrix[1][0]}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded border border-emerald-200 bg-emerald-50/20">
                          <span className="text-[10px] text-emerald-600 block font-medium">Correctly Flagged as Approved</span>
                          <span className="font-bold text-emerald-700 text-base">{metricsObj.confusion_matrix[1][1]}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        "Incorrectly Flagged as Approved/Eligible" means the AI recommended approval for a claim that was rejected historically. "Incorrectly Flagged as Not Approved/Eligible" means the AI recommended rejection for a claim that was approved. <strong>The AI assists assessors; human officers make all final claim determinations.</strong>
                      </p>
                    </div>
                  )}
                </div>
              ) : metricsObj ? (
                /* Regression Metrics */
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500">Mean Absolute Error (MAE)</span>
                    <p className="text-xl font-bold text-slate-800">₹{metricsObj.mae?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500">Root Mean Squared Error (RMSE)</span>
                    <p className="text-xl font-bold text-slate-800">₹{metricsObj.rmse?.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                    <span className="text-slate-500">R-Squared (R²)</span>
                    <p className="text-xl font-bold text-emerald-700">{metricsObj.r2_score?.toFixed(3)}</p>
                  </div>
                </div>
              ) : null}

              {/* Governance & Subgroup Notice */}
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Model Governance Notice:</p>
                <p>
                  {selectedModel.is_synthetic_trained
                    ? "Trained on synthetic demonstration data. Results represent illustrative benchmarks and cannot establish real-world clinical or operational efficacy."
                    : "Trained on imported historical claims data."}
                  {' '}Subgroup performance variations (crop-specific, state-specific) must be considered prior to field deployment.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-xs text-slate-400">
              <Cpu className="w-8 h-8 text-slate-300 mb-2" />
              <p>Select a model from the registry to inspect held-out evaluation metrics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
