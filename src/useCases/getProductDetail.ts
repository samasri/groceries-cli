import { Product, ProductTile } from '../domain/product';
import { ProductGateway } from '../ports/ProductGateway';

export const enrichTileWithDetail = async (
  tile: ProductTile,
  storeId: string,
  productGateway: ProductGateway,
): Promise<Product> => {
  try {
    return await productGateway.fetchDetail(tile.productId, storeId);
  } catch {
    // graceful degradation: return tile data without enrichment
    return {
      productId: tile.productId,
      sku: tile.sku,
      name: tile.name,
      brand: tile.brand,
      description: tile.description,
      packageSize: tile.packageSize,
      price: tile.price,
    };
  }
};
