import { SearchPage } from '../domain/product';

export interface SearchGateway {
  searchTiles(term: string, storeId: string, page: number): Promise<SearchPage>;
}
