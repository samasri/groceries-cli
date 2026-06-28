#!/usr/bin/env node

import { Command } from 'commander';
import { registerNofrillsCommand } from './cli/nofrillsCommand';
import { registerMetroCommand } from './cli/metroCommand';
import { registerAllCommand } from './cli/allCommand';

const program = new Command();

program
  .name('grocery')
  .description('Search Canadian grocery chains (No Frills, Metro) for products')
  .version('2.0.0');

registerNofrillsCommand(program);
registerMetroCommand(program);
registerAllCommand(program);

program.parse(process.argv);
