import { VerificationResult, NormalizationResult, CitationReport } from './types';

interface CitationOccurrence {
  start: number;
  end: number;
  origText: string;
  badge: string;
  length: number;
}

export function annotateTextAndReport(
  text: string,
  verifications: VerificationResult[],
  normalization: NormalizationResult,
  apiCallsMade: number,
  apiCostInr: number
): { annotatedText: string; report: CitationReport } {
  const normalizedText = normalization.normalized_text;
  let verified = 0;
  let corrected = 0;
  let unverified = 0;
  let removed = 0;

  // 1. Calculate unique verification stats
  for (const v of verifications) {
    if (v.status === 'VERIFIED') {
      if (v.corrected_text) {
        corrected++;
      } else {
        verified++;
      }
    } else if (v.status === 'NOT_FOUND') {
      removed++;
    } else {
      unverified++;
    }
  }

  // 2. Identify all positional occurrences of all citations in normalizedText
  const occurrences: CitationOccurrence[] = [];

  for (const v of verifications) {
    const orig = v.citation.text;
    const escaped = orig.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');

    // Build the clean badge representation
    let badge = '';
    if (v.status === 'VERIFIED') {
      if (v.corrected_text) {
        const link = v.ik_doc_id ? `https://indiankanoon.org/doc/${v.ik_doc_id}/` : null;
        badge = link
          ? `${v.corrected_text} [⚠️ CORRECTED] [✅ VERIFIED - [${v.case_name}](${link})]`
          : `${v.corrected_text} [⚠️ CORRECTED] [✅ VERIFIED - ${v.case_name}]`;
      } else {
        const link = v.ik_doc_id ? `https://indiankanoon.org/doc/${v.ik_doc_id}/` : null;
        badge = link
          ? `${orig} [✅ VERIFIED - [${v.case_name}](${link})]`
          : `${orig} [✅ VERIFIED - ${v.case_name}]`;
      }
    } else if (v.status === 'NOT_FOUND') {
      const hasError = v.hallucination_flags.some((f) => f.severity === 'ERROR');
      const reason = hasError ? 'Hallucinated' : 'Fabricated';
      badge = `[❌ REMOVED - ${reason}: ${orig}]`;
    } else {
      badge = `${orig} [⚠️ UNVERIFIED]`;
    }

    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(normalizedText)) !== null) {
      occurrences.push({
        start: match.index,
        end: match.index + match[0].length,
        origText: match[0],
        badge,
        length: match[0].length,
      });
    }
  }

  // 3. Resolve overlapping matches by filtering from longest to shortest
  occurrences.sort((a, b) => b.length - a.length);
  const validOccurrences: CitationOccurrence[] = [];

  for (const occ of occurrences) {
    let hasOverlap = false;
    for (const valid of validOccurrences) {
      if (occ.start < valid.end && valid.start < occ.end) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) {
      validOccurrences.push(occ);
    }
  }

  // 4. Apply replacements from last to first in the text to guarantee index safety
  let annotatedText = normalizedText;
  validOccurrences.sort((a, b) => b.start - a.start);
  for (const occ of validOccurrences) {
    annotatedText =
      annotatedText.substring(0, occ.start) +
      occ.badge +
      annotatedText.substring(occ.end);
  }

  const total = verifications.length;
  const normalized_sections = normalization.replacements.length;
  const total_entities = total + normalized_sections;
  
  // Accuracy combines correctly verified/corrected citations PLUS correctly normalized sections
  // If there are no entities processed, accuracy is explicitly 0 (not 100%)
  const accuracy_pct = total_entities > 0 
    ? Math.round(((verified + corrected + normalized_sections) / total_entities) * 1000) / 10 
    : 0;

  return {
    annotatedText,
    report: {
      total,
      total_entities,
      normalized_sections,
      verified,
      corrected,
      unverified,
      removed,
      accuracy_pct,
      api_calls_made: apiCallsMade,
      api_cost_inr: apiCostInr,
    },
  };
}
