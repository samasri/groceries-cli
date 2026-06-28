import { Chain } from '../domain/chain';
import { Product } from '../domain/product';
import { Store } from '../domain/store';
import { ChainConnector } from '../ports/ChainConnector';
import { searchProducts, SearchOptions, SearchResult } from './searchProducts';

export interface ChainOutcome {
  ok: boolean;
  error?: string;
  totalResults: number;
  store: Store;
}

export interface MarketplaceSearchResult {
  query: string;
  totalResults: number;
  perChain: Partial<Record<Chain, ChainOutcome>>;
  results: Product[];
}

const successOutcome = (result: SearchResult): ChainOutcome => ({
  ok: true,
  totalResults: result.totalResults,
  store: result.store,
});

const failureOutcome = (store: Store, error: unknown): ChainOutcome => ({
  ok: false,
  error: error instanceof Error ? error.message : String(error),
  totalResults: 0,
  store,
});

const runConnector = async (
  query: string,
  options: SearchOptions,
  connector: ChainConnector,
): Promise<{ chain: Chain; outcome: ChainOutcome; results: Product[] }> => {
  try {
    const result = await searchProducts(
      query,
      connector.store,
      options,
      connector.search,
      connector.products,
    );
    return { chain: connector.chain, outcome: successOutcome(result), results: result.results };
  } catch (err) {
    return { chain: connector.chain, outcome: failureOutcome(connector.store, err), results: [] };
  }
};

export const searchMarketplace = async (
  query: string,
  options: SearchOptions,
  connectors: ChainConnector[],
): Promise<MarketplaceSearchResult> => {
  const settled = await Promise.all(connectors.map((c) => runConnector(query, options, c)));

  const perChain: Partial<Record<Chain, ChainOutcome>> = {};
  const results: Product[] = [];

  settled.forEach(({ chain, outcome, results: chainResults }) => {
    perChain[chain] = outcome;
    results.push(...chainResults);
  });

  const totalResults = settled.reduce((sum, { outcome }) => sum + outcome.totalResults, 0);

  return { query, totalResults, perChain, results };
};
