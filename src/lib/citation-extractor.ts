import { supabase } from './supabase';
import { Citation, CitationPattern } from './types';

const DEFAULT_PATTERNS: CitationPattern[] = [
  {
    id: 1,
    pattern_name: 'SCC',
    regex: '\\((\\d{4})\\)\\s+(\\d{1,2})\\s+SCC\\s+(\\d{1,5})',
    format_template: '({year}) {volume} SCC {page}',
    example: '(2024) 5 SCC 123',
    jurisdiction: 'Supreme Court of India',
    year_group: 1,
    volume_group: 2,
    page_group: 3,
    court_group: null,
  },
  {
    id: 2,
    pattern_name: 'SCC_OnLine',
    regex: '(\\d{4})\\s+SCC\\s+OnLine\\s+(SC|Del|Bom|Cal|Mad|All|Kar|Ker|Pat|Raj|MP|AP|Guj)\\s+(\\d{1,6})',
    format_template: '{year} SCC OnLine {court} {page}',
    example: '2024 SCC OnLine Del 456',
    jurisdiction: 'Various Courts',
    year_group: 1,
    volume_group: null,
    court_group: 2,
    page_group: 3,
  },
  {
    id: 3,
    pattern_name: 'AIR',
    regex: 'AIR\\s+(\\d{4})\\s+(SC|Del|Bom|Cal|Mad|All|Kar|Ker|Pat|Raj|MP|AP|Guj|NOC)\\s+(\\d{1,5})',
    format_template: 'AIR {year} {court} {page}',
    example: 'AIR 2024 SC 123',
    jurisdiction: 'Various Courts',
    year_group: 1,
    volume_group: null,
    court_group: 2,
    page_group: 3,
  },
  {
    id: 4,
    pattern_name: 'Cri_LJ',
    regex: '[\\(]?(\\d{4})[\\)]?\\s+Cri\\s+LJ\\s+(\\d{1,5})',
    format_template: '{year} Cri LJ {page}',
    example: '2024 Cri LJ 789',
    jurisdiction: 'Various Criminal Courts',
    year_group: 1,
    volume_group: null,
    court_group: null,
    page_group: 2,
  },
  {
    id: 5,
    pattern_name: 'SCR',
    regex: '\\((\\d{4})\\)\\s+(\\d{1,2})\\s+SCR\\s+(\\d{1,5})',
    format_template: '({year}) {volume} SCR {page}',
    example: '(2024) 5 SCR 123',
    jurisdiction: 'Supreme Court of India',
    year_group: 1,
    volume_group: 2,
    page_group: 3,
    court_group: null,
  },
  {
    id: 6,
    pattern_name: 'MANU',
    regex: 'MANU/(SC|DE|MH|KA|KE|WB|TN|AP|GJ|RJ|MP|UP)/(\\d{4})/(\\d{4,6})',
    format_template: 'MANU/{court}/{year}/{page}',
    example: 'MANU/SC/0123/2024',
    jurisdiction: 'Manupatra database',
    year_group: 2,
    volume_group: null,
    court_group: 1,
    page_group: 3,
  },
];

const LEGAL_KEYWORDS = [
  'v.', 'vs.', 'versus', 'state', 'union', 'court', 'petition', 'judgment', 'appeal',
  'plaintiff', 'respondent', 'accused', 'bail', 'precedent', 'overruled', 'justice',
  'criminal', 'civil', 'tribunal', 'judge', 'advocate', 'counsel', 'bench', 'section',
  'act', 'complaint', 'pleading', 'offence', 'offenses'
];

const NON_LEGAL_INDICATORS = [
  'invoice', 'billing', 'model', 'serial', 'product', 'item', 'qty',
  'quantity', 'price', 'amount', 'tax', 'hsn', 'part', 'spec', 'specification'
];

export function normalizeCitationInput(text: string): string {
  if (!text) return '';
  // 1. Normalize Unicode spaces (non-breaking spaces like \u00A0, thin spaces, etc.) to standard spaces
  let normalized = text.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');
  // 2. Normalize tabs to spaces
  normalized = normalized.replace(/\t/g, ' ');
  // 3. Clean typical OCR spacing artifacts in brackets
  // e.g. "( 2024 )" or "[ 2024 ]" -> "(2024)"
  normalized = normalized.replace(/[\text\(\[]\s*(\d{4})\s*[\)\]]/g, '($1)');
  // 4. Clean spacing inside reporter names
  normalized = normalized.replace(/\bS\s+C\s+C\b/g, 'SCC');
  normalized = normalized.replace(/\bS\s+C\s+R\b/g, 'SCR');
  normalized = normalized.replace(/\bA\s+I\s+R\b/g, 'AIR');
  normalized = normalized.replace(/\bC\s*r\s*i\s*L\s*J\b/gi, 'Cri LJ');
  normalized = normalized.replace(/\bCri\s*L\.?\s*J\.?\b/gi, 'Cri LJ');
  normalized = normalized.replace(/\bS\s*C\s*C\s+On\s*Line\b/gi, 'SCC OnLine');
  normalized = normalized.replace(/\bM\s*A\s*N\s*U\b/gi, 'MANU');
  // 5. Collapse multiple spaces to single space
  normalized = normalized.replace(/ {2,}/g, ' ');
  return normalized;
}

