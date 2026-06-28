import type { Page } from 'playwright';
import { SearchPage, ProductTile } from '../../domain/product';
import { SearchGateway } from '../../ports/SearchGateway';
import { withPage } from '../../infrastructure/browser';
import { timed } from '../../infrastructure/timing';
import { MetroTileRaw, mapMetroTile, parseTotalResults } from './metroMapper';

const TILES_PER_PAGE = 42;
const STORE_PAGE_URL = (storeId: string) => `https://www.metro.ca/en/find-a-grocery/${storeId}`;
const SEARCH_URL = (query: string, page: number) =>
  `https://www.metro.ca/en/online-grocery/search?filter=${encodeURIComponent(query)}&page=${page}`;

const EXTRACT_TILES = `(() => {
  const tiles = Array.from(document.querySelectorAll('[data-product-code]'));
  return tiles.map((tile) => {
    const link = tile.querySelector('a.product-details-link');
    const priceEl = tile.querySelector('[data-main-price]');
    const titleEl = tile.querySelector('.head__title');
    const unitEl = tile.querySelector('.head__unit-details');
    return {
      productCode: tile.getAttribute('data-product-code'),
      name: titleEl ? titleEl.textContent : null,
      productBrand: tile.getAttribute('data-product-brand'),
      packageSize: unitEl ? unitEl.textContent : null,
      mainPrice: priceEl ? priceEl.getAttribute('data-main-price') : null,
      detailUrl: link ? link.getAttribute('href') : null,
    };
  });
})()`;

const bindStore = (page: Page, storeId: string): Promise<unknown> =>
  timed('search.bindStore.goto', () =>
    page.goto(STORE_PAGE_URL(storeId), { waitUntil: 'domcontentloaded', timeout: 60000 }),
  );

const fetchRawTiles = async (page: Page, query: string, pageNum: number): Promise<MetroTileRaw[]> => {
  await timed('search.goto', () =>
    page.goto(SEARCH_URL(query, pageNum), { waitUntil: 'domcontentloaded', timeout: 60000 }),
  );
  await timed('search.waitForTile', () =>
    page.waitForSelector('[data-product-code]', { timeout: 30000 }).catch(() => undefined),
  );
  return timed('search.extractTiles', () => page.evaluate(EXTRACT_TILES) as Promise<MetroTileRaw[]>);
};

const fetchTotalResults = async (page: Page): Promise<number> =>
  timed('search.totalResults', async () => {
    const bodyText = await page.locator('body').innerText().catch(() => '');
    return parseTotalResults(bodyText);
  });

export interface MetroSearchAdapterConfig {
  chromiumPath?: string;
  rememberDetailUrl: (productId: string, url: string) => void;
}

export const createMetroSearchAdapter = (
  config: MetroSearchAdapterConfig,
): SearchGateway => {
  let storeBound: string | null = null;

  const searchTiles = (term: string, storeId: string, pageNum: number): Promise<SearchPage> =>
    timed(`metro.searchTiles(${term}, page=${pageNum})`, () =>
      withPage(async (page) => {
        if (storeBound !== storeId) {
          await bindStore(page, storeId);
          storeBound = storeId;
        }

        const rawTiles = await fetchRawTiles(page, term, pageNum);
        const totalResults = await fetchTotalResults(page);

      const productTiles: ProductTile[] = [];
      rawTiles.forEach((raw) => {
        const tile = mapMetroTile(raw);
        if (!tile) return;
        if (tile.detailUrl) config.rememberDetailUrl(tile.productId, tile.detailUrl);
        productTiles.push(tile);
      });

      const hasMore = pageNum * TILES_PER_PAGE < totalResults;

        return {
          pagination: {
            pageNumber: pageNum,
            pageSize: productTiles.length,
            totalResults,
            hasMore,
            isLast: !hasMore,
          },
          productTiles,
        };
      }, config.chromiumPath),
    );

  return { searchTiles };
};
