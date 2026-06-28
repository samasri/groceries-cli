import { Product, ProductTile } from '../../domain/product';

export interface MetroTileRaw {
  productCode: string | null;
  name: string | null;
  productBrand: string | null;
  packageSize: string | null;
  mainPrice: string | null;
  detailUrl: string | null;
}

export interface MetroProductRaw {
  name: string | null;
  priceText: string | null;
  ingredients: string | null;
}

const parsePrice = (raw: string | null): number | undefined => {
  if (!raw) return undefined;
  const match = raw.replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const value = parseFloat(match[0]);
  return Number.isFinite(value) ? value : undefined;
};

const MAX_NAME_LENGTH = 250;
const MAX_INGREDIENTS_LENGTH = 4000;

const clean = (raw: string | null | undefined): string | undefined => {
  if (!raw) return undefined;
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const cleanBounded = (raw: string | null | undefined, max: number): string | undefined => {
  const value = clean(raw);
  if (!value) return undefined;
  if (value.length > max) return undefined;
  if (value.includes('<') || value.includes('document.')) return undefined;
  return value;
};

export const mapMetroTile = (raw: MetroTileRaw): ProductTile | null => {
  const productId = clean(raw.productCode);
  const name = cleanBounded(raw.name, MAX_NAME_LENGTH);
  if (!productId || !name) return null;

  return {
    chain: 'metro',
    source: 'main',
    productId,
    sku: productId,
    name,
    brand: cleanBounded(raw.productBrand, MAX_NAME_LENGTH),
    packageSize: cleanBounded(raw.packageSize, MAX_NAME_LENGTH),
    price: parsePrice(raw.mainPrice),
    detailUrl: clean(raw.detailUrl),
  };
};

export const parseTotalResults = (bodyText: string): number => {
  const match = bodyText.match(/(\d+)\s+r[ée]sultats?|(\d+)\s+results?/i);
  if (!match) return 0;
  return parseInt(match[1] ?? match[2], 10);
};

export const mapMetroProduct = (tile: ProductTile, raw: MetroProductRaw): Product => ({
  chain: 'metro',
  source: tile.source,
  productId: tile.productId,
  sku: tile.sku,
  name: cleanBounded(raw.name, MAX_NAME_LENGTH) ?? tile.name,
  brand: tile.brand,
  description: tile.description,
  packageSize: tile.packageSize,
  price: parsePrice(raw.priceText) ?? tile.price,
  ingredients: cleanBounded(raw.ingredients, MAX_INGREDIENTS_LENGTH),
});
