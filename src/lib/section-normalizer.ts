import { supabase } from './supabase';
import { SectionMapping, Replacement, NormalizationResult } from './types';

const DEFAULT_MAPPINGS: SectionMapping[] = [
  { id: 1, old_section: 'Section 302 IPC', new_section: 'Section 101 BNS', old_act: 'Indian Penal Code', new_act: 'Bharatiya Nyaya Sanhita' },
  { id: 2, old_section: 'Section 304 IPC', new_section: 'Section 105 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 3, old_section: 'Section 304A IPC', new_section: 'Section 106 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 4, old_section: 'Section 304B IPC', new_section: 'Section 80 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 5, old_section: 'Section 306 IPC', new_section: 'Section 108 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 6, old_section: 'Section 307 IPC', new_section: 'Section 109 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 7, old_section: 'Section 323 IPC', new_section: 'Section 115 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 8, old_section: 'Section 326 IPC', new_section: 'Section 119 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 9, old_section: 'Section 354 IPC', new_section: 'Section 74 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 10, old_section: 'Section 376 IPC', new_section: 'Section 63 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 11, old_section: 'Section 379 IPC', new_section: 'Section 303 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 12, old_section: 'Section 384 IPC', new_section: 'Section 308 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 13, old_section: 'Section 392 IPC', new_section: 'Section 309 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 14, old_section: 'Section 406 IPC', new_section: 'Section 316 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 15, old_section: 'Section 420 IPC', new_section: 'Section 318 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 16, old_section: 'Section 467 IPC', new_section: 'Section 336 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 17, old_section: 'Section 498A IPC', new_section: 'Section 85 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 18, old_section: 'Section 499 IPC', new_section: 'Section 356 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 19, old_section: 'Section 506 IPC', new_section: 'Section 351 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 20, old_section: 'Section 34 IPC', new_section: 'Section 3(5) BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 21, old_section: 'Section 120B IPC', new_section: 'Section 61 BNS', old_act: 'IPC', new_act: 'BNS' },
  { id: 22, old_section: 'Section 125 CrPC', new_section: 'Section 144 BNSS', old_act: 'Code of Criminal Procedure', new_act: 'Bharatiya Nagarik Suraksha Sanhita' },
  { id: 23, old_section: 'Section 154 CrPC', new_section: 'Section 173 BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 24, old_section: 'Section 156(3) CrPC', new_section: 'Section 175(3) BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 25, old_section: 'Section 167 CrPC', new_section: 'Section 187 BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 26, old_section: 'Section 437 CrPC', new_section: 'Section 480 BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 27, old_section: 'Section 438 CrPC', new_section: 'Section 482 BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 28, old_section: 'Section 439 CrPC', new_section: 'Section 483 BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 29, old_section: 'Section 482 CrPC', new_section: 'Section 528 BNSS', old_act: 'CrPC', new_act: 'BNSS' },
  { id: 30, old_section: 'Section 65B IEA', new_section: 'Section 63 BSA', old_act: 'Indian Evidence Act', new_act: 'Bharatiya Sakshya Adhiniyam' },
];

async function loadMappings(): Promise<SectionMapping[]> {
  try {
    const { data, error } = await supabase
      .from('section_mappings')
      .select('*');
    if (error) throw error;
    if (data && data.length > 0) return data as SectionMapping[];
  } catch (e) {
    console.error('Failed to load section mappings from DB, using defaults:', e);
  }
  return DEFAULT_MAPPINGS;
}

interface LookupEntry {
  newSection: string;
  oldAct: string;
  newAct: string;
}

function buildLookup(mappings: SectionMapping[]): Map<string, Map<string, LookupEntry>> {
  const lookup = new Map<string, Map<string, LookupEntry>>();
  // Initialize act groups
  lookup.set('IPC', new Map());
  lookup.set('CrPC', new Map());
  lookup.set('IEA', new Map());

  const actAlias: Record<string, string> = {
    'indian penal code': 'IPC',
    'ipc': 'IPC',
    'code of criminal procedure': 'CrPC',
    'crpc': 'CrPC',
    'indian evidence act': 'IEA',
    'iea': 'IEA',
  };

  for (const m of mappings) {
    const actKey = actAlias[m.old_act.toLowerCase()] || 'IPC';
    const secMatch = m.old_section.match(/Section\s+([\dA-Za-z()]+)/i);
    if (!secMatch) continue;
    const secNum = secMatch[1];

    const newSecMatch = m.new_section.match(/Section\s+([\dA-Za-z()]+)/i);
    if (!newSecMatch) continue;

    if (!lookup.has(actKey)) lookup.set(actKey, new Map());
    lookup.get(actKey)!.set(secNum, {
      newSection: newSecMatch[1],
      oldAct: m.old_act,
      newAct: m.new_act,
    });
  }

  return lookup;
}

export async function normalizeSections(text: string): Promise<NormalizationResult> {
  if (!text) return { original_text: '', normalized_text: '', replacements: [] };

  const mappings = await loadMappings();
  const lookup = buildLookup(mappings);
  const replacements: Replacement[] = [];
  let normalizedText = text;

  const actNames: Record<string, string> = {
    'indian penal code': 'IPC',
    'ipc': 'IPC',
    'code of criminal procedure': 'CrPC',
    'crpc': 'CrPC',
    'indian evidence act': 'IEA',
    'iea': 'IEA',
  };

  const newActAbbr: Record<string, string> = {
    'IPC': 'BNS',
    'CrPC': 'BNSS',
    'IEA': 'BSA',
  };

  // Pattern to match "Section(s) <numbers> <act>" and "Section(s) <numbers> of the <full act name>"
  const pattern = /\b(Sections?)\s+([\d\w(),\s&]+?)\s+(?:of\s+the\s+|of\s+|under\s+)?(Indian\s+Penal\s+Code|IPC|Code\s+of\s+Criminal\s+Procedure|CrPC|Indian\s+Evidence\s+Act|IEA)\b/gi;

  normalizedText = normalizedText.replace(pattern, (fullMatch, prefix, sectionsStr, actName) => {
    const actKey = actNames[actName.toLowerCase()] || 'IPC';
    const actLookup = lookup.get(actKey);
    if (!actLookup) return fullMatch;

    const parts = sectionsStr.split(/,|\band\b|&/);
    const normalizedParts: string[] = [];
    let replacedAny = false;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const secMatch = trimmed.match(/\b(\d+[A-Z]?(?:\(\d+\))?)\b/i);
      if (secMatch) {
        const secCode = secMatch[1];
        const entry = actLookup.get(secCode);
        if (entry) {
          replacements.push({
            old_text: `Section ${secCode} ${actKey}`,
            new_text: `Section ${entry.newSection} ${newActAbbr[actKey]}`,
            old_act: entry.oldAct,
            new_act: entry.newAct,
          });
          normalizedParts.push(entry.newSection);
          replacedAny = true;
        } else {
          normalizedParts.push(trimmed);
        }
      } else {
        normalizedParts.push(trimmed);
      }
    }

    if (!replacedAny) return fullMatch;

    const newActName = newActAbbr[actKey] || actKey;
    const joined =
      normalizedParts.length > 1
        ? normalizedParts.slice(0, -1).join(', ') + ' and ' + normalizedParts[normalizedParts.length - 1]
        : normalizedParts[0];
    const newPrefix = normalizedParts.length === 1 ? 'Section' : 'Sections';
    return `${newPrefix} ${joined} ${newActName}`;
  });

  return {
    original_text: text,
    normalized_text: normalizedText,
    replacements,
  };
}
