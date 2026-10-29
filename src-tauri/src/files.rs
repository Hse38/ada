use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DroppedFile {
    pub name: String,
    pub path: String,
    pub size: u64,
}

fn drop_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("drop-tray");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

fn list_dir(dir: &PathBuf) -> Result<Vec<DroppedFile>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if meta.is_file() {
            out.push(DroppedFile {
                name: entry.file_name().to_string_lossy().into(),
                path: entry.path().to_string_lossy().into(),
                size: meta.len(),
            });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn emit_files(app: &AppHandle, files: &[DroppedFile]) {
    let _ = app.emit("files:update", files.to_vec());
}

#[tauri::command]
pub fn files_list(app: AppHandle) -> Result<Vec<DroppedFile>, String> {
    let dir = drop_dir(&app)?;
    list_dir(&dir)
}

#[tauri::command]
pub fn files_import(app: AppHandle, paths: Vec<String>) -> Result<Vec<DroppedFile>, String> {
    let dir = drop_dir(&app)?;
    for p in paths {
        let src = PathBuf::from(&p);
        if src.is_file() {
            copy_one(&src, &dir)?;
        } else if src.is_dir() {
            // Klasördeki dosyaları düz kopyala (1 seviye)
            if let Ok(entries) = fs::read_dir(&src) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_file() {
                        copy_one(&path, &dir)?;
                    }
                }
            }
        }
    }
    let files = list_dir(&dir)?;
    emit_files(&app, &files);
    Ok(files)
}

fn copy_one(src: &PathBuf, dir: &PathBuf) -> Result<(), String> {
    let name = src
        .file_name()
        .map(|s| s.to_os_string())
        .unwrap_or_else(|| "dosya".into());
    let dest = dir.join(&name);
    let dest = if dest.exists() {
        let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("dosya");
        let ext = src.extension().and_then(|s| s.to_str()).unwrap_or("bin");
        dir.join(format!("{stem}-{}.{ext}", chrono::Utc::now().timestamp_millis()))
    } else {
        dest
    };
    fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn files_clear(app: AppHandle) -> Result<(), String> {
    let dir = drop_dir(&app)?;
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    emit_files(&app, &[]);
    Ok(())
}

#[tauri::command]
pub fn files_open_folder(app: AppHandle) -> Result<(), String> {
    let dir = drop_dir(&app)?;
    open::that(dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_reveal(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("dosya yok".into());
    }
    Command::new("explorer")
        .arg(format!("/select,{}", p.to_string_lossy()))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn files_open(path: String) -> Result<(), String> {
    open::that(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn files_remove(app: AppHandle, path: String) -> Result<Vec<DroppedFile>, String> {
    let p = PathBuf::from(&path);
    let dir = drop_dir(&app)?;
    if p.starts_with(&dir) && p.is_file() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    let files = list_dir(&dir)?;
    emit_files(&app, &files);
    Ok(files)
}
