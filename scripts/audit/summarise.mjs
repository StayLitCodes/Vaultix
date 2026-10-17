#!/usr/bin/env node
// Summarise an `npm audit --json` or `cargo audit --json` report (issue #858).
//
//   node scripts/audit/summarise.mjs npm   <report.json>
//   node scripts/audit/summarise.mjs cargo <report.json>
//
// Prints a one-line severity summary (and details for the serious ones) and
// exits non-zero when any HIGH or CRITICAL advisory is present. Lower
// severities are reported but do not fail the run.
import { readFileSync } from 'node:fs';

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'medium', 'high', 'critical'];
const SERIOUS = new Set(['high', 'critical']);

const [, , ecosystem, file] = process.argv;
if (!ecosystem || !file) {
  console.error('usage: summarise.mjs <npm|cargo> <report.json>');
  process.exit(2);
}

let data;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`  ${ecosystem}: could not parse ${file} (${err.message})`);
  process.exit(2);
}

const counts = Object.create(null);
const details = [];
const bump = (severity) => {
  const key = String(severity || 'unknown').toLowerCase();
  counts[key] = (counts[key] || 0) + 1;
};

if (ecosystem === 'npm') {
  const meta = (data && data.metadata && data.metadata.vulnerabilities) || {};
  for (const [severity, count] of Object.entries(meta)) {
    if (severity === 'total') continue;
    counts[severity] = (counts[severity] || 0) + Number(count);
  }
  for (const [name, info] of Object.entries(data.vulnerabilities || {})) {
    const severity = String((info && info.severity) || 'unknown').toLowerCase();
    if (SERIOUS.has(severity)) {
      const via = Array.isArray(info.via) ? info.via[0] : undefined;
      const title = via && typeof via === 'object' ? via.title : via;
      details.push(`    - ${name} (${severity})${title ? `: ${title}` : ''}`);
    }
  }
} else if (ecosystem === 'cargo') {
  const list = (data.vulnerabilities && data.vulnerabilities.list) || [];
  for (const item of list) {
    const advisory = item.advisory || item;
    bump(advisory.severity);
  }
  for (const item of list) {
    const advisory = item.advisory || item;
    const severity = String(advisory.severity || 'unknown').toLowerCase();
    if (SERIOUS.has(severity)) {
      const id = advisory.id || advisory.package || 'advisory';
      details.push(`    - ${id} (${severity})${advisory.title ? `: ${advisory.title}` : ''}`);
    }
  }
} else {
  console.error(`  unknown ecosystem: ${ecosystem}`);
  process.exit(2);
}

const order = [
  ...SEVERITY_ORDER,
  ...Object.keys(counts).filter((s) => !SEVERITY_ORDER.includes(s)),
];
const present = order.filter((s) => counts[s]).map((s) => `${s}=${counts[s]}`);

console.log(`  ${ecosystem}: ${present.length ? present.join(', ') : 'no advisories'}`);
if (details.length) {
  console.log(details.join('\n'));
}

const serious = [...SERIOUS].reduce((total, s) => total + (counts[s] || 0), 0);
process.exit(serious > 0 ? 1 : 0);
