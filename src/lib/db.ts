import Database from "better-sqlite3";
import path from "path";
import { seedIfEmpty } from "./db-seed";

const DB_PATH = path.join(process.cwd(), "data", "reg-sci-tracker.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
    seedIfEmpty(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id                    TEXT PRIMARY KEY,
      active_substance      TEXT NOT NULL,
      product_name          TEXT NOT NULL,
      type                  TEXT NOT NULL,
      project_owner         TEXT NOT NULL,
      submission_type       TEXT NOT NULL,
      status                TEXT NOT NULL,
      target_submission_date TEXT,
      data_responsibility   TEXT NOT NULL,
      eu_approval_status    TEXT NOT NULL,
      eu_expiry_date        TEXT,
      conclusion            TEXT
    );

    CREATE TABLE IF NOT EXISTS assessments (
      product_id    TEXT NOT NULL,
      section_id    TEXT NOT NULL,
      risk_level    TEXT NOT NULL,
      summary       TEXT NOT NULL DEFAULT '',
      assessor      TEXT,
      last_updated  TEXT,
      details       TEXT,
      use_outcomes  TEXT,
      PRIMARY KEY (product_id, section_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gap_uses (
      id            TEXT PRIMARY KEY,
      product_id    TEXT NOT NULL,
      country_code  TEXT NOT NULL,
      description   TEXT NOT NULL,
      notes         TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);
}
