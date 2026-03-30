export interface MinecraftVersion {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  releaseTime: string;
}

interface UseMinecraftVersionsResult {
  versions: MinecraftVersion[];
  isLoading: boolean;
  error: string | null;
}

const FALLBACK_VERSIONS: MinecraftVersion[] = [
  { id: "1.20.4", type: "release", releaseTime: "" },
  { id: "1.20.1", type: "release", releaseTime: "" },
  { id: "1.19.4", type: "release", releaseTime: "" },
  { id: "1.12.2", type: "release", releaseTime: "" },
];

// Module-level session cache
let cachedVersions: MinecraftVersion[] | null = null;

import { useState, useEffect } from "react";

export function useMinecraftVersions(): UseMinecraftVersionsResult {
  const [versions, setVersions] = useState<MinecraftVersion[]>(cachedVersions ?? []);
  const [isLoading, setIsLoading] = useState(cachedVersions === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedVersions !== null) {
      setVersions(cachedVersions);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json"
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const releases: MinecraftVersion[] = (data.versions as MinecraftVersion[]).filter(
          (v) => v.type === "release"
        );
        cachedVersions = releases;
        if (!cancelled) {
          setVersions(releases);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setVersions(FALLBACK_VERSIONS);
          setError(`Failed to fetch versions: ${e}. Showing fallback list.`);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { versions, isLoading, error };
}
