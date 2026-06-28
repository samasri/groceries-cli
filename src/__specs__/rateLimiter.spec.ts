import {
  createRateLimiter,
  throttleSearchGateway,
  throttleProductGateway,
} from '../infrastructure/rateLimiter';
import { SearchGateway } from '../ports/SearchGateway';
import { ProductGateway } from '../ports/ProductGateway';

const elapse = async (limiter: ReturnType<typeof createRateLimiter>, n: number): Promise<number[]> => {
  const stamps: number[] = [];
  for (let i = 0; i < n; i++) {
    await limiter(async () => {
      stamps.push(Date.now());
    });
  }
  return stamps;
};

describe('createRateLimiter', () => {
  it('does not delay the first call', async () => {
    const limiter = createRateLimiter(1000);
    const start = Date.now();
    await limiter(async () => undefined);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('enforces at least minIntervalMs between consecutive calls', async () => {
    const limiter = createRateLimiter(100);
    const [first, second, third] = await elapse(limiter, 3);

    expect(second - first).toBeGreaterThanOrEqual(95);
    expect(third - second).toBeGreaterThanOrEqual(95);
  });

  it('does not stack delays when calls arrive after the interval has passed', async () => {
    const limiter = createRateLimiter(50);
    await limiter(async () => undefined);
    await new Promise((r) => setTimeout(r, 80));
    const start = Date.now();
    await limiter(async () => undefined);
    expect(Date.now() - start).toBeLessThan(30);
  });
});

describe('throttleSearchGateway', () => {
  it('serializes calls through the limiter', async () => {
    const calls: number[] = [];
    const inner: SearchGateway = {
      searchTiles: jest.fn().mockImplementation(async () => {
        calls.push(Date.now());
        return {
          pagination: { pageNumber: 1, pageSize: 1, totalResults: 0, hasMore: false, isLast: true },
          productTiles: [],
        };
      }),
    };
    const limiter = createRateLimiter(80);
    const gateway = throttleSearchGateway(limiter, inner);

    await gateway.searchTiles('q', 's', 1);
    await gateway.searchTiles('q', 's', 2);

    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(75);
  });
});

describe('throttleProductGateway', () => {
  it('serializes calls through the limiter', async () => {
    const calls: number[] = [];
    const inner: ProductGateway = {
      fetchDetail: jest.fn().mockImplementation(async () => {
        calls.push(Date.now());
        return {
          chain: 'nofrills' as const,
          productId: 'p',
          sku: 'p',
          name: 'p',
        };
      }),
    };
    const limiter = createRateLimiter(80);
    const gateway = throttleProductGateway(limiter, inner);

    await gateway.fetchDetail('a', 's');
    await gateway.fetchDetail('b', 's');

    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(75);
  });
});
