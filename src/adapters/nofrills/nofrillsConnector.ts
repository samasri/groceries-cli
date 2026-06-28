import { ChainConnector } from '../../ports/ChainConnector';
import { buildStore } from '../../config/stores';
import {
  createRateLimiter,
  throttleSearchGateway,
  throttleProductGateway,
} from '../../infrastructure/rateLimiter';
import { createCachedBuildIdAdapter } from '../cachedBuildIdAdapter';
import { createNofrillsSearchAdapter } from '../nofrillsSearchAdapter';
import { createNofrillsProductAdapter } from '../nofrillsProductAdapter';

const MIN_REQUEST_INTERVAL_MS = 1000;

export interface NofrillsConnectorConfig {
  storeId: string;
}

export const createNofrillsConnector = (config: NofrillsConnectorConfig): ChainConnector => {
  const limiter = createRateLimiter(MIN_REQUEST_INTERVAL_MS);
  const search = throttleSearchGateway(limiter, createNofrillsSearchAdapter(createCachedBuildIdAdapter()));
  const products = throttleProductGateway(limiter, createNofrillsProductAdapter());

  return {
    chain: 'nofrills',
    store: buildStore('nofrills', config.storeId),
    search,
    products,
  };
};
