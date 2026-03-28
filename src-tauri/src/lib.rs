use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Serialize, Deserialize)]
struct InstanceMeta {
    name: String,
    version: String,
    mod_loader: String,
    play_time_minutes: u64,
}

#[derive(Serialize)]
struct UIInstance {
    id: u64,
    name: String,
    version: String,
    #[serde(rename = "type")]
    loader_type: String,
    playTime: String,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn get_instances(app_handle: tauri::AppHandle) -> Result<Vec<UIInstance>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let instances_dir = app_data_dir.join("instances");

    if !instances_dir.exists() {
        return Ok(vec![]);
    }

    let mut instances = Vec::new();
    let mut id_counter = 1;

    for entry in fs::read_dir(instances_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            let meta_path = path.join("instance.json");
            if meta_path.exists() {
                let meta_str = fs::read_to_string(&meta_path).unwrap_or_default();
                if let Ok(meta) = serde_json::from_str::<InstanceMeta>(&meta_str) {
                    let play_time_hours = meta.play_time_minutes / 60;
                    let play_time_str = if meta.play_time_minutes == 0 {
                        "New".to_string()
                    } else if play_time_hours > 0 {
                        format!("{}h", play_time_hours)
                    } else {
                        format!("{}m", meta.play_time_minutes)
                    };

                    instances.push(UIInstance {
                        id: id_counter,
                        name: meta.name,
                        version: meta.version,
                        loader_type: meta.mod_loader,
                        playTime: play_time_str,
                    });
                    id_counter += 1;
                }
            }
        }
    }

    Ok(instances)
}

#[tauri::command]
fn delete_instance(name: String, app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let instance_dir = app_data_dir.join("instances").join(&name);

    if instance_dir.exists() {
        fs::remove_dir_all(instance_dir).map_err(|e| e.to_string())?;
        Ok(format!("Deleted instance '{}'", name))
    } else {
        Err("Instance not found".to_string())
    }
}

#[tauri::command]
fn create_instance(
    name: String,
    version: String,
    mod_loader: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate name
    if name.trim().is_empty() {
        return Err("Instance name cannot be empty".to_string());
    }

    // Get the app's local data directory (in Windows: AppData/Roaming/com.tauri.dev or similar)
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Ensure the Critical launcher folder exists
    let instance_dir = app_data_dir.join("instances").join(&name);

    if instance_dir.exists() {
        return Err("An instance with this name already exists!".to_string());
    }

    // Create the instance core directories
    fs::create_dir_all(instance_dir.join(".minecraft")).map_err(|e| e.to_string())?;
    fs::create_dir_all(instance_dir.join("mods")).map_err(|e| e.to_string())?;
    fs::create_dir_all(instance_dir.join("resourcepacks")).map_err(|e| e.to_string())?;

    // Create an instance.json metadata file
    let meta_path = instance_dir.join("instance.json");
    let meta_content = format!(
        r#"{{
  "name": "{}",
  "version": "{}",
  "mod_loader": "{}",
  "play_time_minutes": 0
}}"#,
        name, version, mod_loader
    );
    fs::write(&meta_path, meta_content).map_err(|e| e.to_string())?;

    Ok(format!(
        "Successfully created '{}' at {:?}",
        name, instance_dir
    ))
}

#[tauri::command]
fn update_instance(
    old_name: String,
    new_name: String,
    version: String,
    mod_loader: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let instances_dir = app_data_dir.join("instances");
    let old_dir = instances_dir.join(&old_name);

    if !old_dir.exists() {
        return Err("Instance not found".to_string());
    }

    let target_dir = if old_name != new_name {
        let new_dir = instances_dir.join(&new_name);
        if new_dir.exists() {
            return Err("An instance with the new name already exists".to_string());
        }
        fs::rename(&old_dir, &new_dir).map_err(|e| e.to_string())?;
        new_dir
    } else {
        old_dir
    };

    let meta_path = target_dir.join("instance.json");
    let mut play_time = 0;
    if meta_path.exists() {
        if let Ok(meta_str) = fs::read_to_string(&meta_path) {
            if let Ok(meta) = serde_json::from_str::<InstanceMeta>(&meta_str) {
                play_time = meta.play_time_minutes;
            }
        }
    }

    let meta_content = format!(
        r#"{{
  "name": "{}",
  "version": "{}",
  "mod_loader": "{}",
  "play_time_minutes": {}
}}"#,
        new_name, version, mod_loader, play_time
    );
    fs::write(&meta_path, meta_content).map_err(|e| e.to_string())?;

    Ok("Instance updated".to_string())
}

#[tauri::command]
fn start_microsoft_oauth() -> Result<String, String> {
    // This is a placeholder for the actual complex OAuth flow
    // which involves opening a browser to login.live.com, capturing the token,
    // exchanging it for XSTS, and doing Minecraft auth.
    Ok("Please implement Azure App Client ID first to run OAuth!".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_instances,
            create_instance,
            delete_instance,
            update_instance,
            start_microsoft_oauth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
