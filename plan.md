# No Frills CLI — Implementation Plan

## Overview

A TypeScript CLI tool to search No Frills products, returning name, SKU, description,
nutritional info, and availability at Bo's NO FRILLS Toronto Richmond (261 Richmond St W).
Optimized for agent use: structured JSON output, fast, respectful of the server.

---

## Discovered API Endpoints

All endpoints work without a browser via plain HTTP.

### 1. Get Build ID (required for search)

```
GET https://www.nofrills.ca/en
```

Parse HTML body with regex: `/"buildId":"([^"]+)"/`

The buildId is a Next.js deployment identifier (e.g. `GiRlC9T90MEDLi7ozJzpu`).
It changes on site deployment (typically daily). **Must be cached** with a short TTL
(recommended: 1 hour, re-fetched on 404/error).

---

### 2. Search Products

```
GET https://www.nofrills.ca/_next/data/{buildId}/en/search.json
  ?search-bar={term}
  &storeId={storeId}
  &page={pageNum}          ← 1-indexed, optional (default: 1)
```

No special headers required beyond `User-Agent`.

**Response shape** (relevant path):
`pageProps.initialSearchData.layout.sections.mainContentCollection
  .components[find componentId=="productGridComponent"].data`

```json
{
  "pagination": {
    "pageNumber": 1,
    "pageSize": 48,
    "totalResults": 252,
    "hasMore": false,   // unreliable — always false in testing
    "isLast": false
  },
  "productTiles": [
    {
      "productId": "20188873_EA",
      "articleNumber": "20188873",
      "title": "2% Milk",
      "brand": "Neilson",
      "description": "...",
      "link": "/en/2-milk/p/20188873_EA",
      "pricing": { "displayPrice": "$6.44", "price": "6.44" },
      "packageSizing": "4 l, $0.16/100ml",
      "inventoryIndicator": null   // always null in tiles; use product detail for stock
    }
  ]
}
```

Each page returns ~15 tiles regardless of `pageSize`. Continue paginating until
`productTiles.length < 15` or `page * 15 >= totalResults`.

---

### 3. Get Product Detail + Availability

```
GET https://api.pcexpress.ca/pcx-bff/api/v1/products/{productId}
  ?lang=en
  &date={DDMMYYYY}         ← today's date, e.g. "15032026"
  &pickupType=STORE
  &storeId={storeId}
  &banner=nofrills
```

**Required headers:**

```
x-apikey: C1xujSegT5j3ap3yexJjqhOfELwGKYvz
x-application-type: web
x-channel: web
```

**Response shape (key fields):**

```json
{
  "code": "20188873_EA",
  "name": "2% Milk",
  "brand": "Neilson",
  "articleNumber": "20188873",
  "description": "...",
  "ingredients": "Partly Skimmed Milk, Vitamin A Palmitate, ...",
  "offers": [{
    "stockStatus": "OK",    // "OK" = in stock, "OUT" = out of stock
    "price": { "value": 6.44, "unit": "ea" },
    "offerType": "OG"
  }],
  "nutritionFacts": [{
    "topNutrition": [
      { "code": "servingSizeEN", "valueInGram": "250 ml" },
      { "code": "houseHoldServingSize", "valueInGram": "1.0 cup" }
    ],
    "calories": { "code": "calories", "valueInGram": "130 cal" },
    "totalFat": {
      "code": "totalFat",
      "valueInGram": "5 g",
      "valuePercent": "7 %",
      "subNutrients": [
        { "code": "saturatedFat", "valueInGram": "3.0 g" },
        { "code": "transFat",     "valueInGram": "0.1 g" }
      ]
    },
    "totalCarbohydrate": { ... },
    "protein": { "code": "protein", "valueInGram": "9 g" },
    "sodium": { ... },
    "potassium": { ... },
    "microNutrition": [
      { "code": "vitaminA", "valueInGram": "150.0 µg", "valuePercent": "17 %" },
      { "code": "calcium",  "valueInGram": "350 mg",   "valuePercent": "27 %" },
      ...
    ]
  }]
}
```

---

### 4. Target Store

| Field     | Value                              |
|-----------|------------------------------------|
| Name      | Bo's NO FRILLS Toronto Richmond    |
| Store ID  | `7952`                             |
| Address   | 261 Richmond St W, Toronto, ON     |

---

## Architecture

