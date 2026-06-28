import { Product, ProductTile } from '../domain/product';
import { ProductGateway } from '../ports/ProductGateway';

const fallbackProduct = (tile: ProductTile): Product => ({
  chain: tile.chain,
  source: tile.source,
  productId: tile.productId,
  sku: tile.sku,
  name: tile.name,
  brand: tile.brand,
  description: tile.description,
  packageSize: tile.packageSize,
  price: tile.price,
});

const inheritSource = (product: Product, tile: ProductTile): Product => ({
  ...product,
  source: tile.source,
});

export const enrichTileWithDetail = async (
  tile: ProductTile,
  storeId: string,
  productGateway: ProductGateway,
): Promise<Product> => {
  try {
    const product = await productGateway.fetchDetail(tile.productId, storeId);
    return inheritSource(product, tile);
  } catch {
    return fallbackProduct(tile);
  }
};
