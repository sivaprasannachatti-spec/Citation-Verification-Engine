import React from 'react';
import { NormalizationResult } from '../lib/types';
import { Sparkles, ShieldCheck, ArrowRight, BookOpen, AlertTriangle, AlertCircle, HelpCircle } from 'lucide-react';

interface ResponseComparisonProps {
  rawResponse: string;
  enhancedResponse: string;
  normalization: NormalizationResult | undefined;
  isLoading: boolean;
  modeUsed: 'generic' | 'enhanced' | null;
}

export const ResponseComparison: React.FC<ResponseComparisonProps> = ({
  rawResponse,
  enhancedResponse,
  normalization,
  isLoading,
  modeUsed,
}) => {
  // Parses custom annotation brackets into rich inline React nodes with premium badge structures
  const renderEnhancedText = (text: string) => {
    if (!text) return null;

    const parts = [];
    let lastIndex = 0;
    
    // Catch-all regex for safety badge blocks
    const badgeRegex = /\[(✅ VERIFIED - \[(.*?)\]\((.*?)\)|✅ VERIFIED - (.*?)|❌ REMOVED - (.*?)|⚠️ CORRECTED|⚠️ UNVERIFIED)\]/g;
    let match;

    while ((match = badgeRegex.exec(text)) !== null) {
      const startIndex = match.index;
      
      // Push preceding text
      if (startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, startIndex));
      }

      const matchText = match[0];
      const matchType = match[1];

      if (matchType.startsWith('✅ VERIFIED')) {
        const hasLink = matchType.includes('](');
        if (hasLink) {
          const caseName = match[2];
          const caseLink = match[3];
          parts.push(
            <a
              key={startIndex}
              href={caseLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all mx-1 my-0.5 shadow-sm align-middle hover:border-emerald-500/50 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
              <span>VERIFIED</span>
              <span className="text-emerald-500/40 font-normal">|</span>
              <span className="underline decoration-emerald-500/30 hover:decoration-emerald-500/70 truncate max-w-[200px] font-medium">{caseName}</span>
            </a>
          );
        } else {
          const caseName = match[4];
          parts.push(
            <span
              key={startIndex}
              className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[11px] font-semibold mx-1 my-0.5 shadow-sm align-middle"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>VERIFIED</span>
              <span className="text-emerald-500/40 font-normal">|</span>
              <span className="truncate max-w-[200px] font-medium">{caseName}</span>
            </span>
          );
        }
      } else if (matchType.startsWith('❌ REMOVED')) {
        const details = match[5];
        parts.push(
          <span
            key={startIndex}
            className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-md text-[11px] font-semibold mx-1 my-0.5 shadow-sm align-middle"
          >
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>REMOVED</span>
            <span className="text-red-500/40 font-normal">|</span>
            <span className="line-through decoration-red-500/50 font-mono text-[10px]">{details}</span>
          </span>
        );
      } else if (matchType === '⚠️ CORRECTED') {
        parts.push(
          <span
            key={startIndex}
            className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md text-[11px] font-semibold mx-1 my-0.5 shadow-sm align-middle"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>CORRECTED</span>
          </span>
        );
      } else if (matchType === '⚠️ UNVERIFIED') {
        parts.push(
          <span
            key={startIndex}
            className="inline-flex items-center gap-1 bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-md text-[11px] font-semibold mx-1 my-0.5 shadow-sm align-middle"
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span>UNVERIFIED</span>
          </span>
        );
      }

      lastIndex = badgeRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return (
      <div className="whitespace-pre-wrap font-sans text-sm text-zinc-300 leading-relaxed font-normal">
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            {typeof p === 'string' ? renderSectionHighlighter(p) : p}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Highlights BNS/BNSS/BSA replacement targets in enhanced text with modern badge style
  const renderSectionHighlighter = (str: string) => {
    if (!str) return '';
    const sectionPattern = /\b(Section\s+[\dA-Za-z()]+?\s+(?:BNS|BNSS|BSA))\b/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = sectionPattern.exec(str)) !== null) {
      const startIndex = match.index;
      if (startIndex > lastIndex) {
        parts.push(str.substring(lastIndex, startIndex));
      }
      parts.push(
        <span
          key={startIndex}
          className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold px-2 py-0.5 rounded text-xs inline-block align-baseline font-mono shadow-sm"
        >
          {match[0]}
        </span>
      );
      lastIndex = sectionPattern.lastIndex;
    }

    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }

    return parts.length > 0 ? parts : str;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      {/* Generic AI Response (Warning styled, unverified) */}
      <div className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 relative flex flex-col min-h-[450px] shadow-premium-soft transition-all duration-300 hover:border-zinc-800/80">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-900/60">
          <h3 className="text-zinc-400 font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
            Generic AI Response
          </h3>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/5 border border-red-500/10 text-[9px] text-red-500 font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            Unverified
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-800 border-t-zinc-500 rounded-full animate-spin" />
            <span className="text-zinc-500 text-[11px] font-medium tracking-wide">Generating raw response...</span>
          </div>
        ) : rawResponse ? (
          <div className="whitespace-pre-wrap font-sans text-xs text-zinc-500 leading-relaxed font-normal flex-1 max-h-[550px] overflow-y-auto pr-1">
            {rawResponse}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-semibold uppercase tracking-wider">
            Waiting for legal query execution
          </div>
        )}
      </div>

      {/* Enhanced Response (Success styled, safety shield active) */}
      <div className="bg-zinc-900/10 border border-zinc-900 rounded-3xl p-6 relative flex flex-col min-h-[450px] shadow-premium-glow transition-all duration-300 hover:border-zinc-800/60">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-900/60">
          <h3 className="text-zinc-100 font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            Verified Safe Output
          </h3>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/5 border border-emerald-500/10 text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Safety Shield Active
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-3">
            <div className="w-5 h-5 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
            <span className="text-zinc-500 text-[11px] font-medium tracking-wide">Running safety pipeline...</span>
          </div>
        ) : enhancedResponse ? (
          <div className="flex-1 flex flex-col max-h-[550px] overflow-y-auto pr-1">
            {renderEnhancedText(enhancedResponse)}

            {normalization && normalization.replacements.length > 0 && (
              <div className="mt-6 pt-5 border-t border-zinc-900/80">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">
                  New Code Mappings Applied ({normalization.replacements.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {normalization.replacements.map((rep, idx) => (
                    <div
                      key={idx}
                      className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 flex items-center justify-between text-xs transition-colors hover:bg-indigo-500/10"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-zinc-400 font-medium">{rep.old_text}</span>
                        <span className="text-[9px] text-zinc-600 font-semibold tracking-wider uppercase">{rep.old_act}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="font-mono text-indigo-300 font-bold">{rep.new_text}</span>
                        <span className="text-[9px] text-indigo-400/80 font-semibold tracking-wider uppercase">{rep.new_act}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {modeUsed === 'generic' ? (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 max-w-sm">
                <p className="text-amber-400 text-xs font-bold mb-1.5 uppercase tracking-wider flex items-center gap-1.5 justify-center">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Generic Mode Active
                </p>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  The safety pipeline was skipped. Click <strong className="text-zinc-300">"Ask with Citation Verification"</strong> to run extraction, Kanoon verification, and section normalization.
                </p>
              </div>
            ) : (
              <span className="text-zinc-600 text-xs font-semibold uppercase tracking-wider">
                Waiting for legal query execution
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

