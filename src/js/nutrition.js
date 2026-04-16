// ────────────────────────────────────────────────────────
//  Nutrition — перевод + запрос к Edamam API
// ────────────────────────────────────────────────────────

import { CONFIG } from './config.js';

// Русские единицы измерения → английские.
// Делается ДО перевода, потому что MyMemory их не знает.
const UNIT_MAP = [
  [/\bграмм(ов|а)?\b/gi, 'g'],
  [/\bгр\b/gi,           'g'],
  [/\bг\b/g,             'g'],   // одиночная «г» как единица
  [/\bмиллилитр(ов|а)?\b/gi, 'ml'],
  [/\bмл\b/gi,           'ml'],
  [/\bлитр(ов|а)?\b/gi,  'l'],
  [/\bл\b/g,             'l'],
  [/\bкг\b/gi,           'kg'],
  [/\bкилограмм(ов|а)?\b/gi, 'kg'],
  [/\bстакан(ов|а)?\b/gi,'cup'],
  [/\bложк(а|и|у|ек)\b/gi, 'tbsp'],
  [/\bчайн\w+ ложк\w+\b/gi, 'tsp'],
  [/\bштук(а|и|у|ек)?\b/gi, 'pieces'],
  [/\bшт\b/gi,           'pieces'],
  [/\bпорци(я|и|й)\b/gi, 'serving'],
  [/\bкусо?к?\w*\b/gi,   'piece'],
];

/**
 * Заменяет русские единицы измерения на английские аббревиатуры.
 * @param {string} text
 * @returns {string}
 */
function normalizeUnits(text) {
  let result = text;
  for (const [pattern, replacement] of UNIT_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Переводит текст на английский через MyMemory API (бесплатно).
 * @param {string} text
 * @returns {Promise<string>}
 */
async function translateToEnglish(text) {
  const url = new URL(CONFIG.TRANSLATE_URL);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', 'ru|en');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Ошибка перевода');

  const data = await res.json();
  const translated = data?.responseData?.translatedText;

  if (!translated || translated === text) return text;
  return translated;
}

/**
 * Переставляет слова в формат «КОЛИЧЕСТВО ЕД ПРОДУКТ» который Edamam понимает лучше.
 * «chicken 120 g» → «120 g chicken»
 * @param {string} text — уже на английском
 * @returns {string}
 */
function reorderForEdamam(text) {
  // Ищем паттерн: слово(а) ЧИСЛО единица — переставляем число+единицу в начало
  const match = text.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|ml|l|kg|cup|tbsp|tsp|pieces?|serving|piece)(.*)$/i);
  if (match) {
    const [, food, qty, unit, rest] = match;
    return `${qty}${unit} ${food}${rest}`.trim();
  }
  return text;
}

/**
 * Анализирует питательную ценность через Edamam API.
 * @param {string} russianText — то, что сказал пользователь
 * @returns {Promise<NutritionResult>}
 */
