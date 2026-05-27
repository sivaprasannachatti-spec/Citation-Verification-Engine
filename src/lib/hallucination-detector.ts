import { Citation, HallucinationFlag } from './types';

export function getCurrentLegalYear(): number {
  return new Date().getFullYear();
}

/**
 * Deterministic hallucination detection.
 * NO AI involved — purely rule-based safety checks.
 */
export function detectHallucinations(citation: Citation): HallucinationFlag[] {
  const flags: HallucinationFlag[] = [];
  const currentYear = getCurrentLegalYear();

  // RULE 1: Future Year — citation year > current legal year
  if (citation.year > currentYear) {
    flags.push({
      rule: 'RULE 1 — FUTURE YEAR',
      description: `Citation year ${citation.year} is in the future (> ${currentYear}). This case cannot exist.`,
      severity: 'ERROR',
    });
  }

  // RULE 2: Impossible SCC/SCR Volume — SCC publishes ~10-20 volumes/year
  if (
    (citation.pattern_name === 'SCC' || citation.pattern_name === 'SCR') &&
    citation.volume !== null &&
    citation.volume > 25
  ) {
    flags.push({
      rule: 'RULE 2 — IMPOSSIBLE VOLUME',
      description: `Volume ${citation.volume} exceeds the realistic annual limit (>25) for ${citation.pattern_name}.`,
      severity: 'ERROR',
    });
  }

  // RULE 3: Impossible Page Number — pages rarely exceed 2000
  if (citation.page > 5000) {
    flags.push({
      rule: 'RULE 3 — IMPOSSIBLE PAGE',
      description: `Page number ${citation.page} is abnormally high (>5000). Suspicious.`,
      severity: 'WARNING',
    });
  }

  // RULE 4: Pre-Modern Date — Indian law reports start ~1900s
  if (citation.year < 1900) {
    flags.push({
      rule: 'RULE 4 — PRE-MODERN DATE',
      description: `Citation year ${citation.year} is pre-1900. Modern Indian law reports did not exist.`,
      severity: 'WARNING',
    });
  }

  return flags;
}
