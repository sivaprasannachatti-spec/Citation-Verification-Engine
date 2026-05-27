import React from 'react';
import { VerificationResult } from '../lib/types';
import { AlertTriangle, ShieldAlert, CheckCircle2, ShieldQuestion, HelpCircle } from 'lucide-react';

interface CitationAlertsProps {
  citations: VerificationResult[] | undefined;
}

export const CitationAlerts: React.FC<CitationAlertsProps> = ({ citations }) => {
  if (!citations || citations.length === 0) {
    return (
      <div className="bg-zinc-950/10 border border-zinc-900 rounded-3xl p-6 text-center text-zinc-650 text-xs font-semibold uppercase tracking-wider h-[380px] flex items-center justify-center">
        No citations analyzed yet. Submit a query to see safety checks.
      </div>
    );
  }

  // Filter citations that have flags OR are NOT verified (unverified or removed)
  const problematicCitations = citations.filter(
    (c) => c.status !== 'VERIFIED' || c.hallucination_flags.length > 0
  );

  // Sort problematic citations: ERROR/REMOVED first, then WARNING/UNVERIFIED
  problematicCitations.sort((a, b) => {
    const aIsError = a.status === 'NOT_FOUND' || a.hallucination_flags.some((f) => f.severity === 'ERROR');
    const bIsError = b.status === 'NOT_FOUND' || b.hallucination_flags.some((f) => f.severity === 'ERROR');
    if (aIsError && !bIsError) return -1;
    if (!aIsError && bIsError) return 1;
    return 0;
  });

  return (
    <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-premium-soft transition-all duration-300 hover:border-zinc-800/80">
      <div>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-zinc-200 font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            Citation Safety Alerts
          </h3>
          <span className="px-2 py-0.5 rounded-full bg-zinc-900/60 border border-zinc-850 text-[9px] font-bold text-zinc-400 tracking-wider">
            {problematicCitations.length} Issue{problematicCitations.length === 1 ? '' : 's'} Detected
          </span>
        </div>

        {problematicCitations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-8 text-center h-[240px]">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-pulse" />
            <div>
              <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">Citations Cleared</p>
              <p className="text-zinc-500 text-[11px] leading-relaxed max-w-[280px]">
                All citations passed validation checks without triggering any safety warnings or hallucinations.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {problematicCitations.map((c, idx) => {
              const isRemoved = c.status === 'NOT_FOUND';
              const isUnverified = c.status === 'UNVERIFIED';
              const hasError = c.hallucination_flags.some((f) => f.severity === 'ERROR') || isRemoved;
              
              let cardBg = 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/20';
              let iconColor = 'text-amber-400';
              let badgeStyle = 'bg-amber-500/10 text-amber-400';
              let Icon = AlertTriangle;

              if (hasError) {
                cardBg = 'bg-red-500/5 border-red-500/10 hover:border-red-500/20 shadow-sm';
                iconColor = 'text-red-400';
                badgeStyle = 'bg-red-500/10 text-red-400';
                Icon = ShieldAlert;
              } else if (isUnverified) {
                cardBg = 'bg-orange-500/5 border-orange-500/10 hover:border-orange-500/20';
                iconColor = 'text-orange-400';
                badgeStyle = 'bg-orange-500/10 text-orange-400';
                Icon = HelpCircle;
              }

              return (
                <div key={idx} className={`p-4 rounded-2xl border flex gap-3.5 transition-all duration-300 ${cardBg}`}>
                  <div className="shrink-0 mt-0.5">
                    <div className={`p-1 rounded bg-black/40`}>
                      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-zinc-200 font-mono font-bold text-[11px] tracking-tight">
                        {c.citation.canonical || c.citation.text}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold tracking-wider uppercase ${badgeStyle}`}>
                        {c.status === 'NOT_FOUND' ? 'REMOVED' : c.status}
                      </span>
                    </div>

                    {/* Show verifier reasoning */}
                    <p className="text-zinc-400 text-xs leading-relaxed font-medium mb-2">
                      {c.reasoning}
                    </p>

                    {/* List specific rule flags */}
                    {c.hallucination_flags.length > 0 && (
                      <div className="space-y-1 mt-2 pl-2 border-l border-zinc-800">
                        {c.hallucination_flags.map((flag, fIdx) => (
                          <div key={fIdx} className="text-[10px] text-zinc-500 leading-normal flex items-start gap-1">
                            <span className="text-indigo-400 shrink-0 font-bold">•</span>
                            <span>
                              <strong className="text-zinc-400 uppercase tracking-wide">{flag.rule}:</strong> {flag.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
