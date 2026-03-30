import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useModSearch, ModSearchResult } from "../hooks/useModSearch";

interface ModFile {
  filename: string;
  size_bytes: number;
}

interface InstanceData {
  id: number;
  name: string;
  version: string;
  type: string;
  loader_version: string | null;
  play_time: string;
}

interface Props {
  instance: InstanceData;
  onBack: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InstanceDetailView({ instance, onBack }: Props) {
  const isModded = instance.type !== "Vanilla";

  const [mods, setMods] = useState<ModFile[]>([]);
  const [modsLoading, setModsLoading] = useState(false);
  const [modsError, setModsError] = useState<string | null>(null);

  const [modQuery, setModQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const { results, isLoading: searchLoading, error: searchError } = useModSearch(
    activeQuery,
    instance.version,
    instance.type
  );

  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const refreshMods = useCallback(async () => {
    setModsLoading(true);
    setModsError(null);
    try {
      const list = await invoke<ModFile[]>("get_instance_mods", { name: instance.name });
      setMods(list);
    } catch (e) {
      setModsError(String(e));
    } finally {
      setModsLoading(false);
    }
  }, [instance.name]);

  useEffect(() => {
    if (isModded) refreshMods();
  }, [isModded, refreshMods]);

  const handleRemoveMod = async (filename: string) => {
    try {
      await invoke("remove_mod", { instanceName: instance.name, filename });
      showToast(`Removed ${filename}`, true);
      refreshMods();
    } catch (e) {
      showToast(`Failed to remove: ${e}`, false);
    }
  };

  const handleAddMod = async (mod: ModSearchResult) => {
    setDownloadingIds((prev) => new Set(prev).add(mod.id));
    try {
      let fileUrl = mod.latestFileUrl;
      let filename = mod.filename;

      // Resolve Modrinth download URL on demand
      if (mod.source === "modrinth") {
        const versionsRes = await fetch(
          `https://api.modrinth.com/v2/project/${mod.id}/version?game_versions=["${instance.version}"]&loaders=["${instance.type.toLowerCase()}"]`
        );
        if (!versionsRes.ok) throw new Error("Could not resolve mod version");
        const versions = await versionsRes.json();
        if (!versions.length) throw new Error("No compatible version found");
        const file = versions[0].files[0];
        fileUrl = file.url;
        filename = file.filename;
      }

      // Check for duplicate
      const existing = mods.find((m) => m.filename === filename);
      if (existing) {
        const confirmed = window.confirm(
          `"${filename}" is already installed. Overwrite it?`
        );
        if (!confirmed) return;
      }

      await invoke("download_mod", {
        instanceName: instance.name,
        modUrl: fileUrl,
        filename,
      });
      showToast(`Added ${mod.title}`, true);
      refreshMods();
    } catch (e) {
      showToast(`Failed to add ${mod.title}: ${e}`, false);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(mod.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Toast */}
      {toast && (
        <div
          className={`absolute top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${
            toast.ok ? "bg-[#D1F4E0] text-[#1FA662]" : "bg-[#FFDACC] text-[#D95D39]"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <div>
          <h3 className="text-2xl font-bold">{instance.name}</h3>
          <p className="text-sm text-gray-500 font-medium">
            {instance.version} • {instance.type}
            {instance.loader_version && ` ${instance.loader_version}`}
            {" • "}{instance.play_time}
          </p>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Installed Mods */}
        {isModded && (
          <div className="w-72 shrink-0 bg-[#F9FAFB] rounded-[24px] p-6 border border-gray-100 flex flex-col">
            <h4 className="font-bold text-base mb-4">
              Installed Mods
              <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">{mods.length}</span>
            </h4>

            {modsLoading && <p className="text-sm text-gray-400">Loading...</p>}
            {modsError && <p className="text-sm text-red-500">{modsError}</p>}

            {!modsLoading && mods.length === 0 && (
              <p className="text-sm text-gray-400">No mods installed yet.</p>
            )}

            <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar flex-1">
              {mods.map((mod) => (
                <div
                  key={mod.filename}
                  className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 flex items-center justify-between group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{mod.filename}</p>
                    <p className="text-[10px] text-gray-400">{formatBytes(mod.size_bytes)}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveMod(mod.filename)}
                    className="ml-2 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove mod"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Browse Mods */}
        <div className="flex-1 flex flex-col min-h-0">
          {isModded ? (
            <>
              <div className="flex gap-3 mb-6">
                <div className="flex-1 relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    type="text"
                    value={modQuery}
                    onChange={(e) => setModQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setActiveQuery(modQuery)}
                    placeholder={`Search mods for ${instance.version} ${instance.type}...`}
                    className="w-full bg-[#F9FAFB] border border-gray-200 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-[#111827] focus:ring-1 focus:ring-[#111827] transition-all text-sm"
                  />
                </div>
                <button
                  onClick={() => setActiveQuery(modQuery)}
                  className="bg-[#111827] text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-[#1F2937] transition-all active:scale-95"
                >
                  Search
                </button>
              </div>

              {searchError && (
                <p className="text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg mb-4">{searchError}</p>
              )}

              <div className="flex-1 overflow-y-auto no-scrollbar">
                {searchLoading && (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Searching mods...</div>
                )}
                {!searchLoading && activeQuery && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-1">
                    <span>No mods found for "{activeQuery}"</span>
                    <span className="text-xs">Try different keywords or check the version/loader.</span>
                  </div>
                )}
                {!searchLoading && !activeQuery && (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                    Search for mods to add to this instance.
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  {results.map((mod) => {
                    const isDownloading = downloadingIds.has(mod.id);
                    return (
                      <div key={`${mod.source}-${mod.id}`} className="bg-[#F9FAFB] border border-gray-100 rounded-[16px] p-4 flex items-center gap-4">
                        {mod.iconUrl ? (
                          <img src={mod.iconUrl} alt={mod.title} className="w-12 h-12 rounded-xl object-cover shrink-0 bg-gray-200" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-xs font-bold">MOD</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h5 className="font-bold text-sm text-gray-900 truncate">{mod.title}</h5>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${mod.source === "modrinth" ? "bg-[#D1F4E0] text-[#1FA662]" : "bg-[#FFDACC] text-[#D95D39]"}`}>
                              {mod.source === "modrinth" ? "Modrinth" : "CurseForge"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">by {mod.author} • {mod.downloadCount.toLocaleString()} downloads</p>
                          <p className="text-xs text-gray-600 line-clamp-1">{mod.description}</p>
                        </div>
                        <button
                          onClick={() => handleAddMod(mod)}
                          disabled={isDownloading}
                          className="shrink-0 bg-[#111827] hover:bg-[#1F2937] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDownloading ? "Adding..." : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              This is a Vanilla instance. Mod browsing is only available for modded instances.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
