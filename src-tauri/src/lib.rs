use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;
use serde_json::json;

#[derive(Serialize, Deserialize, Debug)]
pub struct MinecraftAccount {
    pub mc_token: String,
    pub uuid: String,
    pub username: String,
}

#[derive(Serialize, Deserialize)]
struct InstanceMeta {
    name: String,
    version: String,
    mod_loader: String,
    #[serde(default)]
    loader_version: Option<String>,
    play_time_minutes: u64,
}

#[derive(Serialize)]
struct UIInstance {
    id: u64,
    name: String,
    version: String,
    #[serde(rename = "type")]
    loader_type: String,
    loader_version: Option<String>,
    play_time: String,
}

#[derive(Serialize)]
struct ModFile {
    filename: String,
    size_bytes: u64,
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
                        loader_version: meta.loader_version,
                        play_time: play_time_str,
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
    loader_version: Option<String>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // Validate name
    if name.trim().is_empty() {
        return Err("Instance name cannot be empty".to_string());
    }

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let instance_dir = app_data_dir.join("instances").join(&name);

    if instance_dir.exists() {
        return Err("An instance with this name already exists!".to_string());
    }

    fs::create_dir_all(instance_dir.join(".minecraft")).map_err(|e| e.to_string())?;
    fs::create_dir_all(instance_dir.join("mods")).map_err(|e| e.to_string())?;
    fs::create_dir_all(instance_dir.join("resourcepacks")).map_err(|e| e.to_string())?;

    let meta_path = instance_dir.join("instance.json");
    let loader_version_json = match &loader_version {
        Some(v) => format!(r#""{}""#, v),
        None => "null".to_string(),
    };
    let meta_content = format!(
        r#"{{
  "name": "{}",
  "version": "{}",
  "mod_loader": "{}",
  "loader_version": {},
  "play_time_minutes": 0
}}"#,
        name, version, mod_loader, loader_version_json
    );
    fs::write(&meta_path, meta_content).map_err(|e| e.to_string())?;

    Ok(format!("Successfully created '{}' at {:?}", name, instance_dir))
}

#[tauri::command]
fn update_instance(
    old_name: String,
    new_name: String,
    version: String,
    mod_loader: String,
    loader_version: Option<String>,
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

    let loader_version_json = match &loader_version {
        Some(v) => format!(r#""{}""#, v),
        None => "null".to_string(),
    };
    let meta_content = format!(
        r#"{{
  "name": "{}",
  "version": "{}",
  "mod_loader": "{}",
  "loader_version": {},
  "play_time_minutes": {}
}}"#,
        new_name, version, mod_loader, loader_version_json, play_time
    );
    fs::write(&meta_path, meta_content).map_err(|e| e.to_string())?;

    Ok("Instance updated".to_string())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DeviceOAuthResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub message: String,
}

const CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb"; // Prism/Third-party standard client ID

#[tauri::command]
async fn start_microsoft_oauth() -> Result<DeviceOAuthResponse, String> {
    let client = reqwest::Client::new();

    let params_azure = [
        ("client_id", CLIENT_ID),
        ("scope", "XboxLive.signin offline_access"),
    ];

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&params_azure)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if res.status().is_success() {
        let auth_resp: DeviceOAuthResponse = res.json().await.map_err(|e| format!("Parse error: {}", e))?;
        Ok(auth_resp)
    } else {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        Err(format!("Error HTTP {}: {}", status, body))
    }
}

#[tauri::command]
async fn poll_microsoft_oauth_token(device_code: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let params = [
        ("client_id", CLIENT_ID),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ("device_code", &device_code),
    ];

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if res.status().is_success() {
        let text = res.text().await.unwrap_or_default();
        Ok(text)
    } else {
        Err(format!("Pending or Error: {}", res.status()))
    }
}

