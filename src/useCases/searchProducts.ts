import { Product, ProductTile } from '../domain/product';
import { Store } from '../domain/store';
import { SearchGateway } from '../ports/SearchGateway';
import { ProductGateway } from '../ports/ProductGateway';
import { enrichTileWithDetail } from './getProductDetail';

const PAGE_DELAY_MS = 300;
const TILES_PER_PAGE = 15;

export interface SearchOptions {
  limit: number;
  page: number;
  concurrency: number;
  availableOnly: boolean;
}

export interface SearchResult {
  query: string;
  store: Store;
  totalResults: number;
  results: Product[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithConcurrency = async <T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<Product>,
): Promise<Product[]> => {
  const results: Product[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(task));
    results.push(...batchResults);
  }

  return results;
};

const collectTiles = async (
  searchGateway: SearchGateway,
  term: string,
  storeId: string,
  startPage: number,
  limit: number,
): Promise<{ tiles: ProductTile[]; totalResults: number }> => {
  const tiles: ProductTile[] = [];
  let totalResults = 0;
  let page = startPage;

  while (tiles.length < limit) {
    if (page > startPage) await delay(PAGE_DELAY_MS);

    const searchPage = await searchGateway.searchTiles(term, storeId, page);
    ({ totalResults } = searchPage.pagination);

    tiles.push(...searchPage.productTiles);

    const isLastByCount = page * TILES_PER_PAGE >= totalResults;
    const isLastBySize = searchPage.productTiles.length < TILES_PER_PAGE;

    if (isLastByCount || isLastBySize) break;

    page++;
  }

  return { tiles: tiles.slice(0, limit), totalResults };
};

export const searchProducts = async (
  query: string,
  store: Store,
  options: SearchOptions,
  searchGateway: SearchGateway,
  productGateway: ProductGateway,
): Promise<SearchResult> => {
  const { limit, page, concurrency, availableOnly } = options;

  const { tiles, totalResults } = await collectTiles(searchGateway, query, store.id, page, limit);

  const enriched = await runWithConcurrency(tiles, concurrency, (tile) =>
    enrichTileWithDetail(tile, store.id, productGateway),
  );

  const results = availableOnly ? enriched.filter((p) => p.availableAtStore) : enriched;

  return { query, store, totalResults, results };
};
