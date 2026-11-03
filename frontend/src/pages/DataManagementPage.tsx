import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ImportedDataset } from '../types';
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Table,
  Layers,
  Sparkles,
  Info,
  Eye,
  X
} from 'lucide-react';

export const DataManagementPage: React.FC = () => {
  const [datasets, setDatasets] = useState<ImportedDataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<ImportedDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Historical Claims');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDatasets = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDatasets();
      setDatasets(res);
      if (res.length > 0 && !selectedDataset) {
        loadDatasetDetails(res[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch datasets');
    } finally {
      setLoading(false);
    }
  };

  const loadDatasetDetails = async (id: number) => {
    try {
      const details = await api.getDatasetDetails(id);
      setSelectedDataset(details);
    } catch (err: any) {
      alert(`Failed to load dataset details: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!uploadName) {
        setUploadName(e.target.files[0].name.replace('.csv', ''));
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Please select a CSV file to upload.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      await api.uploadDataset(file, uploadName, uploadCategory);
      setSuccess(`Dataset '${uploadName || file.name}' uploaded and inspected successfully.`);
      setFile(null);
      setUploadName('');
      fetchDatasets();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload dataset');
    } finally {
      setUploading(false);
    }
  };

  const handleSeedDemo = async () => {
    try {
      setLoading(true);
      const res = await api.loadDemoDataset(200);
      setSuccess(`Generated benchmark dataset with ${res.rows_generated} records.`);
      fetchDatasets();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Claim Records & Data Management</h2>
          <p className="text-xs text-slate-500">
            Import, inspect, prepare, and validate agricultural weather and claim records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.getTemplateDownloadUrl()}
            download
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download CSV Template
          </a>
          <button
            onClick={handleSeedDemo}
            className="flex items-center gap-1.5 px-3 py-2 bg-agri-600 hover:bg-agri-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <Sparkles className="w-3.5 h-3.5" /> Generate Benchmark Data
          </button>
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

      {/* Upload Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-agri-600" />
          Upload New CSV Dataset
        </h3>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              required
              className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 border border-slate-300 rounded-lg p-1"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Dataset Name</label>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. Maharashtra Kharif 2025"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Data Category</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
            >
              <option value="Historical Claims">Historical Claims</option>
              <option value="Weather Observations">Weather Observations</option>
              <option value="Satellite Vegetation (NDVI)">Satellite Vegetation (NDVI)</option>
              <option value="Soil Moisture Records">Soil Moisture Records</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition disabled:opacity-50"
          >
            {uploading ? 'Processing & Validating...' : 'Upload & Inspect'}
          </button>
        </form>
      </div>

      {/* Datasets Table & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Datasets List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden space-y-3">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Available Datasets</h3>
            <span className="text-xs text-slate-500">{datasets.length} Total</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {datasets.map((ds) => (
              <div
                key={ds.id}
                onClick={() => loadDatasetDetails(ds.id)}
                className={`p-3.5 text-xs cursor-pointer transition flex items-center justify-between ${
                  selectedDataset?.id === ds.id ? 'bg-agri-50/70 border-l-4 border-agri-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-800">{ds.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {ds.row_count} rows • {ds.column_count} columns • {ds.category}
                  </p>
                </div>
                {ds.is_synthetic && (
                  <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                    SYNTHETIC
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Dataset Inspector */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          {selectedDataset ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedDataset.name}</h3>
                  <p className="text-xs text-slate-500">
                    Source: {selectedDataset.source} • Category: {selectedDataset.category} • Created: {new Date(selectedDataset.created_at).toLocaleDateString()}
                  </p>
                </div>
                {selectedDataset.is_synthetic && (
                  <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                    Synthetic Demonstration Data
                  </span>
                )}
              </div>

              {/* Quality & Column Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-500">Total Rows</span>
                  <p className="text-base font-bold text-slate-800">{selectedDataset.row_count}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-500">Detected Columns</span>
                  <p className="text-base font-bold text-slate-800">{selectedDataset.column_count}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <span className="text-slate-500">Target Labels Available</span>
                  <p className="text-base font-bold text-emerald-700">
                    {selectedDataset.quality_summary?.has_target_column ? 'Yes (Trainable)' : 'No'}
                  </p>
                </div>
              </div>

              {/* Data Preview Table */}
              {selectedDataset.preview && selectedDataset.preview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700">Dataset Preview (First 10 Rows):</h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-64">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 border-b border-slate-200">
                        <tr>
                          {Object.keys(selectedDataset.preview[0]).map((col) => (
                            <th key={col} className="py-2 px-3 whitespace-nowrap">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedDataset.preview.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-slate-50/70">
                            {Object.values(row).map((val: any, cIdx) => (
                              <td key={cIdx} className="py-1.5 px-3 whitespace-nowrap text-slate-700">
                                {String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-xs text-slate-400">
              <Database className="w-8 h-8 text-slate-300 mb-2" />
              <p>Select a dataset from the left panel to inspect columns, data quality, and preview rows.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

