#!/usr/bin/env node

import { Command } from 'commander';
import { BO_STORE } from './domain/store';
import { searchProducts } from './useCases/searchProducts';
import { createCachedBuildIdAdapter } from './adapters/cachedBuildIdAdapter';
import { createNofrillsSearchAdapter } from './adapters/nofrillsSearchAdapter';
import { createNofrillsProductAdapter } from './adapters/nofrillsProductAdapter';

const program = new Command();

program
  .name('nofrills')
  .description("Search No Frills products at Bo's NO FRILLS Toronto Richmond")
  .version('1.0.0');

program
  .command('search <query>')
  .description('Search for products')
  .option('--available-only', 'Only return products in stock at the store')
  .option('--limit <n>', 'Max results to return', '20')
  .option('--page <n>', 'Page number (1-indexed)', '1')
  .option('--concurrency <n>', 'Max parallel product-detail fetches', '1')
  .option('--pretty', 'Pretty-print JSON output')
  .action(async (query: string, options) => {
    const buildIdProvider = createCachedBuildIdAdapter();
    const searchGateway = createNofrillsSearchAdapter(buildIdProvider);
    const productGateway = createNofrillsProductAdapter();

    try {
      const result = await searchProducts(
        query,
        BO_STORE,
        {
          limit: parseInt(options.limit, 10),
          page: parseInt(options.page, 10),
          concurrency: parseInt(options.concurrency, 10),
          availableOnly: Boolean(options.availableOnly),
        },
        searchGateway,
        productGateway,
      );

      const output = options.pretty
        ? JSON.stringify(result, null, 2)
        : JSON.stringify(result);

      process.stdout.write(output + '\n');

      if (result.results.length === 0) process.exit(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(2);
    }
  });

program.parse(process.argv);
