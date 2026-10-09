#!/usr/bin/env node
'use strict';

// Compare protected implementation and configuration files without printing their contents.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const serialAccessMarker = 'serial';
const serialAccessPattern = /\bnavigator\s*(?:\?\.|\.)\s*serial\b|\(\s*navigator\s+as\s+[^)]*\)\s*(?:\?\.|\.)\s*serial\b/;
const sourceExtension = /\.(?:[cm]?[jt]sx?|vue|svelte|html)$/;
const sourceGlobs = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mts', '*.cts', '*.mjs', '*.cjs', '*.vue', '*.svelte', '*.html'];
const explicitlyProtected = [
  'lib/firebase.ts',
  'hooks/useTelemetry.ts',
  'lib/iot-service.ts',
  'app/patient/device/page.tsx',
];

function git(args, allowedStatuses = [0]) {
  const result = spawnSync('git', ['-C', repositoryRoot, ...args], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || !allowedStatuses.includes(result.status)) {
    throw new Error(`Unable to run Git ${args[0]}. A repository with a HEAD commit is required.`);
  }
  return result.stdout;
}

function fileList(output) {
  return output.split('\0').filter(Boolean);
}

function normalizeLineEndings(contents) {
  return contents.replace(/\r\n/g, '\n');
}

function localContents(relativePath) {
  const absolutePath = path.join(repositoryRoot, ...relativePath.split('/'));
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : null;
}

function isFirebaseConfiguration(relativePath) {
  const name = path.posix.basename(relativePath);
  return name === '.firebaserc' ||
    /^firebase[^/]*\.json$/i.test(name) ||
    /^(?:firestore|storage|database)(?:[.-][^/]*)?\.json$/i.test(name) ||
    name.endsWith('.rules');
}

try {
  const headPaths = new Set(fileList(git(['ls-tree', '-r', '-z', '--name-only', 'HEAD'])));
  const trackedPaths = new Set(fileList(git(['ls-files', '-z'])));
  const allPaths = new Set([...headPaths, ...trackedPaths]);
  const protectedPaths = new Set([
    ...explicitlyProtected,
    ...Array.from(allPaths).filter(isFirebaseConfiguration),
  ]);

  const headSerialPaths = fileList(git(['grep', '-l', '-z', '-F', serialAccessMarker, 'HEAD', '--', ...sourceGlobs], [0, 1]))
    .map((relativePath) => relativePath.replace(/^HEAD:/, ''))
    .filter((relativePath) => serialAccessPattern.test(git(['show', 'HEAD:' + relativePath])));
  const currentSerialPaths = Array.from(trackedPaths).filter((relativePath) => (
    sourceExtension.test(relativePath) && serialAccessPattern.test(localContents(relativePath) || '')
  ));
  const serialPaths = new Set([...headSerialPaths, ...currentSerialPaths]);
  const checkedPaths = new Set([...protectedPaths, ...serialPaths]);
  const failures = [];

  for (const relativePath of Array.from(checkedPaths).sort()) {
    if (!headPaths.has(relativePath)) {
      failures.push(`${relativePath}: no HEAD baseline for protected source`);
      continue;
    }
    const contents = localContents(relativePath);
    if (contents === null) {
      failures.push(`${relativePath}: protected file is missing`);
      continue;
    }
    const baseline = git(['show', `HEAD:${relativePath}`]);
    if (normalizeLineEndings(contents) !== normalizeLineEndings(baseline)) {
      failures.push(`${relativePath}: differs from HEAD`);
    }
  }

  // Verify Base64 medical record upload logic in MedicalRecordsList.tsx
  const uploadFnPattern = /const handleUploadSubmit = async [\s\S]*?\n  \};/;
  const currentMedicalRecords = localContents('components/patient/MedicalRecordsList.tsx');
  if (!currentMedicalRecords) {
    failures.push('components/patient/MedicalRecordsList.tsx: protected file is missing');
  } else {
    const baselineMedicalRecords = git(['show', 'HEAD:components/patient/MedicalRecordsList.tsx']);
    const currentUploadMatch = currentMedicalRecords.match(uploadFnPattern);
    const baselineUploadMatch = baselineMedicalRecords.match(uploadFnPattern);
    if (!currentUploadMatch || !baselineUploadMatch || normalizeLineEndings(currentUploadMatch[0]) !== normalizeLineEndings(baselineUploadMatch[0])) {
      failures.push('components/patient/MedicalRecordsList.tsx: Base64 medical record upload logic differs from HEAD');
    }
  }

  if (failures.length) {
    console.error(`FAIL guardrail verification (${failures.length} protected file${failures.length === 1 ? '' : 's'} changed):`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${protectedPaths.size} protected implementation/configuration files match HEAD.`);
    console.log(`PASS ${serialPaths.size} tracked sources with browser serial access match HEAD.`);
    console.log('Line endings normalized; no configuration or source contents were printed.');
  }
} catch (error) {
  console.error(`FAIL guardrail verification: ${error instanceof Error ? error.message : 'Unable to complete verification.'}`);
  process.exitCode = 1;
}
