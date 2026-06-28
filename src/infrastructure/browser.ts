import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium } from 'playwright-extra';
import { timed } from './timing';

const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const DEFAULT_VIEWPORT = { width: 1366, height: 900 };
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const isHeadless = (): boolean => process.env.HEADLESS !== 'false';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let launchPromise: Promise<Browser> | null = null;

const launch = async (chromiumPath?: string): Promise<Browser> => {
  try {
    return (await chromium.launch({
      executablePath: chromiumPath,
      headless: isHeadless(),
    })) as Browser;
  } catch {
    return (await chromium.launch({ headless: isHeadless() })) as Browser;
  }
};

export const getBrowser = async (chromiumPath?: string): Promise<Browser> => {
  if (browser) return browser;
  if (!launchPromise) launchPromise = timed('browser.launch', () => launch(chromiumPath));
  browser = await launchPromise;
  return browser;
};

const getContext = async (chromiumPath?: string): Promise<BrowserContext> => {
  if (context) return context;
  const b = await getBrowser(chromiumPath);
  context = await timed('browser.newContext', () =>
    b.newContext({
      viewport: DEFAULT_VIEWPORT,
      userAgent: DEFAULT_USER_AGENT,
      locale: 'en-CA',
    }),
  );
  return context;
};

export const withPage = async <T>(
  fn: (page: Page) => Promise<T>,
  chromiumPath?: string,
): Promise<T> => {
  const ctx = await getContext(chromiumPath);
  const page = await timed('context.newPage', () => ctx.newPage());
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
  }
};

export const closeBrowser = async (): Promise<void> => {
  const current = browser;
  browser = null;
  context = null;
  launchPromise = null;
  if (current) await current.close().catch(() => undefined);
};

process.on('exit', () => {
  if (browser) browser.close().catch(() => undefined);
});
