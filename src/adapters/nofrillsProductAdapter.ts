import { ProductGateway } from '../ports/ProductGateway';
import { Product, NutritionFacts, MicroNutrient, NutrientValue } from '../domain/product';
import { httpGet } from '../infrastructure/httpClient';

const PC_API_BASE = 'https://api.pcexpress.ca/pcx-bff/api/v1/products';
// Public key embedded in the No Frills frontend JS; overridable if it rotates
const PC_API_KEY = process.env.NOFRILLS_API_KEY ?? 'C1xujSegT5j3ap3yexJjqhOfELwGKYvz';
const PC_API_HEADERS = {
  'x-apikey': PC_API_KEY,
  'x-application-type': 'web',
  'x-channel': 'web',
};

interface RawNutrient {
  code: string;
  valueInGram?: string;
  valuePercent?: string;
  subNutrients?: RawNutrient[];
}

interface RawNutritionFacts {
  topNutrition?: RawNutrient[];
  calories?: RawNutrient;
  totalFat?: RawNutrient;
  totalCarbohydrate?: RawNutrient;
  protein?: RawNutrient;
  sodium?: RawNutrient;
  potassium?: RawNutrient;
  microNutrition?: RawNutrient[];
}

interface RawOffer {
  stockStatus: string;
  price?: { value: number; unit: string };
  offerType: string;
}

interface RawProduct {
  code: string;
  name: string;
  brand?: string;
  articleNumber?: string;
  description?: string;
  ingredients?: string;
  offers?: RawOffer[];
  nutritionFacts?: RawNutritionFacts[];
}

const formatDate = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}${mm}${yyyy}`;
};

const buildProductUrl = (productId: string, storeId: string) => {
  const date = formatDate(new Date());
  return `${PC_API_BASE}/${productId}?lang=en&date=${date}&pickupType=STORE&storeId=${storeId}&banner=nofrills`;
};

const mapNutrientValue = (raw: RawNutrient): NutrientValue => ({
  amount: raw.valueInGram ?? '',
  ...(raw.valuePercent ? { dailyValue: raw.valuePercent } : {}),
});

const findSubNutrient = (raw: RawNutrient, code: string): NutrientValue | undefined => {
  const sub = raw.subNutrients?.find((s) => s.code === code);
  return sub ? mapNutrientValue(sub) : undefined;
};

const extractServingSize = (topNutrition?: RawNutrient[]): string | undefined =>
  topNutrition?.find((n) => n.code === 'servingSizeEN')?.valueInGram;

const mapMicroNutrients = (microNutrition?: RawNutrient[]): MicroNutrient[] =>
  (microNutrition ?? []).map((n) => ({
    name: n.code,
    amount: n.valueInGram ?? '',
    ...(n.valuePercent ? { dailyValue: n.valuePercent } : {}),
  }));

const mapNutritionFacts = (rawFacts?: RawNutritionFacts[]): NutritionFacts | undefined => {
  const facts = rawFacts?.[0];
  if (!facts) return undefined;

  return {
    servingSize: extractServingSize(facts.topNutrition),
    calories: facts.calories?.valueInGram,
    totalFat: facts.totalFat ? mapNutrientValue(facts.totalFat) : undefined,
    saturatedFat: facts.totalFat ? findSubNutrient(facts.totalFat, 'saturatedFat') : undefined,
    transFat: facts.totalFat ? findSubNutrient(facts.totalFat, 'transFat') : undefined,
    totalCarbohydrate: facts.totalCarbohydrate
      ? mapNutrientValue(facts.totalCarbohydrate)
      : undefined,
    sugar: facts.totalCarbohydrate ? findSubNutrient(facts.totalCarbohydrate, 'sugar') : undefined,
    protein: facts.protein ? mapNutrientValue(facts.protein) : undefined,
    sodium: facts.sodium ? mapNutrientValue(facts.sodium) : undefined,
    potassium: facts.potassium ? mapNutrientValue(facts.potassium) : undefined,
    microNutrients: mapMicroNutrients(facts.microNutrition),
  };
};

const resolveAvailability = (offers?: RawOffer[]): boolean => {
  const ogOffer = offers?.find((o) => o.offerType === 'OG');
  return ogOffer?.stockStatus === 'OK';
};

const resolvePrice = (offers?: RawOffer[]): number | undefined => {
  const ogOffer = offers?.find((o) => o.offerType === 'OG');
  return ogOffer?.price?.value;
};

const mapProduct = (raw: RawProduct): Product => ({
  productId: raw.code,
  sku: raw.articleNumber ?? raw.code.split('_')[0],
  name: raw.name,
  brand: raw.brand,
  description: raw.description,
  price: resolvePrice(raw.offers),
  availableAtStore: resolveAvailability(raw.offers),
  ingredients: raw.ingredients,
  nutritionFacts: mapNutritionFacts(raw.nutritionFacts),
});

export const createNofrillsProductAdapter = (): ProductGateway => ({
  fetchDetail: async (productId: string, storeId: string): Promise<Product> => {
    const url = buildProductUrl(productId, storeId);
    const response = await httpGet(url, PC_API_HEADERS);

    if (!response.ok)
      throw new Error(`Product detail fetch failed: ${response.status} for ${productId}`);

    const raw = (await response.json()) as RawProduct;
    return mapProduct(raw);
  },
});
