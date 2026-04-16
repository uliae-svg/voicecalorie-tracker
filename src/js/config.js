// ────────────────────────────────────────────────────────
//  VoiceCalorie — конфигурация приложения
//
//  Ключи берутся из .env (файл в .gitignore).
//  Vite подставляет значения из .env во время сборки —
//  в браузер попадают уже как строки, не как файл.
//
//  Переменные ДОЛЖНЫ начинаться с VITE_ — это правило Vite,
//  чтобы случайно не засветить системные переменные окружения.
// ────────────────────────────────────────────────────────

const APP_ID    = import.meta.env.VITE_EDAMAM_APP_ID  ?? '';
const APP_KEY   = import.meta.env.VITE_EDAMAM_APP_KEY ?? '';
const GROQ_KEY  = import.meta.env.VITE_GROQ_API_KEY   ?? '';

if (!APP_ID || !APP_KEY) {
  console.warn(
    '[VoiceFood] Edamam API ключи не заданы.\n' +
    'Откройте .env и заполните VITE_EDAMAM_APP_ID и VITE_EDAMAM_APP_KEY.\n' +
    'Ключи: https://developer.edamam.com/'
  );
}

if (!GROQ_KEY) {
  console.warn(
    '[VoiceFood] Groq API ключ не задан.\n' +
    'Откройте .env и заполните VITE_GROQ_API_KEY.\n' +
    'Ключ бесплатно: https://console.groq.com/'
  );
}

export const CONFIG = {
  EDAMAM_APP_ID:   APP_ID,
  EDAMAM_APP_KEY:  APP_KEY,
  EDAMAM_BASE_URL: 'https://api.edamam.com/api/nutrition-data',

  // MyMemory Translation API (бесплатно, без ключа)
  TRANSLATE_URL: 'https://api.mymemory.translated.net/get',

  // Groq — бесплатный AI (Llama 3.3 70B)
  GROQ_API_KEY: GROQ_KEY,
  GROQ_URL:     'https://api.groq.com/openai/v1/chat/completions',
  GROQ_MODEL:   'llama-3.3-70b-versatile',
};