export function canonicalizeCitation(text: string, patternName: string): string {
  let clean = text.trim()
    .replace(/\s+/g, ' ')
    .replace(/[\[\({]\s*(\d{4})\s*[\])}]/g, '($1)');
  
  if (patternName === 'SCC') {
    clean = clean.replace(/\bS\s*\.?\s*C\s*\.?\s*C\s*(\d+)/i, 'SCC $1');
  } else if (patternName === 'SCC_OnLine') {
    clean = clean.replace(/\bS\s*\.?\s*C\s*\.?\s*C\s*On\s*Line/i, 'SCC OnLine');
  } else if (patternName === 'AIR') {
    clean = clean.replace(/\bA\s*\.?\s*I\s*\.?\s*R\s*/i, 'AIR ');
  } else if (patternName === 'Cri_LJ') {
    clean = clean.replace(/\bCri\s*\.?\s*L\s*\.?\s*J\s*/i, 'Cri LJ ');
  } else if (patternName === 'SCR') {
    clean = clean.replace(/\bS\s*\.?\s*C\s*\.?\s*R\s*/i, 'SCR ');
  } else if (patternName === 'MANU') {
    clean = clean.replace(/\bM\s*\.?\s*A\s*\.?\s*N\s*\.?\s*U\b/i, 'MANU');
  }
  
  return clean.replace(/\s+/g, ' ');
}

export function isFalsePositive(citationText: string, fullText: string, matchIndex: number): boolean {
  // Immediate prefix check: If the word 'invoice', 'model', or 'serial' is directly preceding the citation
  const prefixStart = Math.max(0, matchIndex - 25);
  const immediatePrefix = fullText.substring(prefixStart, matchIndex).toLowerCase();
  if (/\b(?:invoice|model|serial|qty|hsn|ref|billing)\b/i.test(immediatePrefix)) {
    return true; // Immediate suppression regardless of surrounding legal keyword score
  }

  const start = Math.max(0, matchIndex - 100);
  const end = Math.min(fullText.length, matchIndex + citationText.length + 100);
  const windowText = fullText.substring(start, end).toLowerCase();

  let legalScore = 0;
  for (const kw of LEGAL_KEYWORDS) {
    const regex = new RegExp(`\\b${kw.replace('.', '\\.')}\\b`, 'gi');
    const matches = windowText.match(regex);
    if (matches) {
      legalScore += matches.length;
    }
  }

  let nonLegalScore = 0;
  for (const ind of NON_LEGAL_INDICATORS) {
    const regex = new RegExp(`\\b${ind}\\b`, 'gi');
    const matches = windowText.match(regex);
    if (matches) {
      nonLegalScore += matches.length;
    }
  }

  // Reject match if invoice context exists and legal context is absent/low
  if (nonLegalScore > 0 && legalScore === 0) {
    return true;
  }
  if (nonLegalScore > 1 && legalScore < 1) {
    return true;
  }

  return false;
}

export async function loadPatterns(): Promise<CitationPattern[]> {
  try {
    const { data, error } = await supabase
      .from('citation_patterns')
      .select('*');
    if (error) throw error;
    if (data && data.length > 0) {
      // Gracefully merge DB rows with local static defaults to fallback missing columns
      return data.map(dbPat => {
        const def = DEFAULT_PATTERNS.find(p => p.pattern_name === dbPat.pattern_name);
        return {
          ...def,
          ...dbPat,
          year_group: dbPat.year_group ?? def?.year_group ?? 1,
          volume_group: dbPat.volume_group !== undefined ? dbPat.volume_group : (def?.volume_group !== undefined ? def.volume_group : null),
          page_group: dbPat.page_group ?? def?.page_group ?? 3,
          court_group: dbPat.court_group !== undefined ? dbPat.court_group : (def?.court_group !== undefined ? def.court_group : null),
        };
      }) as CitationPattern[];
    }
  } catch (e) {
    console.error('Failed to load citation patterns from DB, using defaults:', e);
  }
  return DEFAULT_PATTERNS;
}

function buildCanonical(c: Omit<Citation, 'text'>, formatTemplate: string): string {
  let canonical = formatTemplate;
  canonical = canonical.replace('{year}', String(c.year));
  canonical = canonical.replace('{volume}', String(c.volume || ''));
  canonical = canonical.replace('{page}', String(c.page));
  canonical = canonical.replace('{court}', c.court || '');
  return canonical.replace(/\s+/g, ' ').trim();
}

