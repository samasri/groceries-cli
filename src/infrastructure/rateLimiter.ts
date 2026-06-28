import { SearchGateway } from '../ports/SearchGateway';
import { ProductGateway } from '../ports/ProductGateway';

export type RateLimiter = <T>(fn: () => Promise<T>) => Promise<T>;

export const createRateLimiter = (minIntervalMs: number): RateLimiter => {
  let nextAllowedAt = 0;
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    const now = Date.now();
    const wait = Math.max(0, nextAllowedAt - now);
    nextAllowedAt = (now + wait) + minIntervalMs;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    return fn();
  };
};

export const throttleSearchGateway = (
  limiter: RateLimiter,
  gateway: SearchGateway,
): SearchGateway => ({
  searchTiles: (term, storeId, page) => limiter(() => gateway.searchTiles(term, storeId, page)),
});

export const throttleProductGateway = (
  limiter: RateLimiter,
  gateway: ProductGateway,
): ProductGateway => ({
  fetchDetail: (productId, storeId) => limiter(() => gateway.fetchDetail(productId, storeId)),
});
