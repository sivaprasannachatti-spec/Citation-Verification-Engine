'use client';

import React, { useState } from 'react';
import { LEGAL_MATTERS, LegalMatter } from '../lib/matters';
import { MatterCard } from '../components/MatterCard';
import { ResponseComparison } from '../components/ResponseComparison';
import { CitationAlerts } from '../components/CitationAlerts';
import { VerificationReport } from '../components/VerificationReport';
import { LLMResponse } from '../lib/types';
import { ShieldCheck, Scale, Sparkles, BrainCircuit, RotateCcw, Database } from 'lucide-react';

export default function Home() {
  const [selectedMatter, setSelectedMatter] = useState<LegalMatter | null>(null);
  const [queryText, setQueryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<LLMResponse | null>(null);
  const [modeUsed, setModeUsed] = useState<'generic' | 'enhanced' | null>(null);

  const handleSelectMatter = (matter: LegalMatter) => {
    setSelectedMatter(matter);
    setQueryText(matter.query);
  };

  const handleClear = () => {
    setSelectedMatter(null);
    setQueryText('');
    setResponse(null);
    setModeUsed(null);
  };

  const handleAsk = async (mode: 'generic' | 'enhanced') => {
    if (!queryText.trim()) return;

    setIsLoading(true);
    setResponse(null);
    setModeUsed(mode);

    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText, mode }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      setResponse(data);
    } catch (e: any) {
      console.error(e);
      // Fallback response for demonstration when API keys are rate-limited or missing
      setResponse({
        raw_response: `Error connecting to API. Please make sure MISTRAL_API_KEY_1..N is configured in your .env.local file.\n\nQuery received: "${queryText}"`,
        provider_used: 'None (Error Fallback)',
        keys_tried: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 font-sans flex flex-col antialiased relative overflow-x-hidden">
      {/* Premium Background Glow effects */}
      <div className="absolute top-[-100px] left-[10%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[400px] right-[10%] w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-[160px] pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-zinc-900 bg-[#030303]/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-600 p-2.5 rounded-xl shadow-md">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
                BRAHMO <span className="text-zinc-500 font-medium">| CITATION SAFETY ENGINE</span>
              </h1>
              <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">
                Deterministic Indian Legal AI Guardrail
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-850">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <Database className="w-3 h-3 text-zinc-500" />
              Supabase Linked
            </span>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 z-10">
        {/* Intro Info Banner */}
        <section className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden shadow-premium-soft">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/[0.01] to-transparent rounded-bl-full pointer-events-none" />
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 text-zinc-200">
            <BrainCircuit className="w-4 h-4 text-indigo-400" />
            Safe Indian Legal Precedent Engine
          </h2>
          <p className="text-zinc-500 text-xs max-w-3xl leading-relaxed font-normal">
            Brahmo intercepts and audits legal LLM responses using a **100% deterministic pipeline**. It extracts citations, queries database indices, performs verification checks against live Indian Kanoon records, flags hallucinated cases, and automatically translates legacy penal codes into modern acts (IPC/CrPC/IEA → BNS/BNSS/BSA).
          </p>
        </section>

        {/* Matter Templates */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Select Legal Query Template
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {LEGAL_MATTERS.map((matter) => (
              <MatterCard
                key={matter.id}
                matter={matter}
                isSelected={selectedMatter?.id === matter.id}
                onClick={() => handleSelectMatter(matter)}
              />
            ))}
          </div>
        </section>

        {/* Input Box */}
        <section className="bg-zinc-950/20 border border-zinc-900 rounded-3xl p-6 relative shadow-premium-soft transition-all duration-300 hover:border-zinc-800/80">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Legal Matter Context & Query
            </label>
            {queryText && (
              <button
                onClick={handleClear}
                className="text-zinc-500 hover:text-zinc-350 text-xs flex items-center gap-1.5 transition-colors font-semibold uppercase tracking-wider text-[10px] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Type your legal query, case details, or draft complaint specifications here..."
            className="w-full h-32 bg-zinc-900/10 border border-zinc-900 focus:border-zinc-800 rounded-2xl p-4 text-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-800 resize-none transition-all placeholder-zinc-650 mb-4 font-sans font-normal"
          />

          <div className="flex flex-wrap gap-3 items-center justify-end">
            <button
              onClick={() => handleAsk('generic')}
              disabled={isLoading || !queryText.trim()}
              className="flex items-center gap-2 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:hover:bg-zinc-900/40 border border-zinc-850 hover:border-zinc-800 font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all duration-250 cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
              Ask Generic AI
            </button>

            <button
              onClick={() => handleAsk('enhanced')}
              disabled={isLoading || !queryText.trim()}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded-xl transition-all duration-250 cursor-pointer shadow-[0_0_25px_rgba(16,185,129,0.15)] border border-emerald-500/20"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Ask with Citation Verification
            </button>
          </div>
        </section>

        {/* Output Comparison & Reports */}
        {(response || isLoading) && (
          <div className="space-y-6">
            {/* Side-by-side Response Comparison */}
            <ResponseComparison
              rawResponse={response?.raw_response || ''}
              enhancedResponse={response?.enhanced_response || ''}
              normalization={response?.normalization}
              segments={response?.segments}
              isLoading={isLoading}
              modeUsed={modeUsed}
            />

            {/* Reports Block (Reports & Alerts side by side) */}
            {modeUsed === 'enhanced' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <VerificationReport report={response?.report} isLoading={isLoading} />
                <CitationAlerts citations={response?.citations} />
              </div>
            )}

            {/* API Metadata footer console info */}
            {response && (
              <div className="bg-zinc-950/20 border border-zinc-900 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">
                <div className="flex items-center gap-2">
                  System Mode:{' '}
                  <span className={`font-bold px-2 py-0.5 rounded ${
                    modeUsed === 'enhanced'
                      ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10'
                      : 'bg-zinc-900 text-zinc-500 border border-zinc-850'
                  }`}>
                    {modeUsed === 'enhanced' ? '🛡️ Enhanced (Safety Shield)' : '⚡ Generic (Unverified)'}
                  </span>
                </div>
                <div>
                  Model Provider: <span className="font-bold text-zinc-400">{response.provider_used}</span>
                </div>
                <div>
                  Keys Audited: <span className="font-mono font-bold text-zinc-400">{response.keys_tried}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/10 py-8 mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between items-center gap-4">
          <span className="text-zinc-600 text-[10px] font-semibold uppercase tracking-wider">
            © 2026 Brahmo AI. Production-Grade Indian Legal Citation Safety Engine.
          </span>
          <div className="flex gap-4 text-zinc-555 text-[10px] font-bold uppercase tracking-wider">
            <a href="#" className="hover:text-zinc-400 transition-colors">Documentation</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">API Specs</a>
            <a href="#" className="hover:text-zinc-400 transition-colors">Safety Audits</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
