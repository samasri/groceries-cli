import { Product, ProductTile } from '../domain/product';
import { Store } from '../domain/store';
import { SearchGateway } from '../ports/SearchGateway';
import { ProductGateway } from '../ports/ProductGateway';
import { enrichTileWithDetail } from './getProductDetail';

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
    const searchPage = await searchGateway.searchTiles(term, storeId, page);
    ({ totalResults } = searchPage.pagination);

    tiles.push(...searchPage.productTiles);

    if (!searchPage.pagination.hasMore) break;
    if (searchPage.productTiles.length === 0) break;
    if (tiles.length >= totalResults) break;

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
