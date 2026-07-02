// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Keep this file thin (lint rule BE002): all setup lives in lib.rs so the same
// code path serves desktop and (future) mobile entry points.
fn main() {
    app_lib::run();
}
