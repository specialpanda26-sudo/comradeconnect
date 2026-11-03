import fs from 'node:fs';
import process from 'node:process';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => {
  const a = args.find((x) => x.startsWith('--' + n + '='));
  return a ? a.split('=')[1] : d;
};

const isDryRun = flag('dry');
const urlArg = args.find((x) => !x.startsWith('--') && x.startsWith('http'));
const numArg = args.find((x) => /^\d+$/.test(x));

// --delay=3 means 3 seconds between accounts (default 2 seconds)
const delaySec = parseFloat(opt('delay', '2')) || 2;
const delayMs = delaySec * 1000;

if (!urlArg) {
  console.log('❌ Error: No referral URL provided.');
  console.log('Usage: node scripts/referral-bot.mjs "<URL>" [count] [--delay=seconds]');
  process.exit(1);
}

let N = parseInt(numArg, 10) || 5;
N = Math.max(1, Math.min(1000, N));

try {
  const targetUrl = new URL(urlArg);
  const refCode = targetUrl.searchParams.get('ref') || 'None';

  console.log('\n================================================--');
  console.log(`🌐 Target Site    : ${targetUrl.origin}`);
  console.log(`📌 Target Path    : ${targetUrl.pathname}`);
  console.log(`🏷️  Referral Ref   : ${refCode}`);
  console.log(`📊 Accounts Target: ${N}`);
  console.log(`⏱️  Pacing Delay   : ${delaySec} seconds per account`);
  console.log(`⚙️  Mode           : ${isDryRun ? 'DRY RUN (Simulation)' : 'LIVE TIMED BATCH'}`);
  console.log('================================================--\n');

  if (isDryRun) {
    console.log('✅ [DRY RUN] Referral URL format validated successfully.');
    console.log(`✅ [DRY RUN] Would simulate creating ${N} accounts with a ${delaySec}s pause between each.`);
    process.exit(0);
  }

  const OUT = 'referral-bot-out';
  fs.mkdirSync(OUT, { recursive: true });

  const FIRST = ['David', 'Brian', 'Kevin', 'Peter', 'John', 'Samuel', 'Joseph', 'Dennis', 'Collins', 'Felix', 'Mercy', 'Faith', 'Grace', 'Esther', 'Lucy', 'Winnie'];
  const LAST = ['Karanja', 'Kamau', 'Mwangi', 'Njoroge', 'Kariuki', 'Maina', 'Kimani', 'Wanjiru', 'Otieno', 'Odhiambo', 'Ochieng', 'Omondi', 'Onyango'];
  const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

  console.log(`🚀 Starting timed batch of ${N} accounts...\n`);

  let successCount = 0;
  const results = [];

  for (let i = 1; i <= N; i++) {
    const firstName = FIRST[Math.floor(Math.random() * FIRST.length)];
    const lastName = LAST[Math.floor(Math.random() * LAST.length)];
    const username = `${firstName.toLowerCase()}${lastName.toLowerCase()}${digits(2)}`;
    const email = `${username}@example.com`;

    console.log(`  #${String(i).padStart(3)} [User: ${username}] -> Connecting...`);
    const startTime = performance.now();

    try {
      const response = await fetch(targetUrl.href, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        },
        redirect: 'follow'
      });

      const endTime = performance.now();
      const durationSec = ((endTime - startTime) / 1000).toFixed(3);

      const ok = response.ok;
      if (ok) successCount++;

      console.log(`        Status: ${response.status} ${response.statusText} | Took: ${durationSec}s ${ok ? '✅ SUCCESS' : '⚠️ FAILED'}`);
      results.push({ n: i, username, email, status: response.status, durationSeconds: parseFloat(durationSec), ok });
    } catch (err) {
      const endTime = performance.now();
      const durationSec = ((endTime - startTime) / 1000).toFixed(3);
      console.log(`        ❌ Error after ${durationSec}s: ${err.message}`);
      results.push({ n: i, username, email, status: 0, durationSeconds: parseFloat(durationSec), ok: false, error: err.message });
    }

    // Wait for the specified delay in seconds before the next account
    if (i < N) {
      console.log(`        ⏳ Waiting ${delaySec}s before next account...\n`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  fs.writeFileSync(`${OUT}/accounts.json`, JSON.stringify(results, null, 2));

  console.log(`\n================================================--`);
  console.log(`🏁 BATCH COMPLETE: ${successCount}/${N} referral hits processed successfully.`);
  console.log(`📁 Detailed timing report saved to ${OUT}/accounts.json`);
  console.log(`================================================--\n`);

} catch (err) {
  console.error('❌ Execution failed:', err.message);
  process.exit(1);
}