Follows **Clean Architecture** (Uncle Bob), **DDD**, and **SRP**. Dependencies point
inward: the domain has no knowledge of HTTP, the filesystem, or the CLI framework.
Every function does one thing; complex operations are composed from smaller ones.

```
Outer layer (frameworks & drivers)
  cli.ts                 ← commander wiring only; no business logic
  infrastructure/
    httpClient.ts        ← raw fetch wrapper (one responsibility: HTTP)
    buildIdCache.ts      ← disk read/write for buildId (one responsibility: cache I/O)

Application layer (use cases)
  useCases/
    searchProducts.ts    ← orchestrates search + enrich; depends on domain + ports
    getProductDetail.ts  ← fetches & maps one product; depends on domain + ports

Domain layer (pure business logic, no I/O)
  domain/
    product.ts           ← Product entity + value objects (NutritionFacts, Offer, etc.)
    store.ts             ← Store entity (BO_STORE constant lives here)
  ports/
    SearchGateway.ts     ← interface: searchTiles(term, storeId, page) → TileResult
    ProductGateway.ts    ← interface: fetchDetail(productId, storeId) → RawProduct
    BuildIdProvider.ts   ← interface: getBuildId() → string

Adapters (implement ports, live outside domain)
  adapters/
    nofrillsSearchAdapter.ts   ← implements SearchGateway via _next/data
    nofrillsProductAdapter.ts  ← implements ProductGateway via pcexpress API
    cachedBuildIdAdapter.ts    ← implements BuildIdProvider with TTL cache
```

### Key principles applied

- **SRP**: each file has one reason to change. `httpClient.ts` changes only if fetch
  semantics change; `buildIdCache.ts` changes only if cache format changes.
- **DDD**: `Product` is the aggregate root. `NutritionFacts`, `Offer`, `Store` are
  value objects. Mappers at the adapter boundary translate raw API responses into
  domain objects.
- **Small functions**: mappers are decomposed (`mapNutritionFacts`, `mapOffer`,
  `mapMicroNutrients`, etc.). No function exceeds ~20 lines.
- **Dependency inversion**: use cases depend on port interfaces, not concrete adapters.
  This makes unit testing trivial — inject a mock gateway.

---

## Project Structure

```
nofrills-cli/
├── src/
│   ├── cli.ts
│   ├── infrastructure/
│   │   ├── httpClient.ts
│   │   └── buildIdCache.ts
│   ├── useCases/
│   │   ├── searchProducts.ts
│   │   └── getProductDetail.ts
│   ├── domain/
│   │   ├── product.ts
│   │   └── store.ts
│   ├── ports/
│   │   ├── SearchGateway.ts
│   │   ├── ProductGateway.ts
│   │   └── BuildIdProvider.ts
│   └── adapters/
│       ├── nofrillsSearchAdapter.ts
│       ├── nofrillsProductAdapter.ts
│       └── cachedBuildIdAdapter.ts
├── src/__specs__/
│   ├── buildIdCache.spec.ts
│   ├── cachedBuildIdAdapter.spec.ts
│   ├── nofrillsSearchAdapter.spec.ts
│   ├── nofrillsProductAdapter.spec.ts
│   ├── searchProducts.spec.ts
│   └── getProductDetail.spec.ts
├── .cache/                   ← gitignored
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
└── yarn.lock
```

---

## Technology Stack

| Purpose          | Package                              |
|------------------|--------------------------------------|
| Runtime          | Node.js (v18+)                        |
| Language         | TypeScript                           |
| HTTP client      | `node-fetch` or native `fetch` (v18+) |
| CLI framework    | `commander`                          |
| Linter           | `eslint` + `@typescript-eslint`      |
| Formatter        | `prettier`                           |
| Test framework   | `jest` + `ts-jest`                   |
| Package manager  | `yarn`                               |
| Build            | `tsc` (via `ts-node` for dev)        |

---

## CLI Interface

### Search command

```bash
nofrills search <query> [options]

Options:
  --available-only   Only return products in stock at Bo's
  --limit <n>        Max results to return (default: 20)
  --page <n>         Page number (default: 1)
  --concurrency <n>  Max parallel product-detail fetches (default: 1)
  --json             Output as JSON (default: true for agent use)
  --pretty           Pretty-print JSON
```

### Output (JSON)

