import { useState, useEffect, useRef } from "react";

export interface ModSearchResult {
  id: string;
  title: string;
  author: string;
  description: string;
  iconUrl: string;
  downloadCount: number;
  source: "modrinth" | "curseforge";
  latestFileUrl: string;
  filename: string;
}

interface UseModSearchResult {
  results: ModSearchResult[];
  isLoading: boolean;
  error: string | null;
}

const CF_LOADER_MAP: Record<string, number> = {
  Forge: 1,
  Fabric: 4,
  Quilt: 5,
  NeoForge: 6,
};

async function searchModrinth(
  query: string,
  mcVersion: string,
  loader: string
): Promise<ModSearchResult[]> {
  const facets = JSON.stringify([
    ["project_type:mod"],
    [`versions:${mcVersion}`],
    [`categories:${loader.toLowerCase()}`],
  ]);
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Modrinth HTTP ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map((hit: any) => ({
    id: hit.project_id,
    title: hit.title,
    author: hit.author,
    description: hit.description,
    iconUrl: hit.icon_url || "",
    downloadCount: hit.downloads ?? 0,
    source: "modrinth" as const,
    latestFileUrl: "",  // resolved on demand when adding
    filename: "",
  }));
}

async function searchCurseForge(
  query: string,
  mcVersion: string,
  loader: string,
  apiKey: string
): Promise<ModSearchResult[]> {
  const loaderType = CF_LOADER_MAP[loader] ?? 0;
  console.log("[searchCurseForge] Query:", query, "MC:", mcVersion, "Loader:", loader, "LoaderType:", loaderType);
  // CurseForge blocks browser fetch via CORS — must go through Tauri's HTTP plugin
  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
  const url = `https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&searchFilter=${encodeURIComponent(query)}&gameVersion=${mcVersion}&modLoaderType=${loaderType}&pageSize=50`;
  console.log("[searchCurseForge] URL:", url);
  const res = await tauriFetch(url, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
  });
  console.log("[searchCurseForge] Response status:", res.status);
  if (!res.ok) {
    const errorText = await res.text();
    console.error("[searchCurseForge] Error response:", errorText);
    throw new Error(`CurseForge HTTP ${res.status}: ${errorText}`);
  }
  const data = await res.json();
  console.log("[searchCurseForge] Data received:", data);
  const mods = (data.data || []).map((mod: any) => {
    const fileUrl = mod.latestFilesIndexes?.[0]?.downloadUrl ?? "";
    const filename = mod.latestFilesIndexes?.[0]?.filename ?? `${mod.name}.jar`;
    return {
      id: mod.id.toString(),
      title: mod.name,
      author: mod.authors?.[0]?.name ?? "Unknown",
      description: mod.summary ?? "",
      iconUrl: mod.logo?.url ?? "",
      downloadCount: mod.downloadCount ?? 0,
      source: "curseforge" as const,
      latestFileUrl: fileUrl,
      filename,
    };
  });
  console.log("[searchCurseForge] Mapped mods count:", mods.length);
  return mods;
}

export function useModSearch(
  query: string,
  mcVersion: string,
  loader: string
): UseModSearchResult {
  const [results, setResults] = useState<ModSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim() || !mcVersion || loader === "Vanilla") {
      setResults([]);
      setError(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      let cancelled = false;
      setIsLoading(true);
      setError(null);

      const cfKey = (import.meta as any).env?.VITE_CURSEFORGE_API_KEY ?? "";
      console.log("[useModSearch] CurseForge API key present:", !!cfKey, "length:", cfKey.length);

      const modrinthPromise = searchModrinth(query, mcVersion, loader).catch(
        (e) => ({ error: String(e) })
      );
      const cfPromise = cfKey
        ? searchCurseForge(query, mcVersion, loader, cfKey).catch((e) => {
            console.error("[useModSearch] CurseForge error:", e);
            return { error: String(e) };
          })
        : Promise.resolve([]);

      Promise.all([modrinthPromise, cfPromise]).then(([mrResult, cfResult]) => {
        if (cancelled) return;

        const errors: string[] = [];
        const combined: ModSearchResult[] = [];

        if (Array.isArray(mrResult)) combined.push(...mrResult);
        else errors.push(`Modrinth: ${(mrResult as any).error}`);

        if (Array.isArray(cfResult)) combined.push(...cfResult);
        else if ((cfResult as any).error)
          errors.push(`CurseForge: ${(cfResult as any).error}`);

        setResults(combined);
        setError(errors.length > 0 ? errors.join(" | ") : null);
        setIsLoading(false);
      });

      return () => {
        cancelled = true;
      };
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mcVersion, loader]);

  return { results, isLoading, error };
}
