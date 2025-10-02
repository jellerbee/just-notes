import fs from 'node:fs';
import path from 'node:path';

export interface VaultConfig { root: string; }

export function ensureDailyNote(cfg: VaultConfig, date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const name = `${yyyy}-${mm}-${dd}.md`;
  const filePath = path.join(cfg.root, name);
  if (!fs.existsSync(cfg.root)) fs.mkdirSync(cfg.root, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `# ${yyyy}-${mm}-${dd}\n\n- `);
  }
  return filePath;
}

export function readFileAbs(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

export function writeFileAbs(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, 'utf8');
}