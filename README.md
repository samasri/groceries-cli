# No Frills CLI

CLI tool to search No Frills products and check availability at **Bo's NO FRILLS Toronto Richmond** (261 Richmond St W). Outputs structured JSON — designed for agent use.

## Setup/Usage

```sh
yarn install
yarn build

# To use globally
npm link

nofrills search <query> [options]
```

### Examples

```sh
# Search for milk
nofrills search milk --pretty

# Only show items currently in stock at the configured branch
nofrills search "orange juice" --available-only --pretty

# Increase fetch concurrency for faster results
nofrills search bread --limit 10 --concurrency 3 --pretty
```

### Options

| Option | Default | Description |
| --- | --- | --- |
| `--available-only` | false | Only return products in stock at the store |
| `--limit <n>` | 20 | Max results to return |
| `--page <n>` | 1 | Page number (1-indexed) |
| `--concurrency <n>` | 1 | Max parallel product-detail fetches |
| `--pretty` | false | Pretty-print JSON output |

## Output

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
      "description": "Fresh, wholesome milk",
      "packageSize": "4 l",
      "price": 6.44,
      "availableAtStore": true,
      "ingredients": "Partly Skimmed Milk, Vitamin A Palmitate, ...",
      "nutritionFacts": {
        "servingSize": "250 ml",
        "calories": "130 cal",
        "totalFat": { "amount": "5 g", "dailyValue": "7 %" },
        "saturatedFat": { "amount": "3.0 g" },
        "transFat": { "amount": "0.1 g" },
        "totalCarbohydrate": { "amount": "13 g", "dailyValue": "5 %" },
        "sugar": { "amount": "12 g" },
        "protein": { "amount": "9 g" },
        "sodium": { "amount": "115 mg", "dailyValue": "5 %" },
        "microNutrients": [
          { "name": "calcium", "amount": "350 mg", "dailyValue": "27 %" }
        ]
      }
    }
  ]
}
```

## Configuration

`NOFRILLS_API_KEY` can be configured as an environment variable to override the default PC Express API key

## Exit Codes

- `0` --> Success
- `1` --> No results found
- `2` --> API error