#[tauri::command]
async fn login_to_minecraft(ms_access_token: String) -> Result<MinecraftAccount, String> {
    let client = reqwest::Client::new();

    // 1. Authenticate with Xbox Live
    let xbl_req = json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", ms_access_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let xbl_res_call = client.post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&xbl_req)
        .send().await.map_err(|e| format!("XBL Error: {}", e))?;
    
    let xbl_res: serde_json::Value = xbl_res_call.json().await.map_err(|e| format!("XBL Parse: {}", e))?;
    let xbl_token = xbl_res["Token"].as_str().ok_or("Failed to extract XBL Token")?;
    let user_hash = xbl_res["DisplayClaims"]["xui"][0]["uhs"].as_str().ok_or("Failed to extract XBL uhs")?;

    // 2. Authenticate with XSTS
    let xsts_req = json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let xsts_res_call = client.post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&xsts_req)
        .send().await.map_err(|e| format!("XSTS Error: {}", e))?;

    if !xsts_res_call.status().is_success() {
        return Err("XSTS authentication failed. Account might not have an Xbox profile or may be a child account.".to_string());
    }

    let xsts_res: serde_json::Value = xsts_res_call.json().await.map_err(|e| format!("XSTS Parse: {}", e))?;
    let xsts_token = xsts_res["Token"].as_str().ok_or("Failed to extract XSTS Token")?;

    // 3. Authenticate with Minecraft using XSTS
    let mc_req = json!({
        "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
    });

    let mc_res_call = client.post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .json(&mc_req)
        .send().await.map_err(|e| format!("MC Auth Error: {}", e))?;
    
    let mc_res: serde_json::Value = mc_res_call.json().await.map_err(|e| format!("MC Auth Parse: {}", e))?;
    let mc_token = mc_res["access_token"].as_str().ok_or("Failed to extract MC Access Token")?;

    // 4. Fetch Minecraft Profile 
    let profile_res_call = client.get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send().await.map_err(|e| format!("Profile Auth Error: {}", e))?;

    let profile_res: serde_json::Value = profile_res_call.json().await.map_err(|e| format!("Profile Parse Error: {}", e))?;

    if let Some(err) = profile_res["error"].as_str() {
        return Err(format!("Minecraft Profile Error: You may not own the game on this account. ({})", err));
    }

    let uuid = profile_res["id"].as_str().ok_or("No Minecraft profile found!")?;
    let username = profile_res["name"].as_str().unwrap_or("Player");

    Ok(MinecraftAccount {
        mc_token: mc_token.to_string(),
        uuid: uuid.to_string(),
        username: username.to_string(),
    })
}

#[tauri::command]
fn get_instance_mods(name: String, app_handle: tauri::AppHandle) -> Result<Vec<ModFile>, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let mods_dir = app_data_dir.join("instances").join(&name).join("mods");

    if !mods_dir.exists() {
        return Ok(vec![]);
    }

    let mut mods = Vec::new();
    for entry in fs::read_dir(&mods_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            let filename = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            mods.push(ModFile { filename, size_bytes });
        }
    }

    Ok(mods)
}

#[tauri::command]
async fn download_mod(
    instance_name: String,
    mod_url: String,
    filename: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let mods_dir = app_data_dir.join("instances").join(&instance_name).join("mods");

    if !mods_dir.exists() {
        fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
    }

    let client = reqwest::Client::new();
    let response = client
        .get(&mod_url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response bytes: {}", e))?;

    let dest_path = mods_dir.join(&filename);
    fs::write(&dest_path, &bytes).map_err(|e| format!("Failed to write mod file: {}", e))?;

    Ok(format!("Downloaded '{}' to {:?}", filename, dest_path))
}

#[tauri::command]
fn remove_mod(
    instance_name: String,
    filename: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let mod_path = app_data_dir
        .join("instances")
        .join(&instance_name)
        .join("mods")
        .join(&filename);

    if !mod_path.exists() {
        return Err(format!("Mod file '{}' not found", filename));
    }

    fs::remove_file(&mod_path).map_err(|e| format!("Failed to remove mod: {}", e))?;
    Ok(format!("Removed '{}'", filename))
}


pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_instances,
            create_instance,
            delete_instance,
            update_instance,
            start_microsoft_oauth,
            poll_microsoft_oauth_token,
            login_to_minecraft,
            get_instance_mods,
            download_mod,
            remove_mod
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
