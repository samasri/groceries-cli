import { ChainConnector } from '../../ports/ChainConnector';
import { ProductTile } from '../../domain/product';
import { SearchGateway } from '../../ports/SearchGateway';
import { ProductGateway } from '../../ports/ProductGateway';
import { buildStore } from '../../config/stores';
import {
  createRateLimiter,
  throttleSearchGateway,
  throttleProductGateway,
} from '../../infrastructure/rateLimiter';
import { createMetroSearchAdapter } from './metroSearchAdapter';
import { createMetroProductAdapter } from './metroProductAdapter';

const MIN_REQUEST_INTERVAL_MS = 1000;

export interface MetroConnectorConfig {
  storeId: string;
  chromiumPath?: string;
}

const wrapSearchToCacheTiles = (
  gateway: SearchGateway,
  cacheTile: (tile: ProductTile) => void,
): SearchGateway => ({
  searchTiles: async (term, storeId, page) => {
    const result = await gateway.searchTiles(term, storeId, page);
    result.productTiles.forEach(cacheTile);
    return result;
  },
});

export const createMetroConnector = (config: MetroConnectorConfig): ChainConnector => {
  const limiter = createRateLimiter(MIN_REQUEST_INTERVAL_MS);
  const detailUrls = new Map<string, string>();
  const tiles = new Map<string, ProductTile>();

  const searchAdapter = createMetroSearchAdapter({
    chromiumPath: config.chromiumPath,
    rememberDetailUrl: (productId, url) => {
      detailUrls.set(productId, url);
    },
  });

  const search = throttleSearchGateway(
    limiter,
    wrapSearchToCacheTiles(searchAdapter, (tile) => tiles.set(tile.productId, tile)),
  );

  const productAdapter: ProductGateway = createMetroProductAdapter({
    chromiumPath: config.chromiumPath,
    resolveDetailUrl: (productId) => detailUrls.get(productId),
    resolveTile: (productId) => tiles.get(productId),
  });

  const products = throttleProductGateway(limiter, productAdapter);

  return {
    chain: 'metro',
    store: buildStore('metro', config.storeId),
    search,
    products,
  };
};
