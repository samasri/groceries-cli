import { createNofrillsSearchAdapter } from '../adapters/nofrillsSearchAdapter';
import * as httpClient from '../infrastructure/httpClient';
import { BuildIdProvider } from '../ports/BuildIdProvider';

const mockBuildIdProvider = (): BuildIdProvider => ({
  getBuildId: jest.fn().mockResolvedValue('testBuildId'),
  invalidate: jest.fn().mockResolvedValue(undefined),
});

const makeSearchResponse = (tiles: object[], totalResults = 30) => ({
  pageProps: {
    initialSearchData: {
      layout: {
        sections: {
          mainContentCollection: {
            components: [
              {
                componentId: 'productGridComponent',
                data: {
                  pagination: {
                    pageNumber: 1,
                    pageSize: 48,
                    totalResults,
                    hasMore: false,
                    isLast: false,
                  },
                  productTiles: tiles,
                },
              },
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

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider());
      const result = await adapter.searchTiles('milk', '7952', 1);

      expect(result.productTiles).toHaveLength(1);
      expect(result.productTiles[0]).toMatchObject({
        productId: '20188873_EA',
        sku: '20188873',
        name: '2% Milk',
        brand: 'Neilson',
        price: 6.44,
        packageSize: '4 l',
      });
    });

    it('builds the correct search URL', async () => {
      const httpSpy = jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => makeSearchResponse([]),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider());
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

      const adapter = createNofrillsSearchAdapter(provider);
      await expect(adapter.searchTiles('milk', '7952', 1)).rejects.toThrow('buildId invalidated');
      expect(provider.invalidate).toHaveBeenCalled();
    });

    it('throws on non-404 error responses', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider());
      await expect(adapter.searchTiles('milk', '7952', 1)).rejects.toThrow(
        'Search request failed: 500',
      );
    });

    it('throws when product grid component is missing', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          pageProps: {
            initialSearchData: {
              layout: { sections: { mainContentCollection: { components: [] } } },
            },
          },
        }),
      } as Response);

      const adapter = createNofrillsSearchAdapter(mockBuildIdProvider());
      await expect(adapter.searchTiles('milk', '7952', 1)).rejects.toThrow(
        'Could not extract product grid',
      );
    });
  });
});
