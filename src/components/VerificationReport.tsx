import React from 'react';
import { CitationReport } from '../lib/types';
import { Award, Database, Coins, ShieldCheck, FileCheck, RefreshCw, XCircle } from 'lucide-react';

interface VerificationReportProps {
  report: CitationReport | undefined;
  isLoading: boolean;
}

export const VerificationReport: React.FC<VerificationReportProps> = ({ report, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-zinc-950/20 border border-zinc-900/60 rounded-3xl p-6 h-[280px] flex flex-col justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-zinc-800 rounded" />
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
        </div>
        <div className="grid grid-cols-2 gap-6 items-center flex-1 my-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-850 rounded w-2/3" />
            <div className="h-3 bg-zinc-850 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 h-10">
          <div className="bg-zinc-900 rounded-xl" />
          <div className="bg-zinc-900 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-zinc-950/10 border border-zinc-900 rounded-3xl p-6 text-center text-zinc-600 text-xs font-semibold uppercase tracking-wider h-[280px] flex items-center justify-center">
        No verification report compiled. Submit a query to see performance logs.
      </div>
    );
  }

  const getGaugeColor = (pct: number) => {
    if (pct >= 90) return 'stroke-emerald-500';
    if (pct >= 70) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  const getAccuracyGlow = (pct: number) => {
    if (pct >= 90) return 'shadow-emerald-glow';
    if (pct >= 70) return 'shadow-amber-glow';
    return 'shadow-red-glow';
  };

  return (
    <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-[320px] shadow-premium-soft transition-all duration-300 hover:border-zinc-800/80">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/[0.01] to-transparent rounded-bl-full pointer-events-none" />
      
      <div>
        <h3 className="text-zinc-200 font-semibold text-xs uppercase tracking-wider flex items-center gap-2 mb-5">
          <Award className="w-4 h-4 text-emerald-400" />
          Precedent Verification Report
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Accuracy Ring Gauge */}
          <div className={`flex flex-col items-center justify-center bg-zinc-900/10 border border-zinc-900/60 rounded-2xl p-4 relative ${getAccuracyGlow(report.accuracy_pct)}`}>
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-zinc-900/80"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className={`${getGaugeColor(report.accuracy_pct)} transition-all duration-1000 ease-out`}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - report.accuracy_pct / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-zinc-100 tracking-tight">
                  {report.accuracy_pct}%
                </span>
                <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-wider">
                  Accuracy
                </span>
              </div>
            </div>
            
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-2">
              Safety Index
            </span>
          </div>

          {/* Breakdown counts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] pb-1.5 border-b border-zinc-900/60">
              <span className="text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                Pipeline Stats
              </span>
              <span className="text-zinc-400 font-mono font-bold">
                {report.total} Citations
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                Verified Cases
              </span>
              <span className="font-mono text-zinc-200 font-semibold">{report.verified}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Corrected Citation Info
              </span>
              <span className="font-mono text-zinc-200 font-semibold">{report.corrected}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                Unverified (Manual Check)
              </span>
              <span className="font-mono text-zinc-200 font-semibold">{report.unverified}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                Removed (Fabricated)
              </span>
              <span className="font-mono text-zinc-200 font-semibold">{report.removed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Cost / Calls Footer */}
      <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-900/60">
        <div className="flex items-center gap-3 bg-zinc-900/10 border border-zinc-900/60 rounded-xl p-2.5 transition-colors hover:bg-zinc-900/20">
          <Database className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
              Kanoon API Calls
            </div>
            <div className="text-xs font-mono font-bold text-zinc-200">
              {report.api_calls_made}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-zinc-900/10 border border-zinc-900/60 rounded-xl p-2.5 transition-colors hover:bg-zinc-900/20">
          <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
              Pipeline Cost
            </div>
            <div className="text-xs font-mono font-bold text-emerald-400">
              ₹{report.api_cost_inr.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
