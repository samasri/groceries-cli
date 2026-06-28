import { SearchGateway } from '../ports/SearchGateway';
import { BuildIdProvider } from '../ports/BuildIdProvider';
import { SearchPage, ProductTile, TileSource } from '../domain/product';
import { httpGet } from '../infrastructure/httpClient';
import { UpstreamAnomalyReporter, createUpstreamAnomalyReporter } from '../infrastructure/upstreamAnomaly';

const SEARCH_BASE = 'https://www.nofrills.ca/_next/data';
const GRID_COMPONENT_ID = 'productGridComponent';

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

interface TaggedGrid {
  source: TileSource;
  data: RawGridData;
}

const buildSearchUrl = (buildId: string, term: string, storeId: string, page: number) =>
  `${SEARCH_BASE}/${buildId}/en/search.json?search-bar=${encodeURIComponent(term)}&storeId=${storeId}&page=${page}`;

const sourceForGridIndex = (index: number): TileSource => (index === 0 ? 'main' : 'related');

const extractTaggedGrids = (raw: RawSearchResponse): TaggedGrid[] => {
  const components =
    raw?.pageProps?.initialSearchData?.layout?.sections?.mainContentCollection?.components ?? [];
  const grids = components.filter((c) => c.componentId === GRID_COMPONENT_ID);
  return grids.map((grid, index) => ({ source: sourceForGridIndex(index), data: grid.data }));
};

const mapTile = (raw: RawTile, source: TileSource): ProductTile => ({
  chain: 'nofrills',
  source,
  productId: raw.productId,
  sku: raw.articleNumber,
  name: raw.title,
  brand: raw.brand,
  description: raw.description,
  packageSize: raw.packageSizing?.split(',')[0]?.trim(),
  price: raw.pricing?.price ? parseFloat(raw.pricing.price) : undefined,
});

const dedupeByProductId = (tiles: ProductTile[]): ProductTile[] => {
  const seen = new Set<string>();
  return tiles.filter((tile) => {
    if (seen.has(tile.productId)) return false;
    seen.add(tile.productId);
    return true;
  });
};

const mergeGrids = (grids: TaggedGrid[]): SearchPage => {
  const [mainGrid] = grids;
  const allTiles = grids.flatMap((g) => g.data.productTiles.map((raw) => mapTile(raw, g.source)));
  return {
    pagination: mainGrid.data.pagination,
    productTiles: dedupeByProductId(allTiles),
  };
};

export interface NofrillsSearchAdapterConfig {
  anomalyReporter?: UpstreamAnomalyReporter;
}

export const createNofrillsSearchAdapter = (
  buildIdProvider: BuildIdProvider,
  config: NofrillsSearchAdapterConfig = {},
): SearchGateway => {
  const anomalyReporter = config.anomalyReporter ?? createUpstreamAnomalyReporter();

  return {
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
      const grids = extractTaggedGrids(raw);

      if (grids.length === 0) {
        await anomalyReporter.recordSearchAnomaly(
          {
            chain: 'nofrills',
            kind: 'missing-product-grid',
            url,
            httpStatus: response.status,
            query: term,
            storeId,
          },
          raw,
        );
        throw new Error('Could not extract product grid from search response');
      }

      return mergeGrids(grids);
    },
  };
};
