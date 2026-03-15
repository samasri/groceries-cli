import { promises as fs } from 'fs';
import { join } from 'path';

// We test the cache module by mocking fs at the module level
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

// Re-import after mock
import {
  readCachedBuildId,
  writeCachedBuildId,
  clearCachedBuildId,
} from '../infrastructure/buildIdCache';

const CACHE_FILE = join(process.cwd(), '.cache', 'buildId.json');

describe('buildIdCache', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('readCachedBuildId', () => {
    it('returns buildId when cache is fresh', async () => {
      const entry = { buildId: 'abc123', fetchedAt: Date.now() };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(entry) as never);

      const result = await readCachedBuildId();

      expect(result).toBe('abc123');
    });

    it('returns null when cache is expired', async () => {
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const entry = { buildId: 'abc123', fetchedAt: twoHoursAgo };
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(entry) as never);

      const result = await readCachedBuildId();

      expect(result).toBeNull();
    });

    it('returns null when file does not exist', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT') as never);

      const result = await readCachedBuildId();

      expect(result).toBeNull();
    });

    it('returns null when file contains invalid JSON', async () => {
      mockFs.readFile.mockResolvedValueOnce('not-json' as never);

      const result = await readCachedBuildId();

      expect(result).toBeNull();
    });
  });

  describe('writeCachedBuildId', () => {
    it('writes buildId with current timestamp', async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined as never);
      mockFs.writeFile.mockResolvedValueOnce(undefined as never);
      const before = Date.now();

      await writeCachedBuildId('newBuildId');

      const [filePath, content] = mockFs.writeFile.mock.calls[0] as [string, string, string];
      expect(filePath).toBe(CACHE_FILE);
      const entry = JSON.parse(content);
      expect(entry.buildId).toBe('newBuildId');
      expect(entry.fetchedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe('clearCachedBuildId', () => {
    it('deletes the cache file', async () => {
      mockFs.unlink.mockResolvedValueOnce(undefined as never);

      await clearCachedBuildId();

      expect(mockFs.unlink).toHaveBeenCalledWith(CACHE_FILE);
    });

    it('does not throw when file does not exist', async () => {
      mockFs.unlink.mockRejectedValueOnce(new Error('ENOENT') as never);

      await expect(clearCachedBuildId()).resolves.toBeUndefined();
    });
  });
});
