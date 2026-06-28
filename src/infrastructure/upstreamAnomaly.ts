import { promises as fs } from 'fs';
import { join } from 'path';
import { Chain } from '../domain/chain';

const DUMP_DIR = join(process.cwd(), '.cache');

export interface AnomalyContext {
  chain: Chain;
  kind: string;
  url: string;
  httpStatus: number;
  query?: string;
  storeId?: string;
}

export interface UpstreamAnomalyReporter {
  recordSearchAnomaly: (context: AnomalyContext, rawResponse: unknown) => Promise<void>;
}

const isoTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const fingerprintLayout = (raw: unknown): string => {
  const root = raw as { pageProps?: { initialSearchData?: { layout?: { sections?: { mainContentCollection?: { components?: Array<{ componentId?: string }> } } } } } };
  if (!root?.pageProps) return 'missing:pageProps';
  if (!root.pageProps.initialSearchData) return 'missing:initialSearchData';
  const components = root.pageProps.initialSearchData.layout?.sections?.mainContentCollection?.components;
  if (!components) return 'missing:components';
  if (components.length === 0) return 'empty:components';
  return components.map((c) => c.componentId ?? '<unknown>').join(',');
};

const measureBytes = (raw: unknown): number => {
  try {
    return Buffer.byteLength(JSON.stringify(raw), 'utf-8');
  } catch {
    return -1;
  }
};

const writeDump = async (chain: Chain, kind: string, payload: object): Promise<string | null> => {
  try {
    await fs.mkdir(DUMP_DIR, { recursive: true });
    const path = join(DUMP_DIR, `anomaly-${chain}-${kind}-${isoTimestamp()}.json`);
    await fs.writeFile(path, JSON.stringify(payload, null, 2), 'utf-8');
    return path;
  } catch {
    return null;
  }
};

const emitStderr = (line: object) => process.stderr.write(`[anomaly] ${JSON.stringify(line)}\n`);

export const createUpstreamAnomalyReporter = (): UpstreamAnomalyReporter => ({
  recordSearchAnomaly: async (context, rawResponse) => {
    const fingerprint = fingerprintLayout(rawResponse);
    const responseBytes = measureBytes(rawResponse);
    const dumpPath = await writeDump(context.chain, context.kind, { context, rawResponse });

    emitStderr({
      ...context,
      responseBytes,
      layoutFingerprint: fingerprint,
      dumpPath,
      timestamp: new Date().toISOString(),
    });
  },
});
