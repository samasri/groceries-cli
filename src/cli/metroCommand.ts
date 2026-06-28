import { Command } from 'commander';
import { loadConfig } from '../config/loadConfig';
import { createMetroConnector } from '../adapters/metro';
import { closeBrowser } from '../infrastructure/browser';
import { searchProducts } from '../useCases/searchProducts';
import {
  RawSearchOptions,
  addSearchOptions,
  parseSearchOptions,
  formatOutput,
} from './commonOptions';

interface MetroSearchOptions extends RawSearchOptions {
  metroStore?: string;
}

const runSearch = async (query: string, options: MetroSearchOptions) => {
  const config = loadConfig({ metroStoreId: options.metroStore });
  const connector = createMetroConnector({
    storeId: config.metro.storeId,
    chromiumPath: config.chromiumPath,
  });

  const result = await searchProducts(
    query,
    connector.store,
    parseSearchOptions(options),
    connector.search,
    connector.products,
  );

  process.stdout.write(formatOutput(result, options.pretty) + '\n');

  if (result.results.length === 0) process.exit(1);
};

export const registerMetroCommand = (program: Command): void => {
  const metro = program.command('metro').description('Search Metro only');

  const search = metro
    .command('search <query>')
    .description('Search for products at the configured Metro store')
    .option('--metro-store <id>', 'Override METRO_STORE_ID from .env');

  addSearchOptions(search).action(async (query: string, options: MetroSearchOptions) => {
    try {
      await runSearch(query, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(2);
    } finally {
      await closeBrowser();
    }
  });
};
