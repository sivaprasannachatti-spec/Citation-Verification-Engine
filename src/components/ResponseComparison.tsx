import React from 'react';
import { NormalizationResult } from '../lib/types';
import { Sparkles, ShieldCheck, ArrowRight, BookOpen, AlertCircle, HelpCircle } from 'lucide-react';

interface ResponseComparisonProps {
  rawResponse: string;
  enhancedResponse: string;
  normalization: NormalizationResult | undefined;
  isLoading: boolean;
}

export const ResponseComparison: React.FC<ResponseComparisonProps> = ({
  rawResponse,
  enhancedResponse,
  normalization,
  isLoading,
}) => {
  // Parses custom annotation brackets into rich inline React nodes
  const renderEnhancedText = (text: string) => {
    if (!text) return null;

    // Pattern to catch VERIFIED with link: citation [✅ VERIFIED - [Title](Link)]
    // Pattern to catch VERIFIED without link: citation [✅ VERIFIED - Title]
    // Pattern to catch CORRECTED with link: citation [⚠️ CORRECTED] [✅ VERIFIED - [Title](Link)]
    // Pattern to catch REMOVED: [❌ REMOVED - Reason: citation]
    // Pattern to catch UNVERIFIED: citation [⚠️ UNVERIFIED]
    
    const parts = [];
    let lastIndex = 0;
    
    // Catch-all regex for any safety badge block
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
              className="inline-flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-medium transition-all mx-1 shadow-[0_0_10px_rgba(16,185,129,0.05)] cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{caseName}</span>
            </a>
          );
        } else {
          const caseName = match[4];
          parts.push(
            <span
              key={startIndex}
              className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-xs font-medium mx-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{caseName}</span>
            </span>
          );
        }
      } else if (matchType.startsWith('❌ REMOVED')) {
        const details = match[5];
        parts.push(
          <span
            key={startIndex}
            className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-xs font-medium mx-1 animate-pulse"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="font-mono">{details}</span>
          </span>
        );
      } else if (matchType === '⚠️ CORRECTED') {
        parts.push(
          <span
            key={startIndex}
            className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-xs font-bold mx-1"
          >
            CORRECTED
          </span>
        );
      } else if (matchType === '⚠️ UNVERIFIED') {
        parts.push(
          <span
            key={startIndex}
            className="inline-flex items-center gap-1 bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 px-2 py-0.5 rounded text-xs font-medium mx-1"
          >
            <HelpCircle className="w-3.5 h-3.5" />
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

  // Highlights BNS/BNSS/BSA replacement targets in enhanced text
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
          className="bg-indigo-500/15 border-b border-indigo-400 text-indigo-300 font-semibold px-1 py-0.5 rounded-sm"
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
      {/* Generic AI Response */}
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative flex flex-col min-h-[400px]">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-900">
          <h3 className="text-zinc-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-500" />
            Generic LLM response
          </h3>
          <span className="text-[10px] text-zinc-600 bg-zinc-900 border border-zinc-800 font-mono px-2 py-0.5 rounded uppercase">
            Unverified
          </span>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-3">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-zinc-400 rounded-full animate-spin" />
            <span className="text-zinc-500 text-xs">Generating raw response...</span>
          </div>
        ) : rawResponse ? (
          <div className="whitespace-pre-wrap font-sans text-sm text-zinc-400 leading-relaxed font-normal flex-1 max-h-[500px] overflow-y-auto pr-1">
            {rawResponse}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-medium">
            Waiting for legal query execution
          </div>
        )}
      </div>

      {/* Enhanced Response */}
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative flex flex-col min-h-[400px]">
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-900">
          <h3 className="text-zinc-100 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Verified Safe output
          </h3>
          <span className="text-[10px] text-emerald-500/80 bg-emerald-500/5 border border-emerald-500/10 font-mono px-2 py-0.5 rounded uppercase">
            Safety Shield Active
          </span>
        </div>

        {isLoading ? (
          <div className="flex-1 flex flex-col justify-center items-center gap-3">
            <div className="w-6 h-6 border-2 border-zinc-800 border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-zinc-500 text-xs">Running safety pipeline...</span>
          </div>
        ) : enhancedResponse ? (
          <div className="flex-1 flex flex-col max-h-[500px] overflow-y-auto pr-1">
            {renderEnhancedText(enhancedResponse)}

            {normalization && normalization.replacements.length > 0 && (
              <div className="mt-6 pt-4 border-t border-zinc-900">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">
                  New Code Mappings Applied ({normalization.replacements.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {normalization.replacements.map((rep, idx) => (
                    <div
                      key={idx}
                      className="bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2.5 flex items-center justify-between text-xs"
                    >
                      <div className="font-mono text-zinc-400">{rep.old_text}</div>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                      <div className="font-mono text-indigo-300 font-semibold">{rep.new_text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs font-medium">
            Waiting for legal query execution
          </div>
        )}
      </div>
    </div>
  );
};
