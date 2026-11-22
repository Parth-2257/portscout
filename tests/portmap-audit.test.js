import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidPort,
  parseEnvContent,
  parsePackageJsonContent,
  detectConflicts,
  formatTerminalReport
} from '../src/portmap-audit.js';

test('isValidPort: validates numeric port ranges', () => {
  assert.equal(isValidPort(3000), true);
  assert.equal(isValidPort('8080'), true);
  assert.equal(isValidPort(1), true);
  assert.equal(isValidPort(65535), true);

  assert.equal(isValidPort(0), false);
  assert.equal(isValidPort(65536), false);
  assert.equal(isValidPort(-80), false);
  assert.equal(isValidPort('abc'), false);
  assert.equal(isValidPort(''), false);
});

test('parseEnvContent: extracts valid PORT variables from env files', () => {
  const envText = `
# Comment
PORT=3000
API_PORT="8080"
DEV_PORT='5173'
IGNORE_ME=hello
INVALID_PORT=999999
STRING_PORT=abc
`;
  const items = parseEnvContent(envText, 'sample.env');
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((i) => ({ port: i.port, key: i.key })),
    [
      { port: 3000, key: 'PORT' },
      { port: 8080, key: 'API_PORT' },
      { port: 5173, key: 'DEV_PORT' }
    ]
  );
});

test('parseEnvContent: handles empty and malformed content safely', () => {
  assert.deepEqual(parseEnvContent('', 'sample.env'), []);
  assert.deepEqual(parseEnvContent(null, 'sample.env'), []);
  assert.deepEqual(parseEnvContent('PORT=notanumber', 'sample.env'), []);
});

test('parsePackageJsonContent: extracts ports from npm scripts', () => {
  const pkgJson = JSON.stringify({
    name: 'test-app',
    scripts: {
      dev: 'vite --port 3000',
      start: 'next start -p 4000',
      serve: 'serve -p=8080 dist',
      custom: 'node server.js --port=5000',
      invalid: 'app --port 999999',
      build: 'tsc'
    }
  });

  const items = parsePackageJsonContent(pkgJson, 'pkg.json');
  assert.equal(items.length, 4);
  const foundPorts = items.map((i) => i.port);
  assert.deepEqual(foundPorts, [3000, 4000, 8080, 5000]);
});

test('parsePackageJsonContent: handles invalid JSON and missing scripts', () => {
  assert.deepEqual(parsePackageJsonContent('{ broken json', 'pkg.json'), []);
  assert.deepEqual(parsePackageJsonContent('{"name": "no-scripts"}', 'pkg.json'), []);
  assert.deepEqual(parsePackageJsonContent(null, 'pkg.json'), []);
});

test('detectConflicts: flags duplicate ports across multiple files', () => {
  const declarations = [
    { port: 3000, source: 'frontend/.env' },
    { port: 3000, source: 'backend/package.json' },
    { port: 8080, source: 'services/.env' }
  ];

  const analysis = detectConflicts(declarations);
  assert.equal(analysis.hasConflicts, true);
  assert.equal(analysis.conflicts.length, 1);
  assert.equal(analysis.conflicts[0].port, 3000);
  assert.deepEqual(analysis.conflicts[0].sources, ['frontend/.env', 'backend/package.json']);
  assert.equal(analysis.ports[8080].length, 1);
});

test('detectConflicts: reports clean state when all ports are unique', () => {
  const declarations = [
    { port: 3000, source: 'frontend/.env' },
    { port: 8080, source: 'backend/.env' }
  ];

  const analysis = detectConflicts(declarations);
  assert.equal(analysis.hasConflicts, false);
  assert.equal(analysis.conflicts.length, 0);
});

test('formatTerminalReport: outputs expected structure and conflict warnings', () => {
  const analysis = {
    declarations: [
      { port: 3000, source: 'frontend/.env' },
      { port: 3000, source: 'backend/package.json' }
    ],
    ports: {
      3000: ['frontend/.env', 'backend/package.json']
    },
    conflicts: [
      { port: 3000, sources: ['frontend/.env', 'backend/package.json'] }
    ],
    hasConflicts: true
  };

  const report = formatTerminalReport(analysis);
  assert.match(report, /portmap-audit/);
  assert.match(report, /Scanning project\.\.\./);
  assert.match(report, /PORT 3000/);
  assert.match(report, /frontend\/\.env/);
  assert.match(report, /backend\/package\.json/);
  assert.match(report, /Potential configuration conflict detected\./);
  assert.match(report, /Scan complete\./);
});
