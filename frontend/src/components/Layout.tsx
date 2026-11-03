import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { AlertTriangle, Info } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  pageTitle: string;
  isDemoData?: boolean;
  onRefresh?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  pageTitle,
  isDemoData = true,
  onRefresh
}) => {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar pageTitle={pageTitle} onDemoLoaded={onRefresh} />

        {/* Persistent Demonstration Data Banner */}
        {isDemoData && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>DEMO DATA — Illustrative records, not real farmer claims.</strong> Benchmarks demonstrate Explainable AI workflows under simulated Indian agro-climatic conditions.
              </span>
            </div>
            <span className="hidden md:inline-block text-[11px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-mono">
              Research Prototype
            </span>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

