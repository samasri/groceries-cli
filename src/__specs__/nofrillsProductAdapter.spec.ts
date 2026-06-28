import { createNofrillsProductAdapter } from '../adapters/nofrillsProductAdapter';
import * as httpClient from '../infrastructure/httpClient';

const makeRawProduct = (overrides: object = {}) => ({
  code: '20188873_EA',
  name: '2% Milk',
  brand: 'Neilson',
  articleNumber: '20188873',
  description: 'Fresh milk',
  ingredients: 'Partly Skimmed Milk, Vitamin A',
  offers: [{ stockStatus: 'OK', price: { value: 6.44, unit: 'ea' }, offerType: 'OG' }],
  nutritionFacts: [
    {
      topNutrition: [
        { code: 'servingSizeEN', valueInGram: '250 ml' },
        { code: 'houseHoldServingSize', valueInGram: '1.0 cup' },
      ],
      calories: { code: 'calories', valueInGram: '130 cal' },
      totalFat: {
        code: 'totalFat',
        valueInGram: '5 g',
        valuePercent: '7 %',
        subNutrients: [
          { code: 'saturatedFat', valueInGram: '3.0 g' },
          { code: 'transFat', valueInGram: '0.1 g' },
        ],
      },
      totalCarbohydrate: {
        code: 'totalCarbohydrate',
        valueInGram: '13 g',
        valuePercent: '5 %',
        subNutrients: [{ code: 'sugar', valueInGram: '12 g' }],
      },
      protein: { code: 'protein', valueInGram: '9 g' },
      sodium: { code: 'sodium', valueInGram: '125 mg', valuePercent: '5 %' },
      microNutrition: [
        { code: 'vitaminA', valueInGram: '150.0 µg', valuePercent: '17 %' },
        { code: 'calcium', valueInGram: '350 mg', valuePercent: '27 %' },
      ],
    },
  ],
  ...overrides,
});

describe('nofrillsProductAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('fetchDetail', () => {
    it('maps a full product response correctly', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        json: async () => makeRawProduct(),
      } as Response);

      const adapter = createNofrillsProductAdapter();
      const product = await adapter.fetchDetail('20188873_EA', '7952');

      expect(product).toMatchObject({
        chain: 'nofrills',
        productId: '20188873_EA',
        sku: '20188873',
        name: '2% Milk',
        brand: 'Neilson',
        price: 6.44,
        availableAtStore: true,
        ingredients: 'Partly Skimmed Milk, Vitamin A',
      });
    });

    it('maps nutrition facts correctly', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        json: async () => makeRawProduct(),
      } as Response);

      const adapter = createNofrillsProductAdapter();
      const { nutritionFacts } = await adapter.fetchDetail('20188873_EA', '7952');

      expect(nutritionFacts).toMatchObject({
        servingSize: '250 ml',
        calories: '130 cal',
        totalFat: { amount: '5 g', dailyValue: '7 %' },
        saturatedFat: { amount: '3.0 g' },
        transFat: { amount: '0.1 g' },
        totalCarbohydrate: { amount: '13 g', dailyValue: '5 %' },
        sugar: { amount: '12 g' },
        protein: { amount: '9 g' },
        sodium: { amount: '125 mg', dailyValue: '5 %' },
      });
    });

    it('maps micro nutrients correctly', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        json: async () => makeRawProduct(),
      } as Response);

      const adapter = createNofrillsProductAdapter();
      const { nutritionFacts } = await adapter.fetchDetail('20188873_EA', '7952');

      expect(nutritionFacts?.microNutrients).toEqual([
        { name: 'vitaminA', amount: '150.0 µg', dailyValue: '17 %' },
        { name: 'calcium', amount: '350 mg', dailyValue: '27 %' },
      ]);
    });

    it('maps availableAtStore as false when stockStatus is OUT', async () => {
      const raw = makeRawProduct({
        offers: [{ stockStatus: 'OUT', price: { value: 6.44, unit: 'ea' }, offerType: 'OG' }],
      });
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        json: async () => raw,
      } as Response);

      const adapter = createNofrillsProductAdapter();
      const product = await adapter.fetchDetail('20188873_EA', '7952');

      expect(product.availableAtStore).toBe(false);
    });

    it('includes the store ID and correct date format in the request URL', async () => {
      const httpSpy = jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: true,
        json: async () => makeRawProduct(),
      } as Response);

      const adapter = createNofrillsProductAdapter();
      await adapter.fetchDetail('20188873_EA', '7952');

      const [url] = httpSpy.mock.calls[0];
      expect(url).toContain('storeId=7952');
      expect(url).toMatch(/date=\d{8}/);
      expect(url).toContain('banner=nofrills');
    });

    it('throws when the API returns an error status', async () => {
      jest.spyOn(httpClient, 'httpGet').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const adapter = createNofrillsProductAdapter();
      await expect(adapter.fetchDetail('badId', '7952')).rejects.toThrow(
        'Product detail fetch failed: 404',
      );
    });
  });
});
