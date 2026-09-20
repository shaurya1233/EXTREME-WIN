PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS media_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL,
  final_url TEXT,
  source_type TEXT NOT NULL,
  title TEXT,
  duration_seconds REAL,
  thumbnail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS formats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL REFERENCES media_metadata(id) ON DELETE CASCADE,
  format_id TEXT NOT NULL,
  container TEXT NOT NULL,
  resolution TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,
  video_codec TEXT,
  audio_codec TEXT,
  fps REAL,
  bitrate INTEGER,
  media_url TEXT NOT NULL,
  downloadable INTEGER NOT NULL DEFAULT 0,
  resume_supported INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS download_jobs (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  media_url TEXT NOT NULL,
  title TEXT,
  format_id TEXT,
  state TEXT NOT NULL,
  bytes_received INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER,
  output_path TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS download_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  source_url TEXT NOT NULL,
  title TEXT,
  filename TEXT,
  container TEXT,
  resolution TEXT,
  size_bytes INTEGER,
  duration_seconds REAL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(job_id) REFERENCES download_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_updated ON download_jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_history_created ON download_history(created_at);
