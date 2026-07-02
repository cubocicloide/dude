use std::sync::Mutex;

/// Application-wide state, registered once in lib.rs with
/// `app.manage(AppState::default())` and injected into commands as
/// `tauri::State<'_, AppState>`. Never reach for global statics (lint rule
/// BE009-adjacent): managed state is scoped, thread-safe and testable.
///
/// Commands run on multiple threads, so interior mutability goes through a
/// `Mutex` (or `RwLock` for read-heavy data).
#[derive(Default)]
pub struct AppState {
    /// Demo value driving the Home page counter card.
    pub counter: Mutex<i64>,
}
