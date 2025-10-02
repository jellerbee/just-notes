import sqlite3 from 'sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let db: sqlite3.Database | null = null;

export function openDb(dbFile: string, schemaFile: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new sqlite3.Database(dbFile, (err) => {
      if (err) {
        reject(err);
        return;
      }

      const schemaSql = fs.readFileSync(schemaFile, 'utf8');
      db!.exec(schemaSql, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(db!);
      });
    });
  });
}

export function getDb() {
  if (!db) throw new Error('DB not opened');
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}