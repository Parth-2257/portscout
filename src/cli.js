#!/usr/bin/env node

import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  scanDirectory,
  detectConflicts,
  formatTerminalReport
} from './portmap-audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getVersion() {
  try {
    const pkgPath = join(__dirname, '../package.json');
    const pkgContent = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(pkgContent);
    return pkg.version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function showHelp() {
  console.log(`portmap-audit - Fast Port Conflict Detector

Usage:
  portmap-audit [directory] [options]

Options:
  --json          Output results in JSON format
  -h, --help      Display this help message
  -v, --version   Display version number

Examples:
  portmap-audit
  portmap-audit ./my-project --json
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    const ver = await getVersion();
    console.log(`portmap-audit v${ver}`);
    process.exit(0);
  }

  const isJson = args.includes('--json');
  const dirArg = args.find((arg) => !arg.startsWith('-'));
  const targetDir = resolve(process.cwd(), dirArg || '.');

  try {
    const declarations = await scanDirectory(targetDir);
    const analysis = detectConflicts(declarations);

    if (isJson) {
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      console.log(formatTerminalReport(analysis));
    }
  } catch (err) {
    console.error(`Error during scan: ${err.message}`);
    process.exit(1);
  }
}

main();
