import React from 'react';
import { VerificationResult } from '../lib/types';
import { AlertTriangle, ShieldAlert, CheckCircle2, ShieldQuestion } from 'lucide-react';

interface CitationAlertsProps {
  citations: VerificationResult[] | undefined;
}

export const CitationAlerts: React.FC<CitationAlertsProps> = ({ citations }) => {
  if (!citations || citations.length === 0) {
    return (
      <div className="bg-zinc-950/10 border border-zinc-900 rounded-3xl p-6 text-center text-zinc-650 text-xs font-semibold uppercase tracking-wider h-[320px] flex items-center justify-center">
        No citations analyzed yet. Submit a query to see safety checks.
      </div>
    );
  }

  const allFlags = citations.flatMap((c) => 
    c.hallucination_flags.map((f) => ({
      citationText: c.citation.text,
      ...f
    }))
  );

  return (
    <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between h-[320px] shadow-premium-soft transition-all duration-300 hover:border-zinc-800/80">
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-zinc-200 font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Citation Safety Alerts
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-zinc-900/60 border border-zinc-850 text-[9px] font-bold text-zinc-400 tracking-wider">
            {allFlags.length} Trigger{allFlags.length === 1 ? '' : 's'} Active
          </span>
        </div>

        {allFlags.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-8 text-center h-[200px]">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
            <div>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Citations Cleared</p>
              <p className="text-zinc-500 text-[11px] leading-relaxed max-w-[280px]">
                All citations passed pre-filter rule checks without triggering any safety flags.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {allFlags.map((flag, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl border flex gap-3.5 transition-all duration-300 ${
                  flag.severity === 'ERROR'
                    ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/20 shadow-sm'
                    : 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/20 shadow-sm'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {flag.severity === 'ERROR' ? (
                    <div className="p-1 rounded bg-red-500/10">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    </div>
                  ) : (
                    <div className="p-1 rounded bg-amber-500/10">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-zinc-200 font-bold text-[10px] tracking-wider uppercase">
                      {flag.rule}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[8px] font-bold tracking-wider uppercase ${
                        flag.severity === 'ERROR'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {flag.severity}
                    </span>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed mb-2.5 font-normal">
                    {flag.description}
                  </p>
                  <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 bg-zinc-900/60 border border-zinc-850 px-2.5 py-1 rounded-lg w-fit">
                    <span className="font-bold text-[9px] uppercase tracking-wider text-zinc-650">Source:</span>
                    <span className="font-mono text-zinc-400 truncate max-w-[180px]">{flag.citationText}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

