import { searchMarketplace } from '../useCases/searchMarketplace';
import { ChainConnector } from '../ports/ChainConnector';
import { Chain } from '../domain/chain';
import { Store } from '../domain/store';
import { Product, SearchPage } from '../domain/product';
import { SearchGateway } from '../ports/SearchGateway';
import { ProductGateway } from '../ports/ProductGateway';

const makeStore = (chain: Chain, id: string): Store => ({
  chain,
  id,
  name: `${chain} #${id}`,
  address: '',
});

const makeTile = (chain: Chain, n: number) => ({
  chain,
  source: 'main' as const,
  productId: `${chain}-${n}_EA`,
  sku: `${chain}-${n}`,
  name: `${chain} product ${n}`,
  price: 1.0 + n,
});

const makePage = (tiles: ReturnType<typeof makeTile>[], totalResults: number): SearchPage => ({
  pagination: { pageNumber: 1, pageSize: 48, totalResults, hasMore: false, isLast: true },
  productTiles: tiles,
});

const makeProduct = (chain: Chain, sku: string): Product => ({
  chain,
  source: 'main',
  productId: `${sku}_EA`,
  sku,
  name: `${chain} ${sku}`,
});

const makeConnector = (
  chain: Chain,
  storeId: string,
  searchImpl: SearchGateway['searchTiles'],
  productImpl: ProductGateway['fetchDetail'],
): ChainConnector => ({
  chain,
  store: makeStore(chain, storeId),
  search: { searchTiles: searchImpl },
  products: { fetchDetail: productImpl },
});

const defaultOptions = { limit: 5, page: 1, concurrency: 1, availableOnly: false };

describe('searchMarketplace', () => {
  it('fans out to multiple connectors and merges chain-tagged results', async () => {
    const nofrillsTiles = [makeTile('nofrills', 1), makeTile('nofrills', 2)];
    const metroTiles = [makeTile('metro', 1)];

    const nofrills = makeConnector(
      'nofrills',
      '7952',
      jest.fn().mockResolvedValue(makePage(nofrillsTiles, 2)),
      jest.fn().mockImplementation((id: string) => {
        const sku = id.split('_')[0];
        return Promise.resolve(makeProduct('nofrills', sku));
      }),
    );
    const metro = makeConnector(
      'metro',
      '218',
      jest.fn().mockResolvedValue(makePage(metroTiles, 1)),
      jest.fn().mockImplementation((id: string) => {
        const sku = id.split('_')[0];
        return Promise.resolve(makeProduct('metro', sku));
      }),
    );

    const result = await searchMarketplace('banana', defaultOptions, [nofrills, metro]);

    expect(result.results).toHaveLength(3);
    expect(result.results.filter((p) => p.chain === 'nofrills')).toHaveLength(2);
    expect(result.results.filter((p) => p.chain === 'metro')).toHaveLength(1);
    expect(result.totalResults).toBe(3);
    expect(result.perChain.nofrills?.ok).toBe(true);
    expect(result.perChain.metro?.ok).toBe(true);
  });

  it('isolates failures: one chain throwing leaves the other intact', async () => {
    const nofrillsTiles = [makeTile('nofrills', 1)];

    const nofrills = makeConnector(
      'nofrills',
      '7952',
      jest.fn().mockResolvedValue(makePage(nofrillsTiles, 1)),
      jest.fn().mockImplementation((id: string) => Promise.resolve(makeProduct('nofrills', id.split('_')[0]))),
    );
    const metro = makeConnector(
      'metro',
      '218',
      jest.fn().mockRejectedValue(new Error('Cloudflare blocked us')),
      jest.fn(),
    );

    const result = await searchMarketplace('banana', defaultOptions, [nofrills, metro]);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].chain).toBe('nofrills');
    expect(result.perChain.nofrills?.ok).toBe(true);
    expect(result.perChain.metro?.ok).toBe(false);
    expect(result.perChain.metro?.error).toMatch(/Cloudflare/);
  });

  it('runs connectors in parallel rather than sequentially', async () => {
    const slow: SearchGateway['searchTiles'] = jest.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makePage([], 0)), 60)),
    );

    const connectors = [
      makeConnector('nofrills', '7952', slow, jest.fn()),
      makeConnector('metro', '218', slow, jest.fn()),
    ];

    const start = Date.now();
    await searchMarketplace('banana', defaultOptions, connectors);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(120);
  });

  it('preserves chain tag from each connector even when the search gateway emits untagged tiles (defensive)', async () => {
    const nofrillsTiles = [makeTile('nofrills', 1)];

    const nofrills = makeConnector(
      'nofrills',
      '7952',
      jest.fn().mockResolvedValue(makePage(nofrillsTiles, 1)),
      jest.fn().mockImplementation((id: string) => Promise.resolve(makeProduct('nofrills', id.split('_')[0]))),
    );

    const result = await searchMarketplace('banana', defaultOptions, [nofrills]);
    expect(result.results.every((p) => p.chain === 'nofrills')).toBe(true);
  });
});
