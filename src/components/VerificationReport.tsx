import React from 'react';
import { CitationReport } from '../lib/types';
import { Award, Database, BadgePercent, Coins, ShieldCheck, CornerDownRight } from 'lucide-react';

interface VerificationReportProps {
  report: CitationReport | undefined;
  isLoading: boolean;
}

export const VerificationReport: React.FC<VerificationReportProps> = ({ report, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 h-[250px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 text-center text-zinc-500 text-sm h-[250px] flex items-center justify-center">
        No verification report compiled. Submit a query to see performance logs.
      </div>
    );
  }

  const getGaugeColor = (pct: number) => {
    if (pct >= 90) return 'text-emerald-500';
    if (pct >= 70) return 'text-amber-500';
    return 'text-red-500';
  };

  const getGaugeBg = (pct: number) => {
    if (pct >= 90) return 'stroke-emerald-500';
    if (pct >= 70) return 'stroke-amber-500';
    return 'stroke-red-500';
  };

  return (
    <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between h-full">
      <div>
        <h3 className="text-zinc-100 font-semibold text-lg flex items-center gap-2 mb-6">
          <Award className="w-5 h-5 text-emerald-400" />
          Precedent Verification Report
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Accuracy Ring Gauge */}
          <div className="flex flex-col items-center justify-center bg-zinc-900/10 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-white/[0.01] to-transparent rounded-bl-full" />
            
            <div className="relative w-24 h-24 flex items-center justify-center mb-2">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-zinc-900"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className={`${getGaugeBg(report.accuracy_pct)} transition-all duration-1000 ease-out`}
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - report.accuracy_pct / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-zinc-100 tracking-tight">
                  {report.accuracy_pct}%
                </span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                  Accuracy
                </span>
              </div>
            </div>
            
            <span className="text-xs text-zinc-400 font-medium">
              Verified & Corrected Rate
            </span>
          </div>

          {/* Breakdown counts */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-zinc-900">
              <span className="text-zinc-500 font-medium uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                Pipeline stats
              </span>
              <span className="text-zinc-400 font-mono font-semibold">
                {report.total} Citations
              </span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Verified cases
              </span>
              <span className="font-mono text-zinc-300 font-bold">{report.verified}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Corrected page
              </span>
              <span className="font-mono text-zinc-300 font-bold">{report.corrected}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                Unverified (Proxy)
              </span>
              <span className="font-mono text-zinc-300 font-bold">{report.unverified}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Removed (Fabricated)
              </span>
              <span className="font-mono text-zinc-300 font-bold">{report.removed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Cost / Calls Footer */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-zinc-900">
        <div className="flex items-center gap-3 bg-zinc-900/10 border border-zinc-900/40 rounded-xl p-3">
          <Database className="w-4 h-4 text-zinc-500" />
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
              IK API calls
            </div>
            <div className="text-sm font-mono font-bold text-zinc-200">
              {report.api_calls_made}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-zinc-900/10 border border-zinc-900/40 rounded-xl p-3">
          <Coins className="w-4 h-4 text-emerald-500/80" />
          <div>
            <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">
              Pipeline Cost
            </div>
            <div className="text-sm font-mono font-bold text-emerald-400">
              ₹{report.api_cost_inr.toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
