use crate::error::AppError;

/// `greet` — the smallest possible command: takes a string, returns a string.
///
/// Exposed to the frontend through `src/ipc/greet.ts`. Fallible commands
/// always return `Result<_, AppError>` (lint rule BE006) so the frontend gets
/// a consistent, serialized error message.
#[tauri::command]
pub fn greet(name: &str) -> Result<String, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("name must not be empty".into()));
    }
    log::info!("greeting {trimmed}");
    Ok(format!("Hello, {trimmed}! You've been greeted from Rust."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn greets_by_name() {
        let message = greet("Ada").expect("valid name must greet");
        assert!(message.contains("Ada"));
    }

    #[test]
    fn trims_whitespace() {
        let message = greet("  Ada  ").expect("padded name must greet");
        assert!(message.contains("Hello, Ada!"));
    }

    #[test]
    fn rejects_empty_name() {
        assert!(matches!(greet("   "), Err(AppError::InvalidInput(_))));
    }
}
