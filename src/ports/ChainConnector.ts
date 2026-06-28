import { Chain } from '../domain/chain';
import { Store } from '../domain/store';
import { SearchGateway } from './SearchGateway';
import { ProductGateway } from './ProductGateway';

export interface ChainConnector {
  readonly chain: Chain;
  readonly store: Store;
  readonly search: SearchGateway;
  readonly products: ProductGateway;
}