function parseCitation(match: RegExpExecArray, pat: CitationPattern): Citation | null {
  try {
    const fullText = match[0];
    
    const yearGroup = pat.year_group ?? 1;
    const volumeGroup = pat.volume_group !== undefined ? pat.volume_group : null;
    const pageGroup = pat.page_group ?? 3;
    const courtGroup = pat.court_group !== undefined ? pat.court_group : null;

    let year = parseInt(match[yearGroup]);
    let volume = volumeGroup !== null ? parseInt(match[volumeGroup]) : null;
    let page = parseInt(match[pageGroup]);
    let court = courtGroup !== null ? match[courtGroup] : null;

    if (isNaN(year) || year < 1900 || year > 2030) {
      if (!isNaN(page) && page >= 1900 && page <= 2030) {
        const temp = year;
        year = page;
        page = temp;
      }
    }

    const parsed = {
      pattern_name: pat.pattern_name,
      year,
      volume,
      page,
      court,
    };

    const canonical = buildCanonical(parsed, pat.format_template);

    return {
      text: fullText,
      canonical: canonicalizeCitation(canonical, pat.pattern_name),
      ...parsed,
    };
  } catch {
    return null;
  }
}

export async function extractCitations(text: string): Promise<Citation[]> {
  if (!text) return [];

  // Safe processing of large inputs: Cap text length at 200,000 chars.
  const textLimit = 200000;
  const targetText = text.length > textLimit ? text.substring(0, textLimit) : text;

  // Preprocess input text to normalize spacing and sanitize OCR errors
  const normalizedText = normalizeCitationInput(targetText);

  const patterns = await loadPatterns();
  const extracted: Citation[] = [];
  const seenCanonical = new Set<string>();

  const startTime = performance.now();
  const timeoutLimitMs = 5000; // 5s hard extraction limit

  // Step 1: Extract standard patterns
  for (const pat of patterns) {
    if (performance.now() - startTime > timeoutLimitMs) {
      console.warn('Extraction timed out. Aborting remaining patterns.');
      break;
    }

    const regex = new RegExp(pat.regex, 'gi');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalizedText)) !== null) {
      const matchIndex = match.index;
      const matchedString = match[0];
      const cleanText = matchedString.replace(/^[\s"'\(\[,\.]+/, '').replace(/[\s"'\)\]\.,]+$/, '');

      // Apply False Positive Proximity Filter
      if (isFalsePositive(cleanText, normalizedText, matchIndex)) {
        console.log(`[Suppress] Suppressed false-positive: "${cleanText}" at index ${matchIndex}`);
        continue;
      }

      const citation = parseCitation(match, pat);
      if (citation && citation.canonical) {
        if (seenCanonical.has(citation.canonical)) continue;
        seenCanonical.add(citation.canonical);
        extracted.push(citation);
      }
    }
  }

  // Step 2: Heuristic Fallback Layer for UNKNOWN_FORMAT legal citations
  if (performance.now() - startTime < timeoutLimitMs) {
    const heuristicPatterns = [
      // 1. (Year) Volume REPORTER Page  -> e.g. (2022) 5 SCALE 123
      /\b(?:\(|\[)?(19\d{2}|20\d{2})(?:\)|\])?\s+(\d{1,2})\s+([A-Z]{3,10})\s+(\d{1,5})\b/gi,
      // 2. Year REPORTER Page          -> e.g. 2024 INSC 233, 2023 LiveLaw (SC) 456
      /\b(?:\(|\[)?(19\d{2}|20\d{2})(?:\)|\])?\s+([A-Z]{3,10}|[A-Za-z]+Law(?:\s*\([A-Z\s]+\))?)\s+(\d{1,5})\b/gi
    ];

    for (const regex of heuristicPatterns) {
      let match: RegExpExecArray | null;
      regex.lastIndex = 0;
      while ((match = regex.exec(normalizedText)) !== null) {
        const fullMatch = match[0];
        const matchIndex = match.index;

        // Skip if this overlap is already processed in standard citations
        let isAlreadyMatched = false;
        for (const ext of extracted) {
          const normExtText = ext.text.replace(/\s+/g, '');
          const normFullMatch = fullMatch.replace(/\s+/g, '');
          if (normExtText.includes(normFullMatch) || normFullMatch.includes(normExtText)) {
            isAlreadyMatched = true;
            break;
          }
        }
        if (isAlreadyMatched) continue;

        // Run False Positive Proximity Filter
        if (isFalsePositive(fullMatch, normalizedText, matchIndex)) {
          continue;
        }

        // Parse heuristic details
        const year = parseInt(match[1]);
        let volume: number | null = null;
        let reporter = '';
        let page = 0;

        if (match.length === 5) {
          volume = parseInt(match[2]);
          reporter = match[3];
          page = parseInt(match[4]);
        } else {
          reporter = match[2];
          page = parseInt(match[3]);
        }

        // Skip if the reporter is in lowercase or not uppercase/Law ending
        if (!/^[A-Z]/.test(reporter)) continue;

        const canonical = volume 
          ? `(${year}) ${volume} ${reporter} ${page}`
          : `${year} ${reporter} ${page}`;
        const canonicalKey = canonicalizeCitation(canonical, 'UNKNOWN');

        if (seenCanonical.has(canonicalKey)) continue;
        seenCanonical.add(canonicalKey);

        extracted.push({
          text: fullMatch,
          pattern_name: 'UNKNOWN_FORMAT',
          year,
          volume,
          page,
          court: null,
          canonical: canonicalKey
        });
      }
    }
  }

  return extracted;
}
