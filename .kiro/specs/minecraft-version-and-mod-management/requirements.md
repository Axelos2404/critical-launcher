# Requirements Document

## Introduction

This feature enhances the Critical Minecraft launcher with three interconnected capabilities:

1. **Dynamic Version Fetching** — Replace hardcoded version/loader dropdowns in the instance creation modal with live data fetched from official APIs (Mojang, Fabric, Forge, Quilt, NeoForge).
2. **Custom Modpack Instance Creation** — Allow users to create a "Custom Modpack" instance type that starts empty and is intended for manually curated mods.
3. **Mod Browsing & Adding** — Allow users to search individual mods (not modpacks) from Modrinth and CurseForge and add them directly to a custom modpack instance's `mods/` folder.

## Glossary

- **Launcher**: The Critical Tauri application.
- **Instance**: A self-contained Minecraft environment stored as a folder with `instance.json`, `.minecraft/`, `mods/`, and `resourcepacks/` subdirectories.
- **Instance_Meta**: The `instance.json` file containing `name`, `version`, `mod_loader`, and `play_time_minutes`.
- **Custom_Modpack**: An instance whose `mod_loader` is not `Vanilla` and which is managed by the user (mods added manually).
- **Version_Manifest**: The JSON response from the Mojang version manifest API listing all available Minecraft releases and snapshots.
- **Mod_Loader_Version**: A specific release of Fabric, Forge, Quilt, or NeoForge compatible with a given Minecraft version.
- **Mod**: An individual `.jar` file compatible with a specific Minecraft version and mod loader, sourced from Modrinth or CurseForge.
- **Mod_File**: The downloadable artifact (`.jar`) for a specific mod version.
- **Version_Cache**: A frontend in-memory cache of fetched version lists to avoid redundant API calls within a session.
- **Modrinth_API**: The public REST API at `https://api.modrinth.com/v2`.
- **CurseForge_API**: The REST API at `https://api.curseforge.com/v1` requiring an API key.
- **Mojang_Version_API**: The manifest at `https://launchermeta.mojang.com/mc/game/version_manifest_v2.json`.
- **Fabric_Meta_API**: The API at `https://meta.fabricmc.net/v2`.
- **Forge_Files_API**: The Maven metadata at `https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml`.
- **Quilt_Meta_API**: The API at `https://meta.quiltmc.org/v3`.
- **NeoForge_API**: The Maven metadata at `https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml`.

---

## Requirements

### Requirement 1: Fetch Minecraft Versions Dynamically

**User Story:** As a player, I want the version dropdown to show all available Minecraft versions, so that I can create instances for any release without the launcher being outdated.

#### Acceptance Criteria

1. WHEN the Create Instance modal opens, THE Launcher SHALL fetch the list of available Minecraft versions from the Mojang_Version_API.
2. WHEN the Mojang_Version_API responds successfully, THE Launcher SHALL populate the version dropdown with all `release` type versions and, optionally, `snapshot` type versions.
3. WHEN the version list is already cached in the Version_Cache for the current session, THE Launcher SHALL use the cached list instead of making a new API request.
4. IF the Mojang_Version_API request fails, THEN THE Launcher SHALL display the previously hardcoded fallback versions (1.20.4, 1.20.1, 1.19.4, 1.12.2) and show an error indicator in the dropdown.
5. WHILE the version list is loading, THE Launcher SHALL display a loading state in the version dropdown and disable the Create button.

---

### Requirement 2: Fetch Mod Loader Versions Dynamically

**User Story:** As a modder, I want to select a specific mod loader version when creating an instance, so that my mods are compatible with the exact loader version I need.

#### Acceptance Criteria

1. WHEN a user selects a Minecraft version and a non-Vanilla mod loader in the Create Instance modal, THE Launcher SHALL fetch the compatible loader versions from the appropriate API (Fabric_Meta_API, Forge_Files_API, Quilt_Meta_API, or NeoForge_API).
2. WHEN loader versions are fetched successfully, THE Launcher SHALL display a secondary dropdown for loader version selection, defaulting to the latest stable version.
3. WHEN the user selects `Vanilla` as the mod loader, THE Launcher SHALL hide the loader version dropdown.
4. IF the loader version API request fails, THEN THE Launcher SHALL display an error message and allow the user to proceed without a specific loader version.
5. WHILE loader versions are loading, THE Launcher SHALL display a loading state in the loader version dropdown.
6. THE Instance_Meta SHALL store the selected loader version as a `loader_version` field alongside the existing `mod_loader` field.

