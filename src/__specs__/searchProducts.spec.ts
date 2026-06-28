import { searchProducts } from '../useCases/searchProducts';
import { SearchGateway } from '../ports/SearchGateway';
import { ProductGateway } from '../ports/ProductGateway';
import { Store } from '../domain/store';
import { Product, SearchPage } from '../domain/product';

const makeNofrillsStore = (): Store => ({
  chain: 'nofrills',
  id: '7952',
  name: 'No Frills #7952',
  address: '',
});

const makeTile = (id: string, n: number) => ({
  chain: 'nofrills' as const,
  source: 'main' as const,
  productId: `${id}_EA`,
  sku: id,
  name: `Product ${n}`,
  brand: 'Brand',
  price: 5.0,
});

const makeSearchPage = (tiles: ReturnType<typeof makeTile>[], totalResults = 15): SearchPage => ({
  pagination: { pageNumber: 1, pageSize: 48, totalResults, hasMore: false, isLast: true },
  productTiles: tiles,
});

const makeProduct = (id: string, available: boolean): Product => ({
  chain: 'nofrills',
  source: 'main',
  productId: `${id}_EA`,
  sku: id,
  name: `Product ${id}`,
  price: 5.0,
  availableAtStore: available,
});

const makeSearchGateway = (pages: SearchPage[]): SearchGateway => {
  let call = 0;
  return {
    searchTiles: jest.fn().mockImplementation(() => {
      const page = pages[call] ?? pages[pages.length - 1];
      call++;
      return Promise.resolve(page);
    }),
  };
};

const makeProductGateway = (products: Record<string, Product>): ProductGateway => ({
  fetchDetail: jest
    .fn()
    .mockImplementation((productId: string) =>
      products[productId]
        ? Promise.resolve(products[productId])
        : Promise.reject(new Error('Not found')),
    ),
});

const defaultOptions = { limit: 20, page: 1, concurrency: 1, availableOnly: false };

describe('searchProducts', () => {
  describe('basic search', () => {
    it('returns enriched products', async () => {
      const tiles = [makeTile('111', 1), makeTile('222', 2)];
      const searchGateway = makeSearchGateway([makeSearchPage(tiles, 2)]);
      const products = {
        '111_EA': makeProduct('111', true),
        '222_EA': makeProduct('222', false),
      };
      const productGateway = makeProductGateway(products);

      const result = await searchProducts(
        'juice',
        makeNofrillsStore(),
        defaultOptions,
        searchGateway,
        productGateway,
      );

      expect(result.results).toHaveLength(2);
      expect(result.query).toBe('juice');
      expect(result.store).toMatchObject({ chain: 'nofrills', id: '7952' });
    });

    it('respects the limit option', async () => {
      const tiles = Array.from({ length: 10 }, (_, i) => makeTile(String(i), i));
      const searchGateway = makeSearchGateway([makeSearchPage(tiles, 10)]);
      const productGateway = makeProductGateway(
        Object.fromEntries(tiles.map((t) => [t.productId, makeProduct(t.sku, true)])),
      );

      const result = await searchProducts(
        'snack',
        makeNofrillsStore(),
        { ...defaultOptions, limit: 3 },
        searchGateway,
        productGateway,
      );

      expect(result.results).toHaveLength(3);
    });
  });

  describe('--available-only filtering', () => {
    it('filters out products that are not in stock', async () => {
      const tiles = [makeTile('A', 1), makeTile('B', 2), makeTile('C', 3)];
      const searchGateway = makeSearchGateway([makeSearchPage(tiles, 3)]);
      const products = {
        A_EA: makeProduct('A', true),
        B_EA: makeProduct('B', false),
        C_EA: makeProduct('C', true),
      };
      const productGateway = makeProductGateway(products);

      const result = await searchProducts(
        'bread',
        makeNofrillsStore(),
        { ...defaultOptions, availableOnly: true },
        searchGateway,
        productGateway,
      );

      expect(result.results).toHaveLength(2);
      expect(result.results.every((p) => p.availableAtStore)).toBe(true);
    });
  });

  describe('graceful degradation', () => {
    it('returns tile data when product detail fetch fails', async () => {
      const tiles = [makeTile('X', 1)];
      const searchGateway = makeSearchGateway([makeSearchPage(tiles, 1)]);
      const productGateway: ProductGateway = {
        fetchDetail: jest.fn().mockRejectedValue(new Error('API error')),
      };

      const result = await searchProducts(
        'chips',
        makeNofrillsStore(),
        defaultOptions,
        searchGateway,
        productGateway,
      );

      expect(result.results).toHaveLength(1);
      expect(result.results[0].productId).toBe('X_EA');
      expect(result.results[0].availableAtStore).toBeUndefined();
    });
  });

  describe('concurrency', () => {
    it('limits concurrent detail fetches to the concurrency option', async () => {
      const tiles = Array.from({ length: 6 }, (_, i) => makeTile(String(i + 1), i + 1));
      const searchGateway = makeSearchGateway([makeSearchPage(tiles, 6)]);

      let concurrent = 0;
      let maxConcurrent = 0;

      const productGateway: ProductGateway = {
        fetchDetail: jest.fn().mockImplementation(async (id: string) => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 10));
          concurrent--;
          return makeProduct(id.split('_')[0], true);
        }),
      };

      await searchProducts(
        'test',
        makeNofrillsStore(),
        { ...defaultOptions, concurrency: 2, limit: 6 },
        searchGateway,
        productGateway,
      );

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('pagination', () => {
    it('returns totalResults from the first page', async () => {
      const tiles = [makeTile('Z', 1)];
      const searchGateway = makeSearchGateway([makeSearchPage(tiles, 99)]);
      const productGateway = makeProductGateway({ Z_EA: makeProduct('Z', true) });

      const result = await searchProducts(
        'water',
        makeNofrillsStore(),
        defaultOptions,
        searchGateway,
        productGateway,
      );

      expect(result.totalResults).toBe(99);
    });

    it('stops paginating when the gateway reports hasMore=false, even if tiles.length < limit', async () => {
      const tiles = [makeTile('A', 1), makeTile('B', 2)];
      const exhaustedPage: SearchPage = {
        pagination: { pageNumber: 1, pageSize: 48, totalResults: 2, hasMore: false, isLast: true },
        productTiles: tiles,
      };
      const searchGateway = makeSearchGateway([exhaustedPage]);
      const productGateway = makeProductGateway({
        A_EA: makeProduct('A', true),
        B_EA: makeProduct('B', true),
      });

      const result = await searchProducts(
        'pinto beans',
        makeNofrillsStore(),
        { ...defaultOptions, limit: 20 },
        searchGateway,
        productGateway,
      );

      expect(result.results).toHaveLength(2);
      expect(searchGateway.searchTiles).toHaveBeenCalledTimes(1);
    });
  });
});
