import type { Page } from 'playwright';
import { Product, ProductTile } from '../../domain/product';
import { ProductGateway } from '../../ports/ProductGateway';
import { withPage } from '../../infrastructure/browser';
import { timed } from '../../infrastructure/timing';
import { MetroProductRaw, mapMetroProduct } from './metroMapper';

const METRO_ORIGIN = 'https://www.metro.ca';

const EXTRACT_PDP = `(() => {
  const nameEl = document.querySelector('h1');
  const priceEl = document.querySelector('.price-update');
  const ingredientsEl = document.querySelector('p.pdp-ingredients-list');
  return {
    name: nameEl ? nameEl.textContent : null,
    priceText: priceEl ? priceEl.textContent : null,
    ingredients: ingredientsEl ? ingredientsEl.textContent : null,
  };
})()`;

const fallbackProduct = (tile: ProductTile): Product => ({
  chain: 'metro',
  source: tile.source,
  productId: tile.productId,
  sku: tile.sku,
  name: tile.name,
  brand: tile.brand,
  description: tile.description,
  packageSize: tile.packageSize,
  price: tile.price,
});

const CHALLENGE_MAX_WAIT_MS = 30000;
const CHALLENGE_POLL_MS = 1500;

const waitOutChallenge = async (page: Page): Promise<void> => {
  const deadline = Date.now() + CHALLENGE_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => '');
    if (!/just a moment|verification successful/i.test(title)) return;
    await page.waitForTimeout(CHALLENGE_POLL_MS);
  }
};

const fetchPdp = async (page: Page, detailUrl: string): Promise<MetroProductRaw> => {
  await timed('pdp.goto', () =>
    page.goto(new URL(detailUrl, METRO_ORIGIN).toString(), {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }),
  );
  await timed('pdp.waitOutChallenge', () => waitOutChallenge(page));
  await timed('pdp.waitForH1', () =>
    page.waitForSelector('h1', { timeout: 15000 }).catch(() => undefined),
  );
  return timed('pdp.extract', () => page.evaluate(EXTRACT_PDP) as Promise<MetroProductRaw>);
};

export interface MetroProductAdapterConfig {
  chromiumPath?: string;
  resolveDetailUrl: (productId: string) => string | undefined;
  resolveTile: (productId: string) => ProductTile | undefined;
}

export const createMetroProductAdapter = (
  config: MetroProductAdapterConfig,
): ProductGateway => ({
  fetchDetail: async (productId: string): Promise<Product> => {
    const tile: ProductTile = config.resolveTile(productId) ?? {
      chain: 'metro',
      source: 'main',
      productId,
      sku: productId,
      name: productId,
    };
    const detailUrl = config.resolveDetailUrl(productId);
    if (!detailUrl) return fallbackProduct(tile);

    return timed(`metro.fetchDetail(${productId})`, () =>
      withPage(async (page) => {
        const raw = await fetchPdp(page, detailUrl);
        return mapMetroProduct(tile, raw);
      }, config.chromiumPath),
    );
  },
});
