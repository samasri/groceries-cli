import { Chain } from '../domain/chain';
import { Store } from '../domain/store';

const DISPLAY_NAME: Record<Chain, string> = {
  nofrills: 'No Frills',
  metro: 'Metro',
};

export const buildStore = (chain: Chain, id: string): Store => ({
  chain,
  id,
  name: `${DISPLAY_NAME[chain]} #${id}`,
  address: '',
});
