import { supabase } from './supabase';
import { Citation, CitationPattern } from './types';

// Hardcoded fallback patterns (loaded from DB at runtime, these are backup)
const DEFAULT_PATTERNS: CitationPattern[] = [
  {
    id: 1,
    pattern_name: 'SCC',
    regex: '\\((\\d{4})\\)\\s+(\\d{1,2})\\s+SCC\\s+(\\d{1,5})',
    format_template: '({year}) {volume} SCC {page}',
    example: '(2024) 5 SCC 123',
    jurisdiction: 'Supreme Court of India',
  },
  {
    id: 2,
    pattern_name: 'SCC_OnLine',
    regex: '(\\d{4})\\s+SCC\\s+OnLine\\s+(SC|Del|Bom|Cal|Mad|All|Kar|Ker|Pat|Raj|MP|AP|Guj)\\s+(\\d{1,6})',
    format_template: '{year} SCC OnLine {court} {page}',
    example: '2024 SCC OnLine Del 456',
    jurisdiction: 'Various Courts',
  },
  {
    id: 3,
    pattern_name: 'AIR',
    regex: 'AIR\\s+(\\d{4})\\s+(SC|Del|Bom|Cal|Mad|All|Kar|Ker|Pat|Raj|MP|AP|Guj|NOC)\\s+(\\d{1,5})',
    format_template: 'AIR {year} {court} {page}',
    example: 'AIR 2024 SC 123',
    jurisdiction: 'Various Courts',
  },
  {
    id: 4,
    pattern_name: 'Cri_LJ',
    regex: '[\\(]?(\\d{4})[\\)]?\\s+Cri\\s+LJ\\s+(\\d{1,5})',
    format_template: '{year} Cri LJ {page}',
    example: '2024 Cri LJ 789',
    jurisdiction: 'Various Criminal Courts',
  },
  {
    id: 5,
    pattern_name: 'SCR',
    regex: '\\((\\d{4})\\)\\s+(\\d{1,2})\\s+SCR\\s+(\\d{1,5})',
    format_template: '({year}) {volume} SCR {page}',
    example: '(2024) 5 SCR 123',
    jurisdiction: 'Supreme Court of India',
  },
  {
    id: 6,
    pattern_name: 'MANU',
    regex: 'MANU/(SC|DE|MH|KA|KE|WB|TN|AP|GJ|RJ|MP|UP)/(\\d{4})/(\\d{4,6})',
    format_template: 'MANU/{court}/{year}/{page}',
    example: 'MANU/SC/0123/2024',
    jurisdiction: 'Manupatra database',
  },
];

async function loadPatterns(): Promise<CitationPattern[]> {
  try {
    const { data, error } = await supabase
      .from('citation_patterns')
      .select('*');
    if (error) throw error;
    if (data && data.length > 0) return data as CitationPattern[];
  } catch (e) {
    console.error('Failed to load citation patterns from DB, using defaults:', e);
  }
  return DEFAULT_PATTERNS;
}

function parseCitation(match: RegExpMatchArray, patternName: string): Citation | null {
  try {
    const fullText = match[0];
    switch (patternName) {
      case 'SCC':
      case 'SCR':
        return {
          text: fullText,
          pattern_name: patternName,
          year: parseInt(match[1]),
          volume: parseInt(match[2]),
          page: parseInt(match[3]),
          court: patternName === 'SCR' ? 'SC' : null,
        };
      case 'SCC_OnLine':
        return {
          text: fullText,
          pattern_name: patternName,
          year: parseInt(match[1]),
          volume: null,
          page: parseInt(match[3]),
          court: match[2],
        };
      case 'AIR':
        return {
          text: fullText,
          pattern_name: patternName,
          year: parseInt(match[1]),
          volume: null,
          page: parseInt(match[3]),
          court: match[2],
        };
      case 'Cri_LJ':
        return {
          text: fullText,
          pattern_name: patternName,
          year: parseInt(match[1]),
          volume: null,
          page: parseInt(match[2]),
          court: null,
        };
      case 'MANU': {
        const court = match[1];
        const val1 = parseInt(match[2]);
        const val2 = parseInt(match[3]);
        let year: number, page: number;
        if (val1 >= 1900 && val1 <= 2030) {
          year = val1;
          page = val2;
        } else {
          year = val2;
          page = val1;
        }
        return {
          text: fullText,
          pattern_name: patternName,
          year,
          volume: null,
          page,
          court,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export async function extractCitations(text: string): Promise<Citation[]> {
  if (!text) return [];

  const patterns = await loadPatterns();
  const extracted: Citation[] = [];
  const seen = new Set<string>();

  for (const pat of patterns) {
    const regex = new RegExp(pat.regex, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (seen.has(match[0])) continue;
      seen.add(match[0]);
      const citation = parseCitation(match, pat.pattern_name);
      if (citation) extracted.push(citation);
    }
  }

  return extracted;
}
