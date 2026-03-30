import { useState, useEffect } from "react";

export interface LoaderVersion {
  version: string;
  stable: boolean;
}

interface UseLoaderVersionsResult {
  loaderVersions: LoaderVersion[];
  isLoading: boolean;
  error: string | null;
}

function parseMavenXml(xml: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  return Array.from(doc.querySelectorAll("version")).map((el) => el.textContent ?? "");
}

async function fetchFabricVersions(mcVersion: string): Promise<LoaderVersion[]> {
  const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
  if (!res.ok) throw new Error(`Fabric API HTTP ${res.status}`);
  const data = await res.json();
  return data.map((entry: any) => ({
    version: entry.loader.version,
    stable: entry.loader.stable ?? true,
  }));
}

async function fetchQuiltVersions(mcVersion: string): Promise<LoaderVersion[]> {
  const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
  if (!res.ok) throw new Error(`Quilt API HTTP ${res.status}`);
  const data = await res.json();
  return data.map((entry: any) => ({
    version: entry.loader.version,
    stable: true, // Quilt doesn't expose a stable flag
  }));
}

async function fetchForgeVersions(mcVersion: string): Promise<LoaderVersion[]> {
  const res = await fetch(
    "https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml"
  );
  if (!res.ok) throw new Error(`Forge Maven HTTP ${res.status}`);
  const xml = await res.text();
  const all = parseMavenXml(xml);
  const filtered = all
    .filter((v) => v.startsWith(`${mcVersion}-`))
    .reverse(); // newest first
  return filtered.map((v) => ({ version: v, stable: true }));
}

async function fetchNeoForgeVersions(mcVersion: string): Promise<LoaderVersion[]> {
  // NeoForge versions use the minor version of MC, e.g. "1.21.1" → "21.1"
  const parts = mcVersion.split(".");
  const neoPrefix = parts.length >= 3 ? `${parts[1]}.${parts[2]}` : parts[1];

  const res = await fetch(
    "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml"
  );
  if (!res.ok) throw new Error(`NeoForge Maven HTTP ${res.status}`);
  const xml = await res.text();
  const all = parseMavenXml(xml);
  const filtered = all
    .filter((v) => v.startsWith(`${neoPrefix}.`))
    .reverse();
  return filtered.map((v) => ({ version: v, stable: true }));
}

export function useLoaderVersions(mcVersion: string, loader: string): UseLoaderVersionsResult {
  const [loaderVersions, setLoaderVersions] = useState<LoaderVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mcVersion || loader === "Vanilla") {
      setLoaderVersions([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setLoaderVersions([]);

    (async () => {
      try {
        let versions: LoaderVersion[] = [];
        if (loader === "Fabric") versions = await fetchFabricVersions(mcVersion);
        else if (loader === "Quilt") versions = await fetchQuiltVersions(mcVersion);
        else if (loader === "Forge") versions = await fetchForgeVersions(mcVersion);
        else if (loader === "NeoForge") versions = await fetchNeoForgeVersions(mcVersion);

        if (!cancelled) {
          setLoaderVersions(versions);
          setIsLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(`Failed to fetch ${loader} versions: ${e}`);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mcVersion, loader]);

  return { loaderVersions, isLoading, error };
}
