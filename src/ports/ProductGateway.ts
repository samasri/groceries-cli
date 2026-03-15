import { Product } from '../domain/product';

export interface ProductGateway {
  fetchDetail(productId: string, storeId: string): Promise<Product>;
}
