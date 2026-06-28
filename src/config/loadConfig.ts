import dotenv from 'dotenv';

export interface AppConfig {
  nofrills: { storeId: string };
  metro: { storeId: string };
  chromiumPath?: string;
}

export interface ConfigOverrides {
  nofrillsStoreId?: string;
  metroStoreId?: string;
  chromiumPath?: string;
}

let envLoaded = false;

const loadEnvOnce = () => {
  if (envLoaded) return;
  dotenv.config({ quiet: true });
  envLoaded = true;
};

const requireValue = (cliValue: string | undefined, envKey: string): string => {
  const value = cliValue ?? process.env[envKey];
  if (!value) throw new Error(`Missing required configuration: ${envKey} (or CLI override)`);
  return value;
};

export const loadConfig = (overrides: ConfigOverrides = {}): AppConfig => {
  loadEnvOnce();
  return {
    nofrills: { storeId: requireValue(overrides.nofrillsStoreId, 'NOFRILLS_STORE_ID') },
    metro: { storeId: requireValue(overrides.metroStoreId, 'METRO_STORE_ID') },
    chromiumPath: overrides.chromiumPath ?? process.env.CHROMIUM_PATH,
  };
};
