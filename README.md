# PortScout Lite

PortScout Lite is a lightweight Node.js command-line tool that recursively scans your project for common port assignments in configuration files and scripts. It detects potential duplicate port declarations to help prevent conflicts before launching local services.

## Installation

Run directly with npx without installing:

```bash
npx portscout-lite
```

Or install globally via npm:

```bash
npm install -g portscout-lite
```

Or as a development dependency:

```bash
npm install --save-dev portscout-lite
```

## Usage

Scan current working directory:

```bash
portscout
```

Scan a specific folder:

```bash
portscout ./packages/api
```

Output results as JSON:

```bash
portscout --json
```

Display help or version:

```bash
portscout --help
portscout --version
```

## Example Output

```text
PortScout

Scanning project...

Found port declarations:

PORT 3000
  frontend/.env
  backend/package.json

Potential configuration conflict detected.

Scan complete.
```

## Supported File Types

- `.env`, `.env.example`, `.env.*`: Variables containing `PORT` (e.g. `PORT=3000`, `API_PORT=8080`, `VITE_PORT=5173`).
- `package.json`: Scripts containing common CLI port arguments (e.g. `--port 3000`, `--port=3000`, `-p 3000`, `-p=3000`).

Directories ignored by default: `node_modules`, `.git`, `dist`, `build`.

## Limitations

- Does not inspect running processes or bind active network sockets.
- Does not parse Docker Compose YAML files or AST configurations.
- Only parses standard static environment variables and script arguments.

## Testing

Run the test suite using Node's native test runner:

```bash
npm test
```

## Publishing to npm

1. Ensure all tests pass:
   ```bash
   npm test
   ```
2. Verify package packing with a dry run:
   ```bash
   npm pack --dry-run
   ```
3. Authenticate with npm and publish:
   ```bash
   npm login
   npm publish
   ```
