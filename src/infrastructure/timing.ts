const TRUTHY = new Set(['1', 'true', 'yes', 'on']);
const enabled = (): boolean => TRUTHY.has((process.env.METRO_DEBUG ?? '').toLowerCase());

export const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  if (!enabled()) return fn();
  const start = Date.now();
  try {
    return await fn();
  } finally {
    process.stderr.write(`[timing] ${label}: ${Date.now() - start}ms\n`);
  }
};

export const logTiming = (label: string, ms: number): void => {
  if (!enabled()) return;
  process.stderr.write(`[timing] ${label}: ${ms}ms\n`);
};
