import { createNofrillsSearchAdapter } from '../adapters/nofrillsSearchAdapter';
import * as httpClient from '../infrastructure/httpClient';
import { BuildIdProvider } from '../ports/BuildIdProvider';
import { UpstreamAnomalyReporter } from '../infrastructure/upstreamAnomaly';

const mockBuildIdProvider = (): BuildIdProvider => ({
  getBuildId: jest.fn().mockResolvedValue('testBuildId'),
  invalidate: jest.fn().mockResolvedValue(undefined),
});

const noopAnomalyReporter = (): UpstreamAnomalyReporter => ({
  recordSearchAnomaly: jest.fn().mockResolvedValue(undefined),
});

const makeGrid = (tiles: object[], totalResults = 30) => ({
  componentId: 'productGridComponent',
  data: {
    pagination: { pageNumber: 1, pageSize: 48, totalResults, hasMore: false, isLast: false },
    productTiles: tiles,
  },
});

const makeSearchResponse = (tiles: object[], totalResults = 30) => ({
  pageProps: {
    initialSearchData: {
      layout: {
        sections: {
          mainContentCollection: {
            components: [makeGrid(tiles, totalResults)],
          },
        },
      },
    },
  },
});

const makeMultiGridResponse = (
  mainTiles: object[],
  relatedTiles: object[],
  totalResults = 30,
) => ({
  pageProps: {
    initialSearchData: {
      layout: {
        sections: {
          mainContentCollection: {
            components: [
              makeGrid(mainTiles, totalResults),
              { componentId: 'mediaShoppableDisplayComponent', data: {} },
              makeGrid(relatedTiles, totalResults),
              { componentId: 'relatedSearchComponent', data: {} },
            ],
          },
        },
      },
    },
  },
});

describe('nofrillsSearchAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('searchTiles', () => {
    it('extracts product tiles from grid component', async () => {
      const rawTile = {
        productId: '20188873_EA',
        articleNumber: '20188873',
        title: '2% Milk',
        brand: 'Neilson',
        description: 'Fresh milk',
        packageSizing: '4 l, $0.16/100ml',
        pricing: { displayPrice: '$6.44', price: '6.44' },
      };

      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeSearchResponse([rawTile]),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: noopAnomalyReporter(),
      });
      const result = await adapter.searchTiles('milk', '7952', 1);

      expect(result.productTiles).toHaveLength(1);
      expect(result.productTiles[0]).toMatchObject({
        chain: 'nofrills',
        source: 'main',
        productId: '20188873_EA',
        sku: '20188873',
        name: '2% Milk',
        brand: 'Neilson',
        price: 6.44,
        packageSize: '4 l',
      });
    });

    it('tags tiles from the first grid as main and subsequent grids as related', async () => {
      const mainRaw = { productId: 'A_EA', articleNumber: 'A', title: 'Pinto Beans' };
      const relatedRaw = { productId: 'B_EA', articleNumber: 'B', title: 'Black Beans' };

      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeMultiGridResponse([mainRaw], [relatedRaw]),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: noopAnomalyReporter(),
      });
      const result = await adapter.searchTiles('pinto beans', '7952', 1);

      expect(result.productTiles.map((t) => [t.productId, t.source])).toEqual([
        ['A_EA', 'main'],
        ['B_EA', 'related'],
      ]);
    });

    it('dedupes tiles across grids by productId, keeping the main tag', async () => {
      const sharedRaw = { productId: 'A_EA', articleNumber: 'A', title: 'Pinto Beans' };
      const onlyRelatedRaw = { productId: 'C_EA', articleNumber: 'C', title: 'Kidney Beans' };

      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeMultiGridResponse([sharedRaw], [sharedRaw, onlyRelatedRaw]),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: noopAnomalyReporter(),
      });
      const result = await adapter.searchTiles('pinto beans', '7952', 1);

      expect(result.productTiles).toHaveLength(2);
      expect(result.productTiles.find((t) => t.productId === 'A_EA')?.source).toBe('main');
      expect(result.productTiles.find((t) => t.productId === 'C_EA')?.source).toBe('related');
    });

    it('takes pagination from the first grid even when related grids are present', async () => {
      const mainRaw = { productId: 'A_EA', articleNumber: 'A', title: 'A' };
      const relatedRaw = { productId: 'B_EA', articleNumber: 'B', title: 'B' };

      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeMultiGridResponse([mainRaw], [relatedRaw], 16),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: noopAnomalyReporter(),
      });
      const result = await adapter.searchTiles('pinto beans', '7952', 1);

      expect(result.pagination.totalResults).toBe(16);
    });

    it('builds the correct search URL', async () => {
      const httpSpy = jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeSearchResponse([]),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: noopAnomalyReporter(),
      });
      await adapter.searchTiles('oat milk', '7952', 2);

      expect(httpSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'testBuildId/en/search.json?search-bar=oat%20milk&storeId=7952&page=2',
        ),
      );
    });

    it('invalidates buildId and throws on 404', async () => {
      const provider = mockBuildIdProvider();
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const adapter = createNofrillsSearchAdapter(provider, { anomalyReporter: noopAnomalyReporter() });
      await expect(adapter.searchTiles('milk', '7952', 1)).rejects.toThrow('buildId invalidated');
      expect(provider.invalidate).toHaveBeenCalled();
    });

    it('throws on non-404 error responses', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: noopAnomalyReporter(),
      });
      await expect(adapter.searchTiles('milk', '7952', 1)).rejects.toThrow(
        'Search request failed: 500',
      );
    });

    it('records an anomaly and throws when no product grid component is present', async () => {
      const malformed = {
        pageProps: {
          initialSearchData: {
            layout: {
              sections: {
                mainContentCollection: {
                  components: [{ componentId: 'mediaShoppableDisplayComponent', data: {} }],
                },
              },
            },
          },
        },
      };

      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => malformed,
      } as Response);

      const reporter = noopAnomalyReporter();
      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider(), {
        anomalyReporter: reporter,
      });

      await expect(adapter.searchTiles('milk', '7952', 1)).rejects.toThrow(
        'Could not extract product grid',
      );

      expect(reporter.recordSearchAnomaly).toHaveBeenCalledWith(
        expect.objectContaining({
          chain: 'nofrills',
          kind: 'missing-product-grid',
          query: 'milk',
          storeId: '7952',
          httpStatus: 200,
        }),
        malformed,
      );
    });
  });
});
