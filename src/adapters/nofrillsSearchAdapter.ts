import { SearchGateway } from '../ports/SearchGateway';
import { BuildIdProvider } from '../ports/BuildIdProvider';
import { SearchPage, ProductTile } from '../domain/product';
import { httpGet } from '../infrastructure/httpClient';

const SEARCH_BASE = 'https://www.nofrills.ca/_next/data';

interface RawTile {
  productId: string;
  articleNumber: string;
  title: string;
  brand?: string;
  description?: string;
  packageSizing?: string;
  pricing?: { price?: string };
}

interface RawGridData {
  pagination: SearchPage['pagination'];
  productTiles: RawTile[];
}

interface RawComponent {
  componentId: string;
  data: RawGridData;
}

interface RawSearchResponse {
  pageProps?: {
    initialSearchData?: {
      layout?: {
        sections?: {
          mainContentCollection?: {
            components?: RawComponent[];
          };
        };
      };
    };
  };
}

const buildSearchUrl = (buildId: string, term: string, storeId: string, page: number) =>
  `${SEARCH_BASE}/${buildId}/en/search.json?search-bar=${encodeURIComponent(term)}&storeId=${storeId}&page=${page}`;

const extractGridData = (raw: RawSearchResponse): RawGridData | null => {
  const components =
    raw?.pageProps?.initialSearchData?.layout?.sections?.mainContentCollection?.components ?? [];
  const grid = components.find((c) => c.componentId === 'productGridComponent');
  return grid?.data ?? null;
};

const mapTile = (raw: RawTile): ProductTile => ({
  productId: raw.productId,
  sku: raw.articleNumber,
  name: raw.title,
  brand: raw.brand,
  description: raw.description,
  packageSize: raw.packageSizing?.split(',')[0]?.trim(),
  price: raw.pricing?.price ? parseFloat(raw.pricing.price) : undefined,
});

export const createNofrillsSearchAdapter = (buildIdProvider: BuildIdProvider): SearchGateway => ({
  searchTiles: async (term: string, storeId: string, page: number): Promise<SearchPage> => {
    const buildId = await buildIdProvider.getBuildId();
    const url = buildSearchUrl(buildId, term, storeId, page);
    const response = await httpGet(url);

    if (response.status === 404) {
      await buildIdProvider.invalidate();
      throw new Error('Search returned 404 — buildId invalidated, please retry');
    }

    if (!response.ok) throw new Error(`Search request failed: ${response.status}`);

    const raw = (await response.json()) as RawSearchResponse;
    const gridData = extractGridData(raw);

    if (!gridData) throw new Error('Could not extract product grid from search response');

    return {
      pagination: gridData.pagination,
      productTiles: gridData.productTiles.map(mapTile),
    };
  },
});
