import { readdir, readFile } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build']);

export function isValidPort(port) {
  const num = Number(port);
  return Number.isInteger(num) && num >= 1 && num <= 65535;
}

export function parseEnvContent(text, filePath = '.env') {
  const results = [];
  if (typeof text !== 'string') return results;

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z0-9_]*PORT[A-Za-z0-9_]*)\s*=\s*["']?([^\s#"']+)["']?/i);
    if (match) {
      const [, key, rawVal] = match;
      if (isValidPort(rawVal)) {
        results.push({
          port: Number(rawVal),
          source: filePath,
          key,
          raw: trimmed
        });
      }
    }
  }

  return results;
}

export function parsePackageJsonContent(text, filePath = 'package.json') {
  const results = [];
  if (typeof text !== 'string') return results;

  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return results;
  }

  if (!pkg || typeof pkg !== 'object' || !pkg.scripts || typeof pkg.scripts !== 'object') {
    return results;
  }

  const portPattern = /(?:--port|-p)(?:\s+|=)(["']?)(\d+)\1/g;

  for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
    if (typeof scriptCmd !== 'string') continue;

    portPattern.lastIndex = 0;
    let match;
    while ((match = portPattern.exec(scriptCmd)) !== null) {
      const rawPort = match[2];
      if (isValidPort(rawPort)) {
        results.push({
          port: Number(rawPort),
          source: filePath,
          script: scriptName,
          raw: scriptCmd
        });
      }
    }
  }

  return results;
}

export async function scanDirectory(rootPath) {
  const entries = [];

  async function walk(currentDir) {
    let dirEntries;
    try {
      dirEntries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const dirent of dirEntries) {
      const fullPath = join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        if (!IGNORED_DIRS.has(dirent.name)) {
          await walk(fullPath);
        }
      } else if (dirent.isFile()) {
        const name = dirent.name;
        const relPath = relative(rootPath, fullPath) || name;

        if (name === '.env' || name === '.env.example' || name.startsWith('.env.')) {
          try {
            const content = await readFile(fullPath, 'utf8');
            entries.push(...parseEnvContent(content, relPath));
          } catch {
            // gracefully skip unreadable files
          }
        } else if (name === 'package.json') {
          try {
            const content = await readFile(fullPath, 'utf8');
            entries.push(...parsePackageJsonContent(content, relPath));
          } catch {
            // gracefully skip unreadable files
          }
        }
      }
    }
  }

  await walk(rootPath);
  return entries;
}

export function detectConflicts(declarations) {
  const ports = {};

  for (const item of declarations) {
    if (!ports[item.port]) {
      ports[item.port] = [];
    }
    ports[item.port].push(item.source);
  }

  const conflicts = [];
  for (const [portStr, sources] of Object.entries(ports)) {
    if (sources.length > 1) {
      conflicts.push({
        port: Number(portStr),
        sources: [...new Set(sources)]
      });
    }
  }

  return {
    declarations,
    ports,
    conflicts,
    hasConflicts: conflicts.length > 0
  };
}

export function formatTerminalReport(analysis) {
  const output = [];
  output.push('PortScout\n');
  output.push('Scanning project...\n');

  const portKeys = Object.keys(analysis.ports);
  if (portKeys.length === 0) {
    output.push('No port declarations found.\n');
    output.push('Scan complete.');
    return output.join('\n');
  }

  output.push('Found port declarations:\n');

  for (const port of portKeys) {
    const sources = analysis.ports[port];
    output.push(`PORT ${port}`);
    for (const src of sources) {
      output.push(`  ${src}`);
    }
    output.push('');
  }

  if (analysis.hasConflicts) {
    output.push('Potential configuration conflict detected.\n');
  } else {
    output.push('No configuration conflicts detected.\n');
  }

  output.push('Scan complete.');
  return output.join('\n');
}
