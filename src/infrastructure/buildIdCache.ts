import { promises as fs } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.cache');
const CACHE_FILE = join(CACHE_DIR, 'buildId.json');
const TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  buildId: string;
  fetchedAt: number;
}

const isExpired = (entry: CacheEntry) => Date.now() - entry.fetchedAt > TTL_MS;

const ensureCacheDir = () => fs.mkdir(CACHE_DIR, { recursive: true });

export const readCachedBuildId = async (): Promise<string | null> => {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf-8');
    const entry: CacheEntry = JSON.parse(raw);
    return isExpired(entry) ? null : entry.buildId;
  } catch {
    return null;
  }
};

export const writeCachedBuildId = async (buildId: string): Promise<void> => {
  await ensureCacheDir();
  const entry: CacheEntry = { buildId, fetchedAt: Date.now() };
  await fs.writeFile(CACHE_FILE, JSON.stringify(entry), 'utf-8');
};

export const clearCachedBuildId = async (): Promise<void> => {
  try {
    await fs.unlink(CACHE_FILE);
  } catch {
    // file may not exist
  }
};
