import { createCachedBuildIdAdapter } from '../adapters/cachedBuildIdAdapter';
import * as buildIdCache from '../infrastructure/buildIdCache';
import * as httpClient from '../infrastructure/httpClient';

describe('cachedBuildIdAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getBuildId', () => {
    it('returns cached buildId without fetching when cache is valid', async () => {
      jest.spyOn(buildIdCache, 'readCachedBuildId').mockResolvedValueOnce('cachedId');
      const httpSpy = jest.spyOn(httpClient, 'httpGet');

      const adapter = createCachedBuildIdAdapter();
      const result = await adapter.getBuildId();

      expect(result).toBe('cachedId');
      expect(httpSpy).not.toHaveBeenCalled();
    });

    it('fetches and caches new buildId when cache is empty', async () => {
      jest.spyOn(buildIdCache, 'readCachedBuildId').mockResolvedValueOnce(null);
      jest.spyOn(buildIdCache, 'writeCachedBuildId').mockResolvedValueOnce(undefined);

      const mockHtml = '<html><head><script>{"buildId":"freshId123"}</script></head></html>';
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      } as Response);

      const adapter = createCachedBuildIdAdapter();
      const result = await adapter.getBuildId();

      expect(result).toBe('freshId123');
      expect(buildIdCache.writeCachedBuildId).toHaveBeenCalledWith('freshId123');
    });

    it('throws when homepage fetch fails', async () => {
      jest.spyOn(buildIdCache, 'readCachedBuildId').mockResolvedValueOnce(null);
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const adapter = createCachedBuildIdAdapter();
      await expect(adapter.getBuildId()).rejects.toThrow('Failed to fetch nofrills homepage');
    });

    it('throws when buildId cannot be parsed from HTML', async () => {
      jest.spyOn(buildIdCache, 'readCachedBuildId').mockResolvedValueOnce(null);
      jest.spyOn(buildIdCache, 'writeCachedBuildId').mockResolvedValueOnce(undefined);
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        text: async () => '<html>no build id here</html>',
      } as Response);

      const adapter = createCachedBuildIdAdapter();
      await expect(adapter.getBuildId()).rejects.toThrow('Could not parse buildId');
    });
  });

  describe('invalidate', () => {
    it('clears the cache', async () => {
      const clearSpy = jest
        .spyOn(buildIdCache, 'clearCachedBuildId')
        .mockResolvedValueOnce(undefined);

      const adapter = createCachedBuildIdAdapter();
      await adapter.invalidate();

      expect(clearSpy).toHaveBeenCalled();
    });
  });
});
