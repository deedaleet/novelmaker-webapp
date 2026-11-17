import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { backupDir } from '../config';
import type { DB } from '../db';

/** Nur eigene Sicherungen anfassen – der Ordner ist frei wählbar und kann andere Dateien enthalten. */
const BACKUP_FILE = /^novelmaker-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-([\w-]+))?\.db$/;

/** Sprachneutrale Kennungen für den Sicherungsgrund; sie landen unverändert im Dateinamen. */
export type BackupReason = 'manual' | 'quit' | 'startup' | 'pre-delete' | 'pre-codex-merge' | 'pre-relocate' | 'pre-overwrite';

const REASONS = new Set<string>(['manual', 'quit', 'startup', 'pre-delete', 'pre-codex-merge', 'pre-relocate', 'pre-overwrite']);

/** Ältere Sicherungen tragen deutsche Beschriftungen; sie werden beim Anzeigen auf die Kennungen abgebildet. */
const LEGACY_REASONS: Record<string, BackupReason> = {
  manuell: 'manual',
  beenden: 'quit',
  start: 'startup',
  'vor-loeschen': 'pre-delete',
  'vor-kodex-zusammenfuehren': 'pre-codex-merge',
  'vor-wechsel': 'pre-relocate',
  ueberschrieben: 'pre-overwrite',
};

/** Grund aus einem Sicherungsnamen lesen – auch für alte Dateien mit deutscher Beschriftung. */
export function backupReason(file: string): BackupReason | null {
  const raw = BACKUP_FILE.exec(file)?.[1];
  if (!raw) return null;
  return LEGACY_REASONS[raw] ?? (REASONS.has(raw) ? (raw as BackupReason) : null);
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export interface BackupInfo {
  file: string;
  size: number;
  createdAt: string;
  reason: BackupReason | null;
}

export function listBackups(dir = backupDir()): BackupInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => BACKUP_FILE.test(f))
    .map((f) => {
      const st = statSync(join(dir, f));
      return { file: f, size: st.size, createdAt: st.mtime.toISOString(), reason: backupReason(f) };
    })
    .sort((a, b) => b.file.localeCompare(a.file));
}

/** Pfad für eine neue Sicherung (legt den Ordner an). */
export function newBackupPath(reason?: BackupReason): string {
  const dir = backupDir();
  mkdirSync(dir, { recursive: true });
  return join(dir, `novelmaker-${stamp()}${reason ? '-' + reason : ''}.db`);
}

/** Vollständige Kopie einer Datenbank (auch während sie offen ist). */
export function vacuumInto(db: DB, file: string) {
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
}

/** Kopie der Datenbank anlegen und nur die letzten N behalten. */
export function createBackup(db: DB, keep: number, reason?: BackupReason): string | null {
  const hasData = (db.prepare('SELECT COUNT(*) AS n FROM novels').get() as { n: number }).n > 0;
  if (!hasData) return null;
  const file = newBackupPath(reason);
  if (existsSync(file)) return file;
  vacuumInto(db, file);
  prune(keep);
  return file;
}

function prune(keep: number) {
  const dir = backupDir();
  for (const b of listBackups(dir).slice(Math.max(1, keep))) {
    try {
      unlinkSync(join(dir, b.file));
    } catch {
      /* ignorieren */
    }
  }
}

const TABLES = [
  'series',
  'novels',
  'novel_covers',
  'acts',
  'chapters',
  'scenes',
  'scene_snapshots',
  'codex_entries',
  'codex_relations',
  'snippets',
  'prompts',
  'providers',
  'model_collections',
  'chat_threads',
  'chat_messages',
  'settings',
];

export function exportJson(db: DB): Record<string, unknown> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${t}`).all() as Record<string, unknown>[];
    // Binärdaten (Cover) als Base64
    tables[t] = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Buffer.isBuffer(v) ? v.toString('base64') : v])));
  }
  return { app: 'novelmaker', version: 1, exportedAt: new Date().toISOString(), tables };
}
