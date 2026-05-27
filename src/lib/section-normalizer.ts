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

export const normalizeKey = (key: string): string => {
  return key.toUpperCase().replace(/[^0-9A-Z()]/g, '');
};

function getActAbbreviation(act: string): string {
  const clean = act.trim().toLowerCase();
  if (clean.includes('penal') || clean === 'ipc') return 'IPC';
  if (clean.includes('procedure') || clean === 'crpc') return 'CrPC';
  if (clean.includes('evidence') || clean === 'iea') return 'IEA';
  if (clean.includes('nyaya') || clean === 'bns') return 'BNS';
  if (clean.includes('nagarik') || clean === 'bnss') return 'BNSS';
  if (clean.includes('sakshya') || clean === 'bsa') return 'BSA';

  const uppercaseMatches = act.replace(/[^A-Z]/g, '');
  return uppercaseMatches || act.toUpperCase();
}

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

function buildLookup(
  mappings: SectionMapping[],
  actAlias: Record<string, string>
): Map<string, Map<string, LookupEntry>> {
  const lookup = new Map<string, Map<string, LookupEntry>>();

  for (const m of mappings) {
    const actKey = actAlias[m.old_act.toLowerCase()] || 'IPC';
    const secMatch = m.old_section.match(/Section\s+([\dA-Za-z()]+)/i);
    if (!secMatch) continue;
    
    const secNum = secMatch[1];
    const normSecNum = normalizeKey(secNum);

    const newSecMatch = m.new_section.match(/Section\s+([\dA-Za-z()]+)/i);
    if (!newSecMatch) continue;

    if (!lookup.has(actKey)) lookup.set(actKey, new Map());
    lookup.get(actKey)!.set(normSecNum, {
      newSection: newSecMatch[1],
      oldAct: m.old_act,
      newAct: m.new_act,
    });
  }

  return lookup;
}

interface ReplacementPlan {
  start: number;
  end: number;
  oldText: string;
  newText: string;
  oldAct: string;
  newAct: string;
}

export async function normalizeSections(text: string): Promise<NormalizationResult> {
  if (!text) return { original_text: '', normalized_text: '', replacements: [] };

  const mappings = await loadMappings();
  const rawReplacements: Replacement[] = [];
  const plans: ReplacementPlan[] = [];

  // Dynamically resolve abbreviation resolvers from database mappings
  const actAlias: Record<string, string> = {};
  const newActAbbr: Record<string, string> = {};

  for (const m of mappings) {
    const canonicalOld = getActAbbreviation(m.old_act);
    const canonicalNew = getActAbbreviation(m.new_act);

    actAlias[m.old_act.toLowerCase()] = canonicalOld;
    actAlias[canonicalOld.toLowerCase()] = canonicalOld; // Map the abbreviation itself
    newActAbbr[canonicalOld] = canonicalNew;
  }

  const lookup = buildLookup(mappings, actAlias);

  // Construct dynamic act search regex including both names and abbreviations
  const actsSet = new Set<string>();
  for (const m of mappings) {
    actsSet.add(m.old_act);
    const abbr = getActAbbreviation(m.old_act);
    actsSet.add(abbr);
  }

  const uniqueOldActs = Array.from(actsSet)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const escapedActs = uniqueOldActs.map((act) => act.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');

  // Regex to match section references dynamically, supporting lists, bare sections, hyphens, and subsections
  const pattern = new RegExp(
    `\\b(?:(?:Sections?|u\\/s)\\s+)?((?:\\d+[-_]?[A-Za-z]*(?:\\(\\d+\\))?)(?:\\s*(?:,\\s*|\\band\\b\\s*|&|\\bor\\b\\s*)\\s*(?:\\d+[-_]?[A-Za-z]*(?:\\(\\d+\\))?))*)\\s+(?:of\\s+the\\s+|of\\s+|under\\s+)?(${escapedActs})(?:\\s*,\\s*\\d{4})?\\b`,
    'gi'
  );

  let match;
  pattern.lastIndex = 0;

  while ((match = pattern.exec(text)) !== null) {
    const fullMatch = match[0];
    const sectionsStr = match[1];
    const actName = match[2];

    const actKey = actAlias[actName.toLowerCase()] || 'IPC';
    const actLookup = lookup.get(actKey);
    if (!actLookup) continue;

    // Split compound sections safely by commas, 'and', 'or', and '&'
    const parts = sectionsStr.split(/,|\band\b|&|\bor\b/gi);
    const normalizedParts: string[] = [];
    let replacedAny = false;

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Extract section code supporting alpha, hyphens, and parenthesized subsections
      const secMatch = trimmed.match(/\b(\d+[-_]?[A-Z]?(?:\(\d+\))?)(?!\w)/i);
      if (secMatch) {
        const secCode = secMatch[1];
        const normKey = normalizeKey(secCode);
        const entry = actLookup.get(normKey);

        if (entry) {
          rawReplacements.push({
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

    if (replacedAny) {
      const newActName = newActAbbr[actKey] || actKey;
      const joined =
        normalizedParts.length > 1
          ? normalizedParts.slice(0, -1).join(', ') + ' and ' + normalizedParts[normalizedParts.length - 1]
          : normalizedParts[0];

      // Rebuild matching prefix formatting (u/s vs Section/Sections)
      let prefixWord = 'Section';
      if (fullMatch.toLowerCase().startsWith('u/s')) {
        prefixWord = 'u/s';
      } else if (normalizedParts.length > 1) {
        prefixWord = 'Sections';
      }

      // Strips enactment year dynamically (e.g. BNS instead of BNS, 1860)
      const newText = `${prefixWord} ${joined} ${newActName}`;
      
      plans.push({
        start: match.index,
        end: match.index + fullMatch.length,
        oldText: fullMatch,
        newText,
        oldAct: actKey,
        newAct: newActName,
      });
    }
  }

  // Positional replacement in reverse order to ensure index shift safety
  let normalizedText = text;
  plans.sort((a, b) => b.start - a.start);
  for (const plan of plans) {
    normalizedText =
      normalizedText.substring(0, plan.start) +
      plan.newText +
      normalizedText.substring(plan.end);
  }

  // Deduplicate mappings
  const seen = new Set<string>();
  const uniqueReplacements: Replacement[] = [];
  for (const r of rawReplacements) {
    const key = `${r.old_text}->${r.new_text}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueReplacements.push(r);
    }
  }

  return {
    original_text: text,
    normalized_text: normalizedText,
    replacements: uniqueReplacements,
  };
}
