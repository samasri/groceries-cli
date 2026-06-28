import { Command } from 'commander';
import { loadConfig } from '../config/loadConfig';
import { createNofrillsConnector } from '../adapters/nofrills/nofrillsConnector';
import { searchProducts } from '../useCases/searchProducts';
import {
  RawSearchOptions,
  addSearchOptions,
  parseSearchOptions,
  formatOutput,
} from './commonOptions';

interface NofrillsSearchOptions extends RawSearchOptions {
  nofrillsStore?: string;
}

const runSearch = async (query: string, options: NofrillsSearchOptions) => {
  const config = loadConfig({ nofrillsStoreId: options.nofrillsStore });
  const connector = createNofrillsConnector({ storeId: config.nofrills.storeId });

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

export const registerNofrillsCommand = (program: Command): void => {
  const nofrills = program.command('nofrills').description('Search No Frills only');

  const search = nofrills
    .command('search <query>')
    .description('Search for products at the configured No Frills store')
    .option('--nofrills-store <id>', 'Override NOFRILLS_STORE_ID from .env');

  addSearchOptions(search).action(async (query: string, options: NofrillsSearchOptions) => {
    try {
      await runSearch(query, options);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(2);
    }
  });
};
