import { Command } from 'commander';
import { SearchOptions } from '../useCases/searchProducts';

export interface RawSearchOptions {
  availableOnly?: boolean;
  limit: string;
  page: string;
  concurrency: string;
  pretty?: boolean;
}

export const addSearchOptions = (cmd: Command): Command =>
  cmd
    .option('--available-only', 'Only return products in stock at the store')
    .option('--limit <n>', 'Max results to return', '20')
    .option('--page <n>', 'Page number (1-indexed)', '1')
    .option('--concurrency <n>', 'Max parallel product-detail fetches', '1')
    .option('--pretty', 'Pretty-print JSON output');

export const parseSearchOptions = (opts: RawSearchOptions): SearchOptions => ({
  limit: parseInt(opts.limit, 10),
  page: parseInt(opts.page, 10),
  concurrency: parseInt(opts.concurrency, 10),
  availableOnly: Boolean(opts.availableOnly),
});

export const formatOutput = (value: unknown, pretty?: boolean): string =>
  pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
