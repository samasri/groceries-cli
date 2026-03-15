import { enrichTileWithDetail } from '../useCases/getProductDetail';
import { ProductGateway } from '../ports/ProductGateway';
import { ProductTile, Product } from '../domain/product';

const tile: ProductTile = {
  productId: '20188873_EA',
  sku: '20188873',
  name: '2% Milk',
  brand: 'Neilson',
  description: 'Fresh milk',
  packageSize: '4 l',
  price: 6.44,
};

const enrichedProduct: Product = {
  productId: '20188873_EA',
  sku: '20188873',
  name: '2% Milk',
  brand: 'Neilson',
  description: 'Fresh milk',
  price: 6.44,
  availableAtStore: true,
  ingredients: 'Partly Skimmed Milk',
  nutritionFacts: { calories: '130 cal' },
};

describe('enrichTileWithDetail', () => {
  it('returns enriched product from gateway', async () => {
    const productGateway: ProductGateway = {
      fetchDetail: jest.fn().mockResolvedValueOnce(enrichedProduct),
    };

    const result = await enrichTileWithDetail(tile, '7952', productGateway);

    expect(result).toEqual(enrichedProduct);
    expect(productGateway.fetchDetail).toHaveBeenCalledWith('20188873_EA', '7952');
  });

  it('falls back to tile data when gateway throws', async () => {
    const productGateway: ProductGateway = {
      fetchDetail: jest.fn().mockRejectedValueOnce(new Error('Network error')),
    };

    const result = await enrichTileWithDetail(tile, '7952', productGateway);

    expect(result).toMatchObject({
      productId: tile.productId,
      sku: tile.sku,
      name: tile.name,
      brand: tile.brand,
      price: tile.price,
    });
    expect(result.availableAtStore).toBeUndefined();
    expect(result.nutritionFacts).toBeUndefined();
  });
});
