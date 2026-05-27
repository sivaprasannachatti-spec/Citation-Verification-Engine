import '../src/lib/env-loader';
import { extractCitations } from '../src/lib/citation-extractor';
import { normalizeSections } from '../src/lib/section-normalizer';
import { verifyAllCitations } from '../src/lib/citation-verifier';
import { annotateTextAndReport } from '../src/lib/citation-annotator';

const SURPRISE_SCENARIOS = [
  {
    topic: 'Constitutional Law',
    text: `
      In Kesavananda Bharati v. State of Kerala (1973) 4 SCC 225, the Supreme Court established the basic structure doctrine,
      limiting the amending power of Parliament. This landmark judgment effectively overruled the earlier decision in
      I.C. Golaknath v. State of Punjab AIR 1967 SC 1643 which held that fundamental rights could not be amended.
      Also check Section 65B IEA electronic record admissibility rules for constitutional filings.
    `
  },
  {
    topic: 'Family Law & Maintenance',
    text: `
      The wife filed a petition for maintenance under Section 125 CrPC, 1973.
      The court referred to the landmark case on cooling-off waivers under Section 13B of the Hindu Marriage Act,
      citing Amardeep Singh v. Harveen Kaur (2017) 8 SCC 744, which held that the statutory period is directory and not mandatory.
    `
  },
  {
    topic: 'Property Dispute & Specific Performance',
    text: `
      The plaintiff filed a suit for specific performance of the sale agreement. The defendant contended that the suit
      is barred by limitation and submitted electronic WhatsApp transcripts as evidence under Section 65B IEA.
      The court referred to (2019) 8 SCC 42 for guidelines on specific performance of contracts.
    `
  },
  {
    topic: 'Arbitration & Commercial Law',
    text: `
      In commercial disputes, the scope of Section 34 of the Arbitration Act is narrow.
      The Supreme Court in Associate Builders v. DDA (2015) 3 SCC 49 clarified the grounds of public policy.
      This was further analyzed in 2021 SCC OnLine SC 233.
    `
  },
  {
    topic: 'Tax Law & Indirect Taxation',
    text: `
      The tax tribunal assessed the GST liabilities. The appellant submitted invoices (e.g. Invoice 2024 SCC 12345 - which should be suppressed),
      but referenced the key GST precedent Union of India v. Mohit Minerals AIR 2022 SC 233.
    `
  }
];

async function runSurpriseTopicsTest() {
  console.log('================================================================');
  console.log('    💼 RUNNING SURPRISE LEGAL TOPICS GENERALIZATION SUITE');
  console.log('================================================================\n');

  for (const scenario of SURPRISE_SCENARIOS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`📂 TESTING TOPIC: ${scenario.topic}`);
    console.log(`----------------------------------------------------------------`);
    
    console.log('Raw text excerpt:', scenario.text.trim().substring(0, 150) + '...');

    // 1. Run extraction
    const citations = await extractCitations(scenario.text);
    console.log(`  Extracted Citations (${citations.length}):`);
    for (const c of citations) {
      console.log(`    - [${c.pattern_name}] ${c.canonical || c.text}`);
    }

    // 2. Run normalization
    const normalization = await normalizeSections(scenario.text);
    console.log(`  Normalized replacements applied: ${normalization.replacements.length}`);
    for (const r of normalization.replacements) {
      console.log(`    - Normalization: ${r.old_text} -> ${r.new_text}`);
    }

    // 3. Verify all citations (combines cache & live or mock checks depending on API key)
    const verifyRes = await verifyAllCitations(citations);
    
    // 4. Annotate
    const { report } = annotateTextAndReport(scenario.text, verifyRes.results, normalization, verifyRes.apiCallsMade, verifyRes.apiCostInr);
    
    console.log('  Verification Report:');
    console.log(`    Total Entities:   ${report.total_entities}`);
    console.log(`    Verified Cases:   ${report.verified}`);
    console.log(`    Corrected Cases:  ${report.corrected}`);
    console.log(`    Removed Cases:    ${report.removed}`);
    console.log(`    Unverified Cases: ${report.unverified}`);
    console.log(`    Accuracy Index:   ${report.accuracy_pct}%`);
  }

  console.log('\n================================================================');
  console.log('   🎉 SURPRISE LEGAL TOPICS SUITE COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runSurpriseTopicsTest().catch(console.error);
