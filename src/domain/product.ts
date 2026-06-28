import { Chain } from './chain';

export type TileSource = 'main' | 'related';

export interface NutrientValue {
  amount: string;
  dailyValue?: string;
}

export interface MicroNutrient {
  name: string;
  amount: string;
  dailyValue?: string;
}

export interface NutritionFacts {
  servingSize?: string;
  calories?: string;
  totalFat?: NutrientValue;
  saturatedFat?: NutrientValue;
  transFat?: NutrientValue;
  totalCarbohydrate?: NutrientValue;
  sugar?: NutrientValue;
  protein?: NutrientValue;
  sodium?: NutrientValue;
  potassium?: NutrientValue;
  microNutrients?: MicroNutrient[];
}

export interface Offer {
  stockStatus: string;
  price: number;
  unit: string;
  offerType: string;
}

export interface Product {
  chain: Chain;
  source: TileSource;
  productId: string;
  sku: string;
  name: string;
  brand?: string;
  description?: string;
  packageSize?: string;
  price?: number;
  availableAtStore?: boolean;
  ingredients?: string;
  nutritionFacts?: NutritionFacts;
}

export interface ProductTile {
  chain: Chain;
  source: TileSource;
  productId: string;
  sku: string;
  name: string;
  brand?: string;
  description?: string;
  packageSize?: string;
  price?: number;
  detailUrl?: string;
}

export interface SearchPage {
  pagination: {
    pageNumber: number;
    pageSize: number;
    totalResults: number;
    hasMore: boolean;
    isLast: boolean;
  };
  productTiles: ProductTile[];
}