export async function analyzeFood(russianText) {
  // 1. Нормализуем единицы (г → g, мл → ml, ...)
  const normalized = normalizeUnits(russianText);

  // 2. Переводим на английский
  const translated = await translateToEnglish(normalized);

  // 3. Переставляем в формат «120g chicken» (Edamam лучше понимает)
  const englishText = reorderForEdamam(translated);

  // 4. Запрос к Edamam
  const url = new URL(CONFIG.EDAMAM_BASE_URL);
  url.searchParams.set('app_id',         CONFIG.EDAMAM_APP_ID);
  url.searchParams.set('app_key',        CONFIG.EDAMAM_APP_KEY);
  url.searchParams.set('nutrition-type', 'logging');
  url.searchParams.set('ingr',           englishText);

  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 401) throw new Error('Неверные API ключи. Проверьте .env файл');
    if (res.status === 422) throw new Error(
      `Edamam не смог разобрать «${englishText}».\n` +
      `Попробуйте сказать точнее: «куриная грудка 150 грамм»`
    );
    throw new Error(`Ошибка API: ${res.status}`);
  }

  const data = await res.json();

  // Edamam (бесплатный тир) кладёт данные в ingredients[0].parsed[0]
  // а не на верхний уровень (calories, totalWeight, totalNutrients)
  const parsed = data.ingredients?.[0]?.parsed?.[0];

  if (!parsed || parsed.status !== 'OK') {
    throw new Error(
      `Не удалось распознать «${russianText}».\n` +
      `Попробуйте: «куриная грудка 150 г» или «гречка 200 г»`
    );
  }

  const nut = parsed.nutrients;
  const get    = (key) => Math.round(nut?.[key]?.quantity ?? 0);
  const round1 = (key) => Math.round((nut?.[key]?.quantity ?? 0) * 10) / 10;

  // ── Метки здоровья и диеты (верхний уровень ответа) ──
  const rawHealth  = data.healthLabels ?? [];
  const rawDiet    = data.dietLabels   ?? [];
  const healthLabels = Array.isArray(rawHealth) ? rawHealth : Object.keys(rawHealth);
  const dietLabels   = Array.isArray(rawDiet)   ? rawDiet   : Object.keys(rawDiet);

  // ── Сахар (для предупреждения в UI) ──────────────────
  const sugar = round1('SUGAR');

  // ── Витамины ──────────────────────────────────────────
  const vitamins = [
    { key: 'vitA',   label: 'Витамин A', value: get('VITA_RAE'),  unit: 'мкг', dv: 900  },
    { key: 'vitC',   label: 'Витамин C', value: get('VITC'),      unit: 'мг',  dv: 90   },
    { key: 'vitD',   label: 'Витамин D', value: round1('VITD'),   unit: 'мкг', dv: 20   },
    { key: 'vitE',   label: 'Витамин E', value: round1('TOCHPH'), unit: 'мг',  dv: 15   },
    { key: 'vitK',   label: 'Витамин K', value: get('VITK1'),     unit: 'мкг', dv: 120  },
    { key: 'vitB6',  label: 'B6',        value: round1('VITB6A'), unit: 'мг',  dv: 1.7  },
    { key: 'vitB12', label: 'B12',       value: round1('VITB12'), unit: 'мкг', dv: 2.4  },
  ];

  // ── Минералы ──────────────────────────────────────────
  const minerals = [
    { key: 'calcium',   label: 'Кальций', value: get('CA'),     unit: 'мг', dv: 1300 },
    { key: 'iron',      label: 'Железо',  value: round1('FE'),  unit: 'мг', dv: 18   },
    { key: 'magnesium', label: 'Магний',  value: get('MG'),     unit: 'мг', dv: 420  },
    { key: 'potassium', label: 'Калий',   value: get('K'),      unit: 'мг', dv: 4700 },
    { key: 'sodium',    label: 'Натрий',  value: get('NA'),     unit: 'мг', dv: 2300 },
  ];

  return {
    label:        russianText,
    englishLabel: parsed.food ?? englishText,
    calories:     get('ENERC_KCAL'),
    protein:      get('PROCNT'),
    fat:          get('FAT'),
    carbs:        get('CHOCDF'),
    fiber:        get('FIBTG'),
    weight:       Math.round(parsed.weight ?? 0),
    timestamp:    new Date().toISOString(),
    id:           crypto.randomUUID(),
    healthLabels,
    dietLabels,
    vitamins,
    minerals,
    sugar,
  };
}

/**
 * @typedef {{
 *   label: string,
 *   englishLabel: string,
 *   calories: number,
 *   protein: number,
 *   fat: number,
 *   carbs: number,
 *   fiber: number,
 *   weight: number,
 *   timestamp: string,
 *   id: string,
 *   healthLabels: string[],
 *   dietLabels: string[],
 *   vitamins: Array<{key:string, label:string, value:number, unit:string, dv:number}>,
 *   minerals: Array<{key:string, label:string, value:number, unit:string, dv:number}>,
 * }} NutritionResult
 */
