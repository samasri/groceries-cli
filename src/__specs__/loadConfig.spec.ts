const FIXED_ENV_KEYS = ['NOFRILLS_STORE_ID', 'METRO_STORE_ID', 'CHROMIUM_PATH'];

const stashEnv = () => {
  const snapshot: Record<string, string | undefined> = {};
  FIXED_ENV_KEYS.forEach((k) => (snapshot[k] = process.env[k]));
  return snapshot;
};

const restoreEnv = (snapshot: Record<string, string | undefined>) => {
  FIXED_ENV_KEYS.forEach((k) => {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  });
};

const freshLoadConfig = () => {
  jest.resetModules();
  jest.doMock('dotenv', () => ({ config: () => ({ parsed: {} }) }));
  return require('../config/loadConfig').loadConfig;
};

describe('loadConfig', () => {
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = stashEnv();
    FIXED_ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  afterEach(() => restoreEnv(envSnapshot));

  it('reads store IDs from environment variables', () => {
    process.env.NOFRILLS_STORE_ID = '7952';
    process.env.METRO_STORE_ID = '218';

    const config = freshLoadConfig()();

    expect(config.nofrills.storeId).toBe('7952');
    expect(config.metro.storeId).toBe('218');
  });

  it('lets CLI overrides win over environment values', () => {
    process.env.NOFRILLS_STORE_ID = '7952';
    process.env.METRO_STORE_ID = '218';

    const config = freshLoadConfig()({ nofrillsStoreId: '1031', metroStoreId: '60' });

    expect(config.nofrills.storeId).toBe('1031');
    expect(config.metro.storeId).toBe('60');
  });

  it('throws a descriptive error when a required store ID is missing', () => {
    process.env.METRO_STORE_ID = '218';

    expect(() => freshLoadConfig()()).toThrow(/NOFRILLS_STORE_ID/);
  });

  it('exposes optional chromiumPath from env when set', () => {
    process.env.NOFRILLS_STORE_ID = '7952';
    process.env.METRO_STORE_ID = '218';
    process.env.CHROMIUM_PATH = '/path/to/chromium';

    const config = freshLoadConfig()();

    expect(config.chromiumPath).toBe('/path/to/chromium');
  });

  it('omits chromiumPath when neither env nor override is provided', () => {
    process.env.NOFRILLS_STORE_ID = '7952';
    process.env.METRO_STORE_ID = '218';

    const config = freshLoadConfig()();

    expect(config.chromiumPath).toBeUndefined();
  });
});
