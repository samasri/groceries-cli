<!-- markdownlint-disable MD013 MD033 -->

# Groceries CLI

CLI tool to search Canadian grocery chains — **No Frills** and **Metro** — and check product availability at a specific branch. Outputs structured JSON, designed for agent use.

## Setup/Usage

```sh
yarn install
yarn build

# To use globally
npm link

grocery <chain> search <query> [options]
```

Before your first run, copy `.env.example` to `.env` and set the store IDs for the branches you care about:

```sh
cp .env.example .env
# edit NOFRILLS_STORE_ID and METRO_STORE_ID
```

### Examples

```sh
grocery nofrills search milk --pretty # Search only No Frills
grocery metro search milk --pretty # Search only Metro
grocery all search "orange juice" --available-only --pretty # Search both chains and merge results into one list
grocery nofrills search bread --nofrills-store 1031 --pretty # Override the store ID for a single run
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--available-only` | false | Only return products in stock at the store |
| `--limit <n>` | 20 | Max results to return |
| `--page <n>` | 1 | Page number (1-indexed) |
| `--concurrency <n>` | 1 | Max parallel product-detail fetches |
| `--pretty` | false | Pretty-print JSON output |
| `--nofrills-store <id>` | from `.env` | Override No Frills branch for this run |
| `--metro-store <id>` | from `.env` | Override Metro branch for this run |

## Output

Single-chain commands (`nofrills search`, `metro search`) return a flat result for that chain.

No Frills returns the most complete record: ingredients, full nutrition facts, and live stock availability.

<details>
<summary>Example: <code>grocery nofrills search milk --limit 1 --pretty</code></summary>

```json
{
  "query": "milk",
  "store": {
    "chain": "nofrills",
    "id": "7952",
    "name": "No Frills #7952",
    "address": ""
  },
  "totalResults": 218,
  "results": [
    {
      "chain": "nofrills",
      "source": "main",
      "productId": "20264273_EA",
      "sku": "20264273",
      "name": "Almond Breeze, Unsweetened Vanilla",
      "brand": "Blue Diamond",
      "description": "Lactose Free",
      "price": 3,
      "availableAtStore": true,
      "ingredients": "Water, Almonds, Natural Vanilla Flavour, Sea Salt, Potassium Citrate, Sunflower Lecithin, Gellan Gum. Contains: Almonds.",
      "nutritionFacts": {
        "servingSize": "250 ml",
        "calories": "30 cal",
        "totalFat": { "amount": "2.5 g", "dailyValue": "4 %" },
        "saturatedFat": { "amount": "0.2 g" },
        "transFat": { "amount": "0.0 g", "dailyValue": "4 %" },
        "totalCarbohydrate": { "amount": "1 g", "dailyValue": "1 %" },
        "sugar": { "amount": "0 g" },
        "protein": { "amount": "1 g" },
        "sodium": { "amount": "180 mg", "dailyValue": "8 %" },
        "potassium": { "amount": "175 mg", "dailyValue": "5 %" },
        "microNutrients": [
          { "name": "calcium", "amount": "", "dailyValue": "0 %" },
          { "name": "iron",    "amount": "", "dailyValue": "2 %" },
          { "name": "vitaminE","amount": "", "dailyValue": "10 %" }
        ]
      }
    }
  ]
}
```

</details>

Metro returns a thinner record. Nutrition facts and live stock availability are **not** scraped today (Metro's PDP layout varies per category and isn't yet wired up), so `nutritionFacts` and `availableAtStore` are omitted. Expect name, brand, package size, price, and ingredients when available.

<details>
<summary>Example: <code>grocery metro search milk --limit 1 --pretty</code></summary>

```json
{
  "query": "milk",
  "store": {
    "chain": "metro",
    "id": "218",
    "name": "Metro #218",
    "address": ""
  },
  "totalResults": 769,
  "results": [
    {
      "chain": "metro",
      "source": "main",
      "productId": "068200465708",
      "sku": "068200465708",
      "name": "2% Lactose-Free Milk, UltraPūr",
      "brand": "Lactantia",
      "packageSize": "1.5 L",
      "price": 6.19,
      "ingredients": "Ultrafiltered skim milk, Partly skimmed milk, Vitamin A palmitate, Vitamin D₃, Lactase (enzyme). Contains: Milk"
    }
  ]
}
```

</details>

`all search` returns one merged list with each result tagged by `chain`, plus a per-chain status block so a failure on one chain doesn't lose results from the other.

<details>
<summary>Example output</summary>

```json
{
  "query": "milk",
  "totalResults": 411,
  "perChain": {
    "nofrills": { "ok": true, "totalResults": 252, "store": { "...": "..." } },
    "metro":    { "ok": true, "totalResults": 159, "store": { "...": "..." } }
  },
  "results": [
    { "chain": "nofrills", "name": "2% Milk", "...": "..." },
    { "chain": "metro",    "name": "2% Milk", "...": "..." }
  ]
}
```

</details>

## Configuration

Set in `.env` (see `.env.example`):

| Variable | Required | Description |
| --- | --- | --- |
| `NOFRILLS_STORE_ID` | yes | No Frills branch ID |
| `METRO_STORE_ID` | yes | Metro branch ID |
| `NOFRILLS_API_KEY` | no | Override the default PC Express API key if it rotates |
| `CHROMIUM_PATH` | no | Absolute path to a chromium binary. When unset, playwright's bundled chromium is used |
| `HEADLESS` | no | Set to `false` to launch chromium with a visible window (Metro debugging only). Default is headless |

## Exit Codes

- `0` --> Success
- `1` --> No results found
- `2` --> Error (bad config, upstream failure, etc.)
