import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Claim } from '../types';
import {
  FileText,
  Download,
  Search,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchClaims = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getClaims({ limit: 100, search: search.trim() || undefined });
      setClaims(res.items);
    } catch (err: any) {
      setError(err.message || 'Failed to load claims for reporting');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchClaims();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Claim Assessment Reports & Export Center</h2>
        <p className="text-xs text-slate-500">
          Generate official PDF decision-support reports and tabular analytical CSV exports for assessed farmer claims.
        </p>
      </div>

      {/* Official Disclaimer Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Official Statutory Disclaimer</p>
          <p className="leading-relaxed text-amber-800">
            "This report provides machine-learning decision support. It is not an official insurance approval, rejection, or guaranteed payout determination.
            Final decisions must follow the applicable insurance policy, verified evidence, and authorised review procedures."
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by claim reference or farmer name..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition"
        >
          Search
        </button>
      </form>

      {/* Reports Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-800">Available Claim Reports ({claims.length})</span>
          <button onClick={fetchClaims} className="text-agri-600 hover:underline">Refresh</button>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-3 border-agri-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading reports list...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No claims available to report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Claim Ref</th>
                  <th className="py-3 px-4">Farmer Details</th>
                  <th className="py-3 px-4">Crop & Season</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4 text-right">Available Downloads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {claims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      {claim.claim_reference}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-800">{claim.farmer_name}</p>
                      <p className="text-[11px] text-slate-400">{claim.district}, {claim.state}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">{claim.crop_type}</span>
                      <span className="text-[11px] text-slate-400 block">{claim.season} • {claim.cultivated_area} ha</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {claim.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <a
                        href={api.getExportCsvUrl(claim.id)}
                        download
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" /> Export CSV
                      </a>
                      <a
                        href={api.getReportPdfUrl(claim.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-agri-600 hover:bg-agri-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Download PDF Report
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

