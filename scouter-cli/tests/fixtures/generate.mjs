// Deterministic example inputs; never fetches or installs anything.
import { writeFile } from 'node:fs/promises';
import { baseline, finding } from './build.mjs';
const pass = baseline();
const review = baseline(); review.reviewId = 'fixture-review'; review.checks = review.checks.filter(c => c.id !== 'leaf:malware');
const block = baseline(); block.reviewId = 'fixture-block'; block.findings.push(finding());
const unsupported = baseline(); unsupported.reviewId = 'fixture-unsupported'; unsupported.project.manager.name = 'pnpm';
for (const [name, value] of Object.entries({ pass, review, block, unsupported })) {
  await writeFile(new URL(`./${name}.json`, import.meta.url), `${JSON.stringify(value, null, 2)}\n`);
}
