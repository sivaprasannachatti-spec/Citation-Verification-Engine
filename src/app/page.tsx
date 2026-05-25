'use client';

import React, { useState } from 'react';
import { LEGAL_MATTERS, LegalMatter } from '../lib/matters';
import { MatterCard } from '../components/MatterCard';
import { ResponseComparison } from '../components/ResponseComparison';
import { CitationAlerts } from '../components/CitationAlerts';
import { VerificationReport } from '../components/VerificationReport';
import { LLMResponse } from '../lib/types';
import { ShieldCheck, Scale, Sparkles, Send, BrainCircuit, RotateCcw } from 'lucide-react';

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
        raw_response: `Error connecting to API. Please make sure GEMINI_API_KEY / GROQ_API_KEY is configured in your .env.local file.\n\nQuery received: "${queryText}"`,
        provider_used: 'None (Error Fallback)',
        keys_tried: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col antialiased">
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Header */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-red-500 via-blue-500 to-emerald-500 p-2 rounded-xl">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-zinc-50 to-zinc-400 bg-clip-text text-transparent flex items-center gap-2">
                BRAHMO <span className="text-zinc-500 font-normal">| CITATION SAFETY ENGINE</span>
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Indian Legal AI Guardrail
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400 font-medium">Supabase Linked</span>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 z-10">
        {/* Intro Banner */}
        <section className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/[0.01] to-transparent rounded-bl-full pointer-events-none" />
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2 text-zinc-100">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            Secure Legal Drafts and Opinions
          </h2>
          <p className="text-zinc-400 text-sm max-w-3xl leading-relaxed">
            Legal AI systems frequently hallucinate case precedents and cite obsolete laws. Brahmo intercepts LLM responses using a **100% deterministic safety pipeline** to extract citations, run database-driven pre-filters, perform parallel Indian Kanoon verification, and normalize legacy sections (IPC/CrPC/IEA → BNS/BNSS/BSA).
          </p>
        </section>

        {/* Matter Grid */}
        <section className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
            Select Legal Matter Template
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
        <section className="bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 backdrop-blur-md relative">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
              Legal Query / Context
            </label>
            {queryText && (
              <button
                onClick={handleClear}
                className="text-zinc-500 hover:text-zinc-300 text-xs flex items-center gap-1.5 transition-colors font-medium"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>

          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Type your legal query, case summary, or request precedents here..."
            className="w-full h-32 bg-zinc-900/20 border border-zinc-900 focus:border-zinc-800 rounded-xl p-4 text-zinc-300 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-800 resize-none transition-all placeholder-zinc-600 mb-4 font-sans"
          />

          <div className="flex flex-wrap gap-4 items-center justify-end">
            <button
              onClick={() => handleAsk('generic')}
              disabled={isLoading || !queryText.trim()}
              className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-zinc-300 disabled:hover:bg-zinc-900 border border-zinc-800 font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-200"
            >
              <Sparkles className="w-4 h-4 text-zinc-500" />
              Ask Generic AI
            </button>

            <button
              onClick={() => handleAsk('enhanced')}
              disabled={isLoading || !queryText.trim()}
              className="flex items-center gap-2 bg-zinc-100 hover:bg-white disabled:opacity-40 text-black disabled:hover:bg-zinc-100 font-bold text-sm px-6 py-3 rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(255,255,255,0.06)]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
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
              isLoading={isLoading}
            />

            {/* Reports Block */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <VerificationReport report={response?.report} isLoading={isLoading} />
              <CitationAlerts citations={response?.citations} />
            </div>

            {/* API Metadata footer */}
            {response && (
              <div className="bg-zinc-900/10 border border-zinc-950 p-4 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-xs text-zinc-500">
                <div>
                  Model: <span className="font-semibold text-zinc-400">{response.provider_used}</span>
                </div>
                <div>
                  Keys Tried: <span className="font-mono text-zinc-400">{response.keys_tried}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/20 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between items-center gap-4">
          <span className="text-zinc-600 text-xs">
            © 2026 Brahmo AI. Production-Grade Indian Legal Citation Safety Engine.
          </span>
          <div className="flex gap-4 text-zinc-500 text-xs">
            <a href="#" className="hover:text-zinc-300 transition-colors">Documentation</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">API Specs</a>
            <a href="#" className="hover:text-zinc-300 transition-colors">Safety Audits</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