---

### Requirement 3: Custom Modpack Instance Type

**User Story:** As a modder, I want to create a custom modpack instance, so that I can build my own curated mod collection from scratch.

#### Acceptance Criteria

1. WHEN a user selects a non-Vanilla mod loader in the Create Instance modal, THE Launcher SHALL classify the created instance as a Custom_Modpack.
2. WHEN a Custom_Modpack instance is created, THE Launcher SHALL create the standard instance directory structure including the `mods/` subdirectory.
3. WHEN a Custom_Modpack instance is displayed in the instances list, THE Launcher SHALL show it under the "Modpacks" sub-tab with a visual indicator distinguishing it from modpack-imported instances.
4. THE Launcher SHALL allow a Custom_Modpack instance to be edited and deleted using the same controls as standard instances.

---

### Requirement 4: Mod Search

**User Story:** As a modder, I want to search for individual mods by name or keyword, so that I can find mods to add to my custom modpack.

#### Acceptance Criteria

1. WHEN a user opens a Custom_Modpack instance's detail view, THE Launcher SHALL display a "Browse Mods" section with a search input.
2. WHEN a user submits a search query in the Browse Mods section, THE Launcher SHALL query the Modrinth_API for mods matching the query, filtered to the instance's Minecraft version and mod loader.
3. WHERE a CurseForge API key is configured, THE Launcher SHALL also query the CurseForge_API for matching mods and display results alongside Modrinth results.
4. WHEN search results are returned, THE Launcher SHALL display each mod's name, author, description, download count, and source (Modrinth or CurseForge).
5. IF a search returns no results, THEN THE Launcher SHALL display a "No mods found" message with a suggestion to try different keywords.
6. IF a mod search API request fails, THEN THE Launcher SHALL display an error message and show any results that did succeed from other providers.
7. WHILE a mod search is in progress, THE Launcher SHALL display a loading indicator in the Browse Mods section.

---

### Requirement 5: Add Mod to Instance

**User Story:** As a modder, I want to add a mod from search results directly to my custom modpack instance, so that I can build my mod list without leaving the launcher.

#### Acceptance Criteria

1. WHEN a user clicks "Add" on a mod in the search results, THE Launcher SHALL fetch the latest compatible Mod_File for the instance's Minecraft version and mod loader from the respective API.
2. WHEN the Mod_File URL is resolved, THE Launcher SHALL download the `.jar` file and save it to the instance's `mods/` directory.
3. WHEN a mod is successfully downloaded, THE Launcher SHALL display a success confirmation and update the instance's mod list.
4. IF a mod is already present in the instance's `mods/` directory (same filename), THEN THE Launcher SHALL prompt the user to confirm overwrite before downloading again.
5. IF the Mod_File download fails, THEN THE Launcher SHALL display an error message with the failure reason and leave the `mods/` directory unchanged.
6. WHILE a mod is downloading, THE Launcher SHALL display a progress indicator on the "Add" button and prevent duplicate download requests for the same mod.

---

### Requirement 6: View and Remove Mods from Instance

**User Story:** As a modder, I want to see which mods are installed in my custom modpack and remove ones I no longer want, so that I can manage my mod list over time.

#### Acceptance Criteria

1. WHEN a user opens a Custom_Modpack instance's detail view, THE Launcher SHALL display a list of all `.jar` files present in the instance's `mods/` directory.
2. WHEN the mods list is displayed, THE Launcher SHALL show each mod's filename and file size.
3. WHEN a user clicks "Remove" on a mod in the installed mods list, THE Launcher SHALL delete the corresponding `.jar` file from the `mods/` directory.
4. IF the mod file cannot be deleted, THEN THE Launcher SHALL display an error message with the reason.
5. WHEN a mod is successfully removed, THE Launcher SHALL refresh the installed mods list immediately.
