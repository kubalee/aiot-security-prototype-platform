import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnvFile(file = '.env.local') {
  const envPath = resolve(process.cwd(), file);
  if (!existsSync(envPath)) return {};

  const values = {};
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    values[key] = value.replace(/^["']|["']$/gu, '');
  }
  return values;
}
