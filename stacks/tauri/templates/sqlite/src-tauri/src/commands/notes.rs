use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

use crate::db::Db;
use crate::error::AppError;

/// A persisted note. Serialized camelCase so the TS type in `src/ipc/notes.ts`
/// matches without manual mapping.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub body: String,
    pub created_at: String,
}

// ── Domain logic against a plain Connection (unit-testable, rule BE011) ─────

fn query_notes(conn: &Connection) -> Result<Vec<Note>, AppError> {
    let mut stmt =
        conn.prepare("SELECT id, title, body, created_at FROM notes ORDER BY id DESC")?;
    let rows = stmt.query_map([], |row| {
        Ok(Note {
            id: row.get(0)?,
            title: row.get(1)?,
            body: row.get(2)?,
            created_at: row.get(3)?,
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn insert_note(conn: &Connection, title: &str, body: &str) -> Result<Note, AppError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::InvalidInput("title must not be empty".into()));
    }
    conn.execute(
        "INSERT INTO notes (title, body) VALUES (?1, ?2)",
        params![title, body],
    )?;
    let id = conn.last_insert_rowid();
    let note = conn.query_row(
        "SELECT id, title, body, created_at FROM notes WHERE id = ?1",
        params![id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                body: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    )?;
    Ok(note)
}

fn remove_note(conn: &Connection, id: i64) -> Result<(), AppError> {
    let affected = conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::InvalidInput(format!("no note with id {id}")));
    }
    Ok(())
}

// ── Thin Tauri bindings (rule BE003/BE006) ──────────────────────────────────

/// List all notes, newest first.
#[tauri::command]
pub fn list_notes(db: State<'_, Db>) -> Result<Vec<Note>, AppError> {
    let conn = db.0.lock().unwrap_or_else(|e| e.into_inner());
    query_notes(&conn)
}

/// Create a note and return it (including the generated id and timestamp).
#[tauri::command]
pub fn create_note(
    db: State<'_, Db>,
    title: String,
    body: Option<String>,
) -> Result<Note, AppError> {
    let conn = db.0.lock().unwrap_or_else(|e| e.into_inner());
    insert_note(&conn, &title, body.as_deref().unwrap_or(""))
}

/// Delete a note by id. Errors when the id does not exist.
#[tauri::command]
pub fn delete_note(db: State<'_, Db>, id: i64) -> Result<(), AppError> {
    let conn = db.0.lock().unwrap_or_else(|e| e.into_inner());
    remove_note(&conn, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        migrate(&conn).expect("schema");
        conn
    }

    #[test]
    fn creates_and_lists_notes() {
        let conn = test_conn();
        insert_note(&conn, "First", "body").expect("insert");
        insert_note(&conn, "Second", "").expect("insert");

        let notes = query_notes(&conn).expect("list");
        assert_eq!(notes.len(), 2);
        assert_eq!(notes[0].title, "Second"); // newest first
    }

    #[test]
    fn rejects_empty_title() {
        let conn = test_conn();
        assert!(matches!(
            insert_note(&conn, "   ", ""),
            Err(AppError::InvalidInput(_))
        ));
    }

    #[test]
    fn deletes_by_id() {
        let conn = test_conn();
        let note = insert_note(&conn, "Bye", "").expect("insert");
        remove_note(&conn, note.id).expect("delete");
        assert!(query_notes(&conn).expect("list").is_empty());
    }

    #[test]
    fn delete_missing_id_errors() {
        let conn = test_conn();
        assert!(matches!(
            remove_note(&conn, 999),
            Err(AppError::InvalidInput(_))
        ));
    }
}
