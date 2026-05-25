import { VerificationResult, NormalizationResult, CitationReport } from './types';

export function annotateTextAndReport(
  text: string,
  verifications: VerificationResult[],
  normalization: NormalizationResult,
  apiCallsMade: number,
  apiCostInr: number
): { annotatedText: string; report: CitationReport } {
  let annotatedText = normalization.normalized_text;
  let verified = 0;
  let corrected = 0;
  let unverified = 0;
  let removed = 0;

  for (const v of verifications) {
    const orig = v.citation.text;
    let badge = '';

    if (v.status === 'VERIFIED') {
      if (v.corrected_text) {
        corrected++;
        const link = v.ik_doc_id ? `https://indiankanoon.org/doc/${v.ik_doc_id}/` : null;
        badge = link
          ? `${v.corrected_text} [⚠️ CORRECTED] [✅ VERIFIED - [${v.case_name}](${link})]`
          : `${v.corrected_text} [⚠️ CORRECTED] [✅ VERIFIED - ${v.case_name}]`;
      } else {
        verified++;
        const link = v.ik_doc_id ? `https://indiankanoon.org/doc/${v.ik_doc_id}/` : null;
        badge = link
          ? `${orig} [✅ VERIFIED - [${v.case_name}](${link})]`
          : `${orig} [✅ VERIFIED - ${v.case_name}]`;
      }
    } else if (v.status === 'NOT_FOUND') {
      removed++;
      const hasError = v.hallucination_flags.some((f) => f.severity === 'ERROR');
      const reason = hasError ? 'Hallucinated' : 'Fabricated';
      badge = `[❌ REMOVED - ${reason}: ${orig}]`;
    } else {
      unverified++;
      badge = `${orig} [⚠️ UNVERIFIED]`;
    }

    if (annotatedText.includes(orig)) {
      annotatedText = annotatedText.replace(orig, badge);
    }
  }

  const total = verifications.length;
  const accuracy_pct = total > 0 ? Math.round(((verified + corrected) / total) * 1000) / 10 : 100;

  return {
    annotatedText,
    report: {
      total,
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
