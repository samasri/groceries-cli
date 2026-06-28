import {
  MetroProductRaw,
  MetroTileRaw,
  mapMetroProduct,
  mapMetroTile,
  parseTotalResults,
} from '../adapters/metro/metroMapper';
import { ProductTile } from '../domain/product';

const baseTileRaw = (overrides: Partial<MetroTileRaw> = {}): MetroTileRaw => ({
  productCode: '4011',
  name: 'Banana',
  productBrand: 'Chiquita',
  packageSize: '1 un',
  mainPrice: '0.37',
  detailUrl: '/en/online-grocery/aisles/fruits-vegetables/fruits/bananas-plantains/banana/p/4011',
  ...overrides,
});

describe('mapMetroTile', () => {
  it('maps a complete tile and stamps chain=metro with source=main', () => {
    const tile = mapMetroTile(baseTileRaw());
    expect(tile).toEqual({
      chain: 'metro',
      source: 'main',
      productId: '4011',
      sku: '4011',
      name: 'Banana',
      brand: 'Chiquita',
      packageSize: '1 un',
      price: 0.37,
      detailUrl:
        '/en/online-grocery/aisles/fruits-vegetables/fruits/bananas-plantains/banana/p/4011',
    });
  });

  it('omits brand when productBrand is missing', () => {
    const tile = mapMetroTile(baseTileRaw({ productBrand: null }));
    expect(tile?.brand).toBeUndefined();
  });

  it('omits brand when productBrand is whitespace', () => {
    const tile = mapMetroTile(baseTileRaw({ productBrand: '   ' }));
    expect(tile?.brand).toBeUndefined();
  });

  it('returns null when productCode is missing', () => {
    expect(mapMetroTile(baseTileRaw({ productCode: null }))).toBeNull();
  });

  it('returns null when name is missing', () => {
    expect(mapMetroTile(baseTileRaw({ name: '   ' }))).toBeNull();
  });

  it('omits price when mainPrice cannot be parsed', () => {
    const tile = mapMetroTile(baseTileRaw({ mainPrice: 'N/A' }));
    expect(tile?.price).toBeUndefined();
  });

  it('collapses whitespace in name and package size', () => {
    const tile = mapMetroTile(baseTileRaw({ name: '  Banana   Bunch ', packageSize: '\n1 un\n' }));
    expect(tile?.name).toBe('Banana Bunch');
    expect(tile?.packageSize).toBe('1 un');
  });
});

describe('parseTotalResults', () => {
  it('extracts results from English page text', () => {
    expect(parseTotalResults('Showing 1-42 of 98 results for banana')).toBe(98);
  });

  it('extracts results from French page text', () => {
    expect(parseTotalResults('Affichage de 1-42 de 98 résultats')).toBe(98);
  });

  it('returns 0 when no count is present', () => {
    expect(parseTotalResults('Aucun produit trouvé')).toBe(0);
  });
});

describe('mapMetroProduct', () => {
  const tile: ProductTile = {
    chain: 'metro',
    source: 'main',
    productId: '4011',
    sku: '4011',
    name: 'Banana',
    packageSize: '1 un',
    price: 0.37,
  };

  it('layers PDP-extracted fields on top of the tile and keeps chain=metro', () => {
    const raw: MetroProductRaw = {
      name: 'Banana',
      priceText: '$0.42',
      ingredients: 'Banana',
    };

    expect(mapMetroProduct(tile, raw)).toEqual({
      chain: 'metro',
      source: 'main',
      productId: '4011',
      sku: '4011',
      name: 'Banana',
      packageSize: '1 un',
      price: 0.42,
      ingredients: 'Banana',
    });
  });

  it('falls back to tile fields when PDP data is missing', () => {
    const raw: MetroProductRaw = { name: null, priceText: null, ingredients: null };
    expect(mapMetroProduct(tile, raw)).toEqual({
      chain: 'metro',
      source: 'main',
      productId: '4011',
      sku: '4011',
      name: 'Banana',
      packageSize: '1 un',
      price: 0.37,
    });
  });

  it('propagates tile.source so related tiles stay tagged through PDP enrichment', () => {
    const raw: MetroProductRaw = { name: 'Banana', priceText: '$0.42', ingredients: null };
    const relatedTile: ProductTile = { ...tile, source: 'related' };
    expect(mapMetroProduct(relatedTile, raw).source).toBe('related');
  });
});
