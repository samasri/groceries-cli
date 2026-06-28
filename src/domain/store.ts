import { Chain } from './chain';

export interface Store {
  chain: Chain;
  id: string;
  name: string;
  address: string;
}
