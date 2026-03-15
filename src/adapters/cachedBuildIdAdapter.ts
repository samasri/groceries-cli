import { BuildIdProvider } from '../ports/BuildIdProvider';
import {
  readCachedBuildId,
  writeCachedBuildId,
  clearCachedBuildId,
} from '../infrastructure/buildIdCache';
import { httpGet } from '../infrastructure/httpClient';

const NOFRILLS_HOME = 'https://www.nofrills.ca/en';
const BUILD_ID_REGEX = /"buildId":"([^"]+)"/;

const parseBuildId = (html: string): string => {
  const match = html.match(BUILD_ID_REGEX);
  if (!match) throw new Error('Could not parse buildId from nofrills.ca homepage');
  return match[1];
};

const fetchFreshBuildId = async (): Promise<string> => {
  const response = await httpGet(NOFRILLS_HOME);
  if (!response.ok) throw new Error(`Failed to fetch nofrills homepage: ${response.status}`);
  const html = await response.text();
  return parseBuildId(html);
};

export const createCachedBuildIdAdapter = (): BuildIdProvider => ({
  getBuildId: async () => {
    const cached = await readCachedBuildId();
    if (cached) return cached;

    const buildId = await fetchFreshBuildId();
    await writeCachedBuildId(buildId);
    return buildId;
  },

  invalidate: () => clearCachedBuildId(),
});
