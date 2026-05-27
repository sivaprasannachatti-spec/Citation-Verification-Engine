import '../src/lib/env-loader';
import { extractCitations } from '../src/lib/citation-extractor';
import { verifyAllCitations } from '../src/lib/citation-verifier';

async function testLiveVerification() {
  console.log('==================================================');
  console.log('  LIVE IK API VERIFICATION CLASSIFICATION TEST');
  console.log('==================================================\n');

  // This text contains:
  // 1. REAL citation: (1978) 1 SCC 240  (Gudikanti Narasimhulu)
  // 2. REAL citation: (2019) 9 SCC 1    (P. Chidambaram)
  // 3. FABRICATED citation: (2023) 4 SCC 789 (does NOT exist)
  // 4. CORRECTABLE citation: (2020) 5 SCC 12  (wrong page, should correct to 421 or 1)
  // 5. REAL Cri LJ: 2012 Cri LJ 2309
  const testText = `
    The Supreme Court in Gudikanti Narasimhulu v. Public Prosecutor (1978) 1 SCC 240 held that
    anticipatory bail can be granted in economic offences.

    In P. Chidambaram v. Directorate of Enforcement (2019) 9 SCC 1 the court considered
    the gravity of the offence.

    As per the fabricated case Rajesh Sharma v. State of UP (2023) 4 SCC 789 held that
    anticipatory bail is a fundamental right.

    The court in State v. XYZ (2020) 5 SCC 12 corrected the position on economic offences.

    Also refer to 2012 Cri LJ 2309 for anticipatory bail precedents.
  `;

  console.log('Step 1: Extracting citations...');
  const citations = await extractCitations(testText);
  console.log(`  Extracted ${citations.length} citations:`);
  for (const c of citations) {
    console.log(`    - ${c.canonical || c.text} [${c.pattern_name}]`);
  }

  console.log('\nStep 2: Running live verification against Indian Kanoon API...');
  const { results, apiCallsMade, apiCostInr } = await verifyAllCitations(citations);

  console.log(`\n  API calls made: ${apiCallsMade}`);
  console.log(`  API cost: ₹${apiCostInr.toFixed(2)}\n`);

  console.log('Step 3: Classification Results:');
  console.log('──────────────────────────────────────────');
  for (const r of results) {
    const cit = r.citation.canonical || r.citation.text;
    const status = r.corrected_text ? 'CORRECTED' : r.status;
    const extra = r.corrected_text ? ` → ${r.corrected_text}` : '';
    const caseName = r.case_name ? ` (${r.case_name.substring(0, 50)})` : '';
    console.log(`  [${status}] ${cit}${extra}${caseName}`);
    if (r.hallucination_flags.length > 0) {
      for (const f of r.hallucination_flags) {
        console.log(`         ⚠️ ${f.rule}: ${f.description}`);
      }
    }
  }

  // Aggregate
  let verified = 0, corrected = 0, removed = 0, unverified = 0;
  for (const r of results) {
    if (r.status === 'VERIFIED' && r.corrected_text) corrected++;
    else if (r.status === 'VERIFIED') verified++;
    else if (r.status === 'NOT_FOUND') removed++;
    else unverified++;
  }

  console.log('\n──────────────────────────────────────────');
  console.log('Step 4: Report Metrics:');
  console.log(`  Total Citations: ${results.length}`);
  console.log(`  ✅ Verified:     ${verified}`);
  console.log(`  ⚠️ Corrected:    ${corrected}`);
  console.log(`  ❌ Removed:      ${removed}`);
  console.log(`  ❓ Unverified:   ${unverified}`);

  const total = results.length;
  const accuracy = total > 0 ? Math.round(((verified + corrected) / total) * 1000) / 10 : 0;
  console.log(`  📊 Accuracy:     ${accuracy}%`);

  // Expected results:
  console.log('\n──────────────────────────────────────────');
  console.log('Expected Classification:');
  console.log('  (1978) 1 SCC 240  → VERIFIED');
  console.log('  (2019) 9 SCC 1    → VERIFIED');
  console.log('  (2023) 4 SCC 789  → REMOVED (fabricated)');
  console.log('  (2020) 5 SCC 12   → CORRECTED (wrong page)');
  console.log('  2012 Cri LJ 2309  → VERIFIED or CORRECTED');
  console.log('==================================================');
}

testLiveVerification().catch(console.error);
