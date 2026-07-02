use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::error::AppError;

/// SQLite connection managed by Tauri (`app.manage(Db(...))` in lib.rs).
/// Commands receive it as `tauri::State<'_, Db>`; rusqlite connections are not
/// thread-safe, so access is serialized through the Mutex.
pub struct Db(pub Mutex<Connection>);

/// Idempotent, append-only migrations run at every startup. Never edit an
/// entry that shipped — add a new statement at the end instead.
const MIGRATIONS: &[&str] = &["
CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"];

/// Open (or create) the database in the platform app-data directory and bring
/// the schema up to date. Called once from the lib.rs setup hook.
pub fn init(app: &AppHandle) -> Result<Connection, AppError> {
    let dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;

    let db_path = dir.join("app.db");
    log::info!("opening database at {}", db_path.display());

    let conn = Connection::open(db_path)?;
    migrate(&conn)?;
    Ok(conn)
}

/// Apply every migration. Split from `init` so tests can run the real schema
/// against an in-memory connection.
pub fn migrate(conn: &Connection) -> Result<(), AppError> {
    for sql in MIGRATIONS {
        conn.execute_batch(sql)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_idempotent() {
        let conn = Connection::open_in_memory().expect("in-memory db");
        migrate(&conn).expect("first run");
        migrate(&conn).expect("second run must not fail");
    }
}
