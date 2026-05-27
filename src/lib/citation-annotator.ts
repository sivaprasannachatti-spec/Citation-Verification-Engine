import { VerificationResult, NormalizationResult, CitationReport, ASTSegment } from './types';

interface CitationOccurrence {
  start: number;
  end: number;
  origText: string;
  badge: string;
  length: number;
  verification: VerificationResult;
}

function escapeHtml(str: string): string {
  return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripBadgeSpoofs(str: string): string {
  // Strips any fake badge syntax injected by the LLM (e.g. [✅ VERIFIED - ...])
  return str.replace(/\[(?:✅|❌|⚠️)\s*(?:VERIFIED|REMOVED|CORRECTED|UNVERIFIED).*?\]/gi, '');
}

export function annotateTextAndReport(
  text: string,
  verifications: VerificationResult[],
  normalization: NormalizationResult,
  apiCallsMade: number,
  apiCostInr: number
): { annotatedText: string; segments: ASTSegment[]; report: CitationReport } {
  // Prevent badge spoofing and escape HTML on the normalized output text
  const sanitizedNormalized = escapeHtml(stripBadgeSpoofs(normalization.normalized_text));
  
  let verified = 0;
  let corrected = 0;
  let unverified = 0;
  let removed = 0;

  // Calculate unique verification stats
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

  // Positional occurrences builder
  const occurrences: CitationOccurrence[] = [];

  for (const v of verifications) {
    const orig = escapeHtml(v.citation.text);
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
    while ((match = regex.exec(sanitizedNormalized)) !== null) {
      occurrences.push({
        start: match.index,
        end: match.index + match[0].length,
        origText: match[0],
        badge,
        length: match[0].length,
        verification: v,
      });
    }
  }

  // Resolve overlapping matches by filtering from longest to shortest
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

  // Build the backward-compatible enhanced annotated text string
  let annotatedText = sanitizedNormalized;
  const sortedOccsForString = [...validOccurrences].sort((a, b) => b.start - a.start);
  for (const occ of sortedOccsForString) {
    annotatedText =
      annotatedText.substring(0, occ.start) +
      occ.badge +
      annotatedText.substring(occ.end);
  }

  // Build structured AST segments for secure, position-aware rendering in React
  const segments: ASTSegment[] = [];
  const sortedOccsForSegments = [...validOccurrences].sort((a, b) => a.start - b.start);
  let lastPos = 0;

  for (const occ of sortedOccsForSegments) {
    if (occ.start > lastPos) {
      segments.push({
        type: 'text',
        content: sanitizedNormalized.substring(lastPos, occ.start),
      });
    }
    segments.push({
      type: 'citation',
      content: occ.origText,
      verification: occ.verification,
    });
    lastPos = occ.end;
  }

  if (lastPos < sanitizedNormalized.length) {
    segments.push({
      type: 'text',
      content: sanitizedNormalized.substring(lastPos),
    });
  }

  // Enforce metrics integrity check (Invariant Validation)
  const total = verifications.length;
  const normalized_sections = normalization.replacements.length;
  const total_entities = total + normalized_sections;

  const totalCalculated = verified + corrected + unverified + removed;
  if (totalCalculated !== total) {
    console.warn(`[Observability] Metrics mismatch: calculated=${totalCalculated}, total=${total}. Adjusting unverified counts to preserve metrics invariants.`);
    unverified += (total - totalCalculated);
  }

  // Accuracy combines correctly verified/corrected citations PLUS correctly normalized sections
  const accuracy_pct = total_entities > 0 
    ? Math.round(((verified + corrected + normalized_sections) / total_entities) * 1000) / 10 
    : 0;

  return {
    annotatedText,
    segments,
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
