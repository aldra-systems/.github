#!/usr/bin/env node
// Sync labels.yml to GitHub repos with the gh CLI. No dependencies.
// Usage: node scripts/sync-labels.mjs [--dry-run] [--prune] [owner/repo ...]
// Default repos: every non-archived repo of the aldra-systems org.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORG = 'aldra-systems';
const LABELS_FILE = fileURLToPath(new URL('../labels.yml', import.meta.url));

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

// Parses the flat format of labels.yml: "- name:" starts an entry, "key: value" lines follow.
function parseLabels(text) {
  const labels = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(- )?(\w+):\s*(.*)$/);
    if (!m) throw new Error(`Cannot parse line: ${raw}`);
    const [, dash, key, rest] = m;
    let value = rest.trim();
    if (/^".*"$/.test(value)) value = value.slice(1, -1);
    if (dash) {
      current = {};
      labels.push(current);
    }
    if (!current) throw new Error(`Key outside an entry: ${raw}`);
    current[key] = value;
  }
  for (const l of labels) {
    if (!l.name || !/^[0-9a-fA-F]{6}$/.test(l.color ?? '')) {
      throw new Error(`Invalid label entry: ${JSON.stringify(l)}`);
    }
    l.color = l.color.toLowerCase();
    l.description ??= '';
  }
  return labels;
}

function syncRepo(repo, wanted, { dryRun, prune }) {
  const existing = JSON.parse(
    gh(['label', 'list', '-R', repo, '-L', '500', '--json', 'name,color,description']),
  );
  const byName = new Map(existing.map((l) => [l.name.toLowerCase(), l]));
  const wantedNames = new Set(wanted.map((l) => l.name.toLowerCase()));
  const plan = [];

  for (const l of wanted) {
    const cur = byName.get(l.name.toLowerCase());
    if (!cur) plan.push({ op: 'create', label: l });
    else if (
      cur.name !== l.name ||
      cur.color.toLowerCase() !== l.color ||
      (cur.description ?? '') !== l.description
    ) {
      plan.push({ op: 'update', label: l, from: cur.name });
    }
  }
  if (prune) {
    for (const cur of existing) {
      if (!wantedNames.has(cur.name.toLowerCase())) plan.push({ op: 'delete', label: cur });
    }
  }

  console.log(`\n${repo}: ${plan.length} change(s)${dryRun ? ' (dry run)' : ''}`);
  for (const { op, label, from } of plan) {
    console.log(`  ${op.padEnd(6)} ${op === 'update' ? from : label.name}`);
    if (dryRun) continue;
    if (op === 'create') {
      gh(['label', 'create', label.name, '-R', repo, '--color', label.color, '--description', label.description]);
    } else if (op === 'update') {
      gh(['label', 'edit', from, '-R', repo, '--name', label.name, '--color', label.color, '--description', label.description]);
    } else {
      gh(['label', 'delete', label.name, '-R', repo, '--yes']);
    }
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const prune = args.includes('--prune');
const repoArgs = args.filter((a) => !a.startsWith('--'));
const unknown = args.filter((a) => a.startsWith('--') && !['--dry-run', '--prune'].includes(a));
if (unknown.length) {
  console.error(`Unknown option: ${unknown.join(' ')}`);
  process.exit(2);
}

const wanted = parseLabels(readFileSync(LABELS_FILE, 'utf8'));
const repos = repoArgs.length
  ? repoArgs
  : gh(['repo', 'list', ORG, '-L', '200', '--no-archived', '--json', 'nameWithOwner', '-q', '.[].nameWithOwner'])
      .split('\n')
      .filter(Boolean);

for (const repo of repos) syncRepo(repo, wanted, { dryRun, prune });