```json
{
  "query": "milk",
  "store": {
    "id": "7952",
    "name": "Bo's NO FRILLS Toronto Richmond",
    "address": "261 Richmond St W, Toronto, ON"
  },
  "totalResults": 252,
  "results": [
    {
      "productId": "20188873_EA",
      "sku": "20188873",
      "name": "2% Milk",
      "brand": "Neilson",
      "description": "Fresh, wholesome milk…",
      "packageSize": "4 l",
      "price": 6.44,
      "availableAtStore": false,
      "ingredients": "Partly Skimmed Milk, ...",
      "nutritionFacts": {
        "servingSize": "250 ml",
        "calories": "130 cal",
        "totalFat": { "amount": "5 g", "dailyValue": "7 %" },
        "saturatedFat": { "amount": "3.0 g" },
        "transFat": { "amount": "0.1 g" },
        "totalCarbohydrate": { "amount": "...", "dailyValue": "..." },
        "sugar": { "amount": "12 g" },
        "protein": { "amount": "9 g" },
        "sodium": { "amount": "...", "dailyValue": "..." },
        "microNutrients": [
          { "name": "vitaminA", "amount": "150.0 µg", "dailyValue": "17 %" },
          { "name": "calcium",  "amount": "350 mg",   "dailyValue": "27 %" }
        ]
      }
    }
  ]
}
```

---

## Implementation Details

### buildId caching

- Cache on disk (`./.cache/buildId.json`, relative to cwd)
- TTL: 1 hour
- Auto-refresh on 404 response from `_next/data`

### Rate limiting / server etiquette

- Concurrent product-detail fetches: configurable via `--concurrency <n>`, default 1
- Retry with exponential backoff on 5xx errors (max 3 attempts)
- Default `--limit 20` to avoid paginating through all 250+ results
- 300ms minimum delay between search pages if paginating

### Error handling

- Graceful degradation: if product detail fails, return tile data without
  nutrition/availability rather than failing the whole search
- Exit codes: 0 = success, 1 = no results, 2 = API error

---

## Implementation Steps

1. **Project scaffold**
   - `yarn init`, configure `tsconfig.json`, `eslint`, `prettier`, `jest` + `ts-jest`

2. **Domain layer** (`src/domain/`)
   - `store.ts`: `Store` value object, `BO_STORE` constant
   - `product.ts`: `Product` entity, `NutritionFacts`, `Offer`, `NutrientValue` value objects

3. **Port interfaces** (`src/ports/`)
   - `BuildIdProvider.ts`, `SearchGateway.ts`, `ProductGateway.ts`

4. **Infrastructure** (`src/infrastructure/`)
   - `httpClient.ts`: thin fetch wrapper with retry + backoff
   - `buildIdCache.ts`: read/write `./.cache/buildId.json` with TTL check

5. **Adapters** (`src/adapters/`)
   - `cachedBuildIdAdapter.ts`: implements `BuildIdProvider`; fetches homepage,
     parses buildId, delegates persistence to `buildIdCache`
   - `nofrillsSearchAdapter.ts`: implements `SearchGateway`; calls `_next/data`,
     maps raw tiles to domain tile shape via small mapper functions
   - `nofrillsProductAdapter.ts`: implements `ProductGateway`; calls pcexpress API,
     maps raw product via `mapNutritionFacts`, `mapOffer`, `mapMicroNutrients`, etc.

6. **Use cases** (`src/useCases/`)
   - `getProductDetail.ts`: resolve buildId → fetch tile → fetch detail → return `Product`
   - `searchProducts.ts`: resolve buildId → paginate tiles → enrich via concurrency
     pool → filter/limit → return `Product[]`

7. **CLI** (`src/cli.ts`)
   - Wire `commander` to `searchProducts` use case; format output as JSON

8. **Specs** (`src/__specs__/`)
   - Spy on `fetch` with `jest.spyOn(global, 'fetch')` — no `jest.mock`
   - One `describe` block per concern, small focused `it` blocks
   - Cover: buildId parsing, cache TTL expiry, tile extraction, nutrition mapping,
     availability mapping, concurrency limiting, `--available-only` filtering

---

## Notes for Agent Use

- JSON output by default (no `--json` flag needed)
- `--available-only` dramatically reduces noise for "can I buy X today" queries
- `sku` field is the article number (numeric), suitable for lookup
- `nutritionFacts` is normalized from the nested API structure into a flat,
  readable shape
- The CLI exits with code 1 when 0 results match, so agents can check exit code
