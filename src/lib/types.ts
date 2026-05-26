// Core type definitions for the Citation Safety Engine

export interface Citation {
  text: string;
  pattern_name: string;
  year: number;
  volume: number | null;
  page: number;
  court: string | null;
  canonical?: string;
}

export interface HallucinationFlag {
  rule: string;
  description: string;
  severity: 'ERROR' | 'WARNING';
}

export interface VerificationResult {
  citation: Citation;
  status: 'VERIFIED' | 'NOT_FOUND' | 'UNVERIFIED';
  ik_doc_id: string | null;
  case_name: string | null;
  corrected_text: string | null;
  cached: boolean;
  hallucination_flags: HallucinationFlag[];
}

export interface Replacement {
  old_text: string;
  new_text: string;
  old_act: string;
  new_act: string;
}

export interface NormalizationResult {
  original_text: string;
  normalized_text: string;
  replacements: Replacement[];
}

export interface CitationReport {
  total: number;
  total_entities: number;
  normalized_sections: number;
  verified: number;
  corrected: number;
  unverified: number;
  removed: number;
  accuracy_pct: number;
  api_calls_made: number;
  api_cost_inr: number;
}

export interface LLMRequest {
  query: string;
  mode: 'generic' | 'enhanced';
}

export interface LLMResponse {
  raw_response: string;
  enhanced_response?: string;
  citations?: VerificationResult[];
  normalization?: NormalizationResult;
  report?: CitationReport;
  provider_used: string;
  keys_tried: number;
}

export interface CitationPattern {
  id: number;
  pattern_name: string;
  regex: string;
  format_template: string;
  example: string;
  jurisdiction: string;
}

export interface SectionMapping {
  id: number;
  old_section: string;
  new_section: string;
  old_act: string;
  new_act: string;
}

export interface LegalMatter {
  id: number;
  title: string;
  practice: string;
  court: string;
  query: string;
  color: string;
}
