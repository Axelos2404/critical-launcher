# Implementation Plan: Minecraft Version & Mod Management

## Overview

Implement dynamic version fetching, custom modpack instance creation, and mod browsing/adding in incremental steps. Each step builds on the previous and ends with working, integrated functionality.

## Tasks

- [x] 1. Extend Rust backend data models and add new Tauri commands
  - [x] 1.1 Update `InstanceMeta` struct to add optional `loader_version: Option<String>` field with `#[serde(default)]`
    - Update `create_instance` and `update_instance` commands to accept and persist `loader_version`
    - Update `UIInstance` struct to expose `loader_version: Option<String>` to the frontend
    - _Requirements: 2.6_

  - [x] 1.2 Implement `get_instance_mods` Tauri command
    - Read the `mods/` directory of the named instance
    - Return `Vec<ModFile>` where each entry has `filename: String` and `size_bytes: u64`
    - Return empty vec if `mods/` directory does not exist
    - _Requirements: 6.1, 6.2_

  - [ ]* 1.3 Write property test for `get_instance_mods`
    - **Property 12: Installed mods list reflects filesystem state**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 1.4 Implement `download_mod` Tauri command
    - Accept `instance_name: String`, `mod_url: String`, `filename: String`
    - Use `reqwest` to download the file bytes from `mod_url`
    - Write bytes to `instances/{instance_name}/mods/{filename}`
    - Return `Err` without writing any file if the download fails
    - _Requirements: 5.2, 5.5_

  - [ ]* 1.5 Write property tests for `download_mod`
    - **Property 10: Mod download round-trip**
    - **Property 11: Failed download leaves mods directory unchanged**
    - **Validates: Requirements 5.2, 5.5**

  - [x] 1.6 Implement `remove_mod` Tauri command
    - Accept `instance_name: String`, `filename: String`
    - Delete `instances/{instance_name}/mods/{filename}`
    - Return descriptive `Err` if file does not exist or deletion fails
    - _Requirements: 6.3, 6.4_

  - [ ]* 1.7 Write property test for `remove_mod`
    - **Property 13: Mod removal round-trip**
    - **Validates: Requirements 6.3, 6.5**

  - [x] 1.8 Register all new commands in `tauri::generate_handler![]` in `lib.rs`
    - _Requirements: 5.2, 6.1, 6.3_

- [x] 2. Checkpoint — ensure all Rust tests pass and commands compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement `useMinecraftVersions` frontend hook
  - Create `src/hooks/useMinecraftVersions.ts`
  - Fetch from `https://launchermeta.mojang.com/mc/game/version_manifest_v2.json`
  - Filter to `type === "release"` versions only
  - Cache result in a module-level variable for the session
  - Return `{ versions: MinecraftVersion[], isLoading: boolean, error: string | null }`
  - On fetch failure, return the hardcoded fallback list `["1.20.4", "1.20.1", "1.19.4", "1.12.2"]` and set `error`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 3.1 Write property tests for `useMinecraftVersions`
    - **Property 1: Version list contains only releases**
    - **Property 2: Version cache idempotence**
    - **Validates: Requirements 1.2, 1.3**

- [x] 4. Implement `useLoaderVersions` frontend hook
  - Create `src/hooks/useLoaderVersions.ts`
  - Accept `(mcVersion: string, loader: string)` as inputs
  - Route to the correct API per loader:
    - Fabric: `https://meta.fabricmc.net/v2/versions/loader/{mcVersion}`
    - Quilt: `https://meta.quiltmc.org/v3/versions/loader/{mcVersion}`
    - Forge: parse `https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml`, filter versions starting with `{mcVersion}-`
    - NeoForge: parse `https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml`, filter by minor version
  - Return `{ loaderVersions: LoaderVersion[], isLoading: boolean, error: string | null }`
  - Default selection should be the first stable version (or first version if none are stable)
  - Return empty array and set `error` on failure
  - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 4.1 Write property tests for `useLoaderVersions`
    - **Property 3: Loader version API routing**
    - **Property 4: Default loader version is latest stable**
    - **Validates: Requirements 2.1, 2.2**

- [x] 5. Update `CreateInstanceModal` to use dynamic versions
  - Replace hardcoded version `<option>` elements with mapped output from `useMinecraftVersions`
  - Show loading state in version dropdown while `isLoading` is true; disable Create button
  - Show error indicator badge on dropdown when `error` is set (fallback versions still shown)
  - Add loader version `<select>` dropdown below the mod loader selector, populated by `useLoaderVersions`
  - Hide loader version dropdown when `instanceLoader === "Vanilla"`
  - Show loading state in loader version dropdown while loader versions are loading
  - Pass `loaderVersion` to the updated `create_instance` Tauri command
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5_

  - [ ]* 5.1 Write unit tests for modal loading and error states
    - Test: version dropdown disabled during load
    - Test: loader version dropdown hidden for Vanilla
    - Test: fallback versions shown on API failure
    - _Requirements: 1.4, 1.5, 2.3, 2.4_

