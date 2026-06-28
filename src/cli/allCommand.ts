import { Command } from 'commander';
import { loadConfig } from '../config/loadConfig';
import { createNofrillsConnector } from '../adapters/nofrills/nofrillsConnector';
import { createMetroConnector } from '../adapters/metro';
import { closeBrowser } from '../infrastructure/browser';
import { searchMarketplace } from '../useCases/searchMarketplace';
import {
  RawSearchOptions,
  addSearchOptions,
  parseSearchOptions,
  formatOutput,
} from './commonOptions';

interface AllSearchOptions extends RawSearchOptions {
  nofrillsStore?: string;
  metroStore?: string;
}

const runSearch = async (query: string, options: AllSearchOptions) => {
  const config = loadConfig({
    nofrillsStoreId: options.nofrillsStore,
    metroStoreId: options.metroStore,
  });

  const connectors = [
    createNofrillsConnector({ storeId: config.nofrills.storeId }),
    createMetroConnector({
      storeId: config.metro.storeId,
      chromiumPath: config.chromiumPath,
    }),
  ];

  const result = await searchMarketplace(query, parseSearchOptions(options), connectors);

  process.stdout.write(formatOutput(result, options.pretty) + '\n');

  if (result.results.length === 0) process.exit(1);
};

export const registerAllCommand = (program: Command): void => {
  const all = program.command('all').description('Search every configured chain');

  const search = all
    .command('search <query>')
    .description('Search every configured chain and merge results')
    .option('--nofrills-store <id>', 'Override NOFRILLS_STORE_ID from .env')
    .option('--metro-store <id>', 'Override METRO_STORE_ID from .env');

  addSearchOptions(search).action(async (query: string, options: AllSearchOptions) => {
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
