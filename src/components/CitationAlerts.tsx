import React from 'react';
import { VerificationResult } from '../lib/types';
import { AlertTriangle, ShieldX, CheckCircle, HelpCircle } from 'lucide-react';

interface CitationAlertsProps {
  citations: VerificationResult[] | undefined;
}

export const CitationAlerts: React.FC<CitationAlertsProps> = ({ citations }) => {
  if (!citations || citations.length === 0) {
    return (
      <div className="bg-zinc-950/20 border border-zinc-900 rounded-2xl p-6 text-center text-zinc-500 text-sm">
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
    <div className="bg-zinc-950/40 border border-zinc-900 rounded-2xl p-5 backdrop-blur-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-zinc-100 font-semibold text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Citation Safety Alerts
        </h3>
        <span className="text-xs text-zinc-500 font-medium">
          {allFlags.length} trigger{allFlags.length === 1 ? '' : 's'} flagged
        </span>
      </div>

      {allFlags.length === 0 ? (
        <div className="flex items-center gap-3 bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 text-zinc-400 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>All citations passed pre-filter rule checks without triggering safety flags.</span>
        </div>
      ) : (
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {allFlags.map((flag, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex gap-3.5 transition-colors duration-200 ${
                flag.severity === 'ERROR'
                  ? 'bg-red-950/10 border-red-900/30 hover:border-red-900/50'
                  : 'bg-amber-950/10 border-amber-900/30 hover:border-amber-900/50'
              }`}
            >
              {flag.severity === 'ERROR' ? (
                <ShieldX className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-2 mb-1">
                  <span className="text-zinc-200 font-semibold text-xs tracking-wider uppercase">
                    {flag.rule}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${
                      flag.severity === 'ERROR'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-amber-500/10 text-amber-500'
                    }`}
                  >
                    {flag.severity}
                  </span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed mb-2">
                  {flag.description}
                </p>
                <div className="text-[11px] text-zinc-500 flex items-center gap-1 bg-black/20 px-2 py-1 rounded w-fit">
                  <span className="font-medium">Context:</span>
                  <span className="font-mono text-zinc-400 truncate">{flag.citationText}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
