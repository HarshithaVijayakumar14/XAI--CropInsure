import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { AuditEvent } from '../types';
import {
  History,
  ShieldCheck,
  User,
  Clock,
  Filter,
  CheckCircle2,
  FileText,
  AlertCircle
} from 'lucide-react';

export const AuditHistoryPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchAuditEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getAllAudit(150);
      setEvents(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, []);

  const filteredEvents = eventFilter
    ? events.filter((ev) => ev.event_type === eventFilter)
    : events;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">System Audit Trail & Review Log</h2>
          <p className="text-xs text-slate-500">
            Immutable chronological record of model inferences, dataset imports, human assessor reviews, and status changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-agri-500 focus:outline-none bg-white"
          >
            <option value="">All Event Types</option>
            <option value="CLAIM_CREATED">CLAIM_CREATED</option>
            <option value="CLAIM_UPDATED">CLAIM_UPDATED</option>
            <option value="ASSESSMENT_RUN">ASSESSMENT_RUN</option>
            <option value="HUMAN_REVIEW_RECORDED">HUMAN_REVIEW_RECORDED</option>
            <option value="DATASET_IMPORTED">DATASET_IMPORTED</option>
            <option value="MODEL_TRAINED">MODEL_TRAINED</option>
            <option value="REPORT_DOWNLOADED">REPORT_DOWNLOADED</option>
          </select>
          <button
            onClick={fetchAuditEvents}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-800">
            Recorded System Events ({filteredEvents.length})
          </span>
          <span className="text-[11px] text-slate-400">Chronological • Append-Only</span>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-3 border-agri-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-400">Loading audit trail...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No audit events found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Workflow Transition</th>
                  <th className="py-3 px-4">Action Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {ev.actor}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {ev.previous_status && ev.new_status ? (
                        <span>
                          <span className="line-through text-slate-400">{ev.previous_status}</span> → <span className="font-semibold text-slate-700">{ev.new_status}</span>
                        </span>
                      ) : (
                        <span>{ev.new_status || '—'}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md">
                      {ev.details}
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