- [x] 6. Checkpoint — ensure instance creation works end-to-end with dynamic versions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement `useModSearch` frontend hook
  - Create `src/hooks/useModSearch.ts`
  - Accept `{ query: string, mcVersion: string, loader: string }` as inputs
  - Query Modrinth: `GET /v2/search` with `project_type:mod`, `versions:{mcVersion}`, `categories:{loader}` facets
  - Query CurseForge (when `VITE_CURSEFORGE_API_KEY` is set): `GET /v1/mods/search` with `classId=6`, `gameVersion`, and `modLoaderType`
  - Run both queries in parallel; return combined results
  - On partial failure, return successful results and set `error` for the failed provider
  - Return `{ results: ModSearchResult[], isLoading: boolean, error: string | null }`
  - _Requirements: 4.2, 4.3, 4.6_

  - [ ]* 7.1 Write property tests for `useModSearch`
    - **Property 9: Mod search filters by version and loader**
    - **Validates: Requirements 4.2**

- [x] 8. Implement `InstanceDetailView` component
  - Create `src/components/InstanceDetailView.tsx`
  - Display instance metadata: name, version, loader, loader version, play time
  - Show installed mods list by invoking `get_instance_mods`; display filename and human-readable file size for each entry
  - Add "Remove" button per mod that invokes `remove_mod` and refreshes the list on success; show error toast on failure
  - Show "Browse Mods" section with a search input (only for non-Vanilla instances)
  - Wire search input to `useModSearch` with the instance's `mcVersion` and `loader`
  - Display each `ModSearchResult` with name, author, description, download count, and source badge
  - Show "No mods found" message when results are empty
  - Show loading indicator while search is in progress
  - _Requirements: 4.1, 4.4, 4.5, 4.7, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 8.1 Write property test for mod result rendering
    - **Property 8: Mod search results contain required display fields**
    - **Validates: Requirements 4.4**

  - [ ]* 8.2 Write property test for installed mods list
    - **Property 12: Installed mods list reflects filesystem state** (frontend rendering side)
    - **Validates: Requirements 6.1, 6.2**

- [x] 9. Implement mod "Add" flow in `InstanceDetailView`
  - For each `ModSearchResult`, add an "Add" button
  - On click, resolve the latest compatible `Mod_File`:
    - Modrinth: `GET /v2/project/{id}/version?game_versions=["{mcVersion}"]&loaders=["{loader}"]`, take `files[0]`
    - CurseForge: use the `latestFileUrl` already resolved during search
  - Check the current installed mods list for a filename collision; if found, show a confirmation dialog before proceeding
  - Invoke `download_mod` with `instance_name`, resolved URL, and filename
  - Show progress indicator on the "Add" button and disable it while downloading
  - On success, refresh the installed mods list and show a success toast
  - On failure, show an error toast with the reason
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 9.1 Write unit tests for mod add flow edge cases
    - Test: duplicate filename triggers confirmation dialog
    - Test: Add button disabled during download
    - _Requirements: 5.4, 5.6_

- [x] 10. Wire `InstanceDetailView` into `App.tsx`
  - Add click handler to instance cards that sets a `selectedInstance` state
  - Render `InstanceDetailView` when `selectedInstance` is set, replacing the current instance list view
  - Add a back button in `InstanceDetailView` to clear `selectedInstance` and return to the list
  - Ensure the "Modpacks" sub-tab correctly filters instances with non-Vanilla loaders
  - _Requirements: 3.1, 3.3, 3.4_

  - [ ]* 10.1 Write property test for instance list filtering
    - **Property 6: Non-Vanilla instances appear in modded list**
    - **Validates: Requirements 3.1, 3.3**

- [x] 11. Final checkpoint — ensure all tests pass end-to-end
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use `fast-check` (frontend) and `proptest` (Rust backend), each running minimum 100 iterations
- Each property test references its design document property number in a comment: `// Feature: minecraft-version-and-mod-management, Property N: ...`
- The `loader_version` field in `InstanceMeta` uses `#[serde(default)]` so existing instances without it remain valid
- Forge and NeoForge version fetching requires XML parsing; use the browser's `DOMParser` on the frontend
