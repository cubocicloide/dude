use tauri::{AppHandle, Emitter, State};

use crate::error::AppError;
use crate::state::AppState;

/// Event emitted every time the counter changes. Payload: the new value.
/// Keep in sync with `COUNTER_CHANGED_EVENT` in `src/ipc/counter.ts`.
pub const COUNTER_CHANGED_EVENT: &str = "counter-changed";

/// Pure domain logic, separated from the Tauri glue so it is unit-testable
/// without a running app (lint rule BE011).
fn apply_increment(current: i64, amount: i64) -> Result<i64, AppError> {
    current
        .checked_add(amount)
        .ok_or_else(|| AppError::InvalidInput("counter overflow".into()))
}

/// Read the current counter value from the managed state.
#[tauri::command]
pub fn get_counter(state: State<'_, AppState>) -> Result<i64, AppError> {
    let counter = state.counter.lock().unwrap_or_else(|e| e.into_inner());
    Ok(*counter)
}

/// Increment the counter and broadcast the new value to every window.
///
/// The backend is the single source of truth: the frontend never sets the
/// value locally, it re-renders when `COUNTER_CHANGED_EVENT` arrives.
#[tauri::command]
pub fn increment_counter(
    app: AppHandle,
    state: State<'_, AppState>,
    amount: Option<i64>,
) -> Result<i64, AppError> {
    let value = {
        let mut counter = state.counter.lock().unwrap_or_else(|e| e.into_inner());
        *counter = apply_increment(*counter, amount.unwrap_or(1))?;
        *counter
        // Lock released here, before touching the event system.
    };

    log::info!("counter incremented to {value}");
    app.emit(COUNTER_CHANGED_EVENT, value)?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn increments_by_amount() {
        assert_eq!(apply_increment(0, 1).expect("no overflow"), 1);
        assert_eq!(apply_increment(40, 2).expect("no overflow"), 42);
    }

    #[test]
    fn rejects_overflow() {
        assert!(matches!(
            apply_increment(i64::MAX, 1),
            Err(AppError::InvalidInput(_))
        ));
    }
}
