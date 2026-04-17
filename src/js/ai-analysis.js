// ────────────────────────────────────────────────────────
//  ai-analysis.js — анализ дневника питания через Groq API
// ────────────────────────────────────────────────────────

import { CONFIG } from './config.js';

const MEAL_NAMES = {
  breakfast: 'Завтрак',
  lunch:     'Обед',
  dinner:    'Ужин',
  snack:     'Перекус',
};

// ── Общие утилиты ────────────────────────────────────────

/**
 * Отправляет запрос к Groq и стримит ответ через колбэки.
 * @param {string}   prompt
 * @param {object}   options    — { max_tokens, temperature }
 * @param {object}   callbacks  — { onChunk, onDone, onError }
 */
async function streamGroq(prompt, { max_tokens, temperature }, { onChunk, onDone, onError }) {
  if (!CONFIG.GROQ_API_KEY) {
    onError('Groq API ключ не задан. Добавьте VITE_GROQ_API_KEY в файл .env\nКлюч бесплатно: https://console.groq.com/');
    return;
  }

  let response;
  try {
    response = await fetch(CONFIG.GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       CONFIG.GROQ_MODEL,
        messages:    [{ role: 'user', content: prompt }],
        stream:      true,
        max_tokens,
        temperature,
      }),
    });
  } catch {
    onError('Не удалось подключиться к Groq. Проверьте интернет.');
    return;
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    onError(`Groq API ошибка ${response.status}: ${err?.error?.message ?? 'неизвестная ошибка'}`);
    return;
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') { onDone(); return; }

        let parsed;
        try { parsed = JSON.parse(payload); } catch { continue; }

        const text = parsed.choices?.[0]?.delta?.content ?? '';
        if (text) onChunk(text);
      }
    }
  } catch {
    onError('Ошибка чтения ответа от Groq.');
    return;
  }

  onDone();
}

// ── Анализ дневника ──────────────────────────────────────

/** Строит текстовый промпт из дневника + итогов */
function buildPrompt(log, totals) {
  const groups = Object.groupBy(log, (e) => e.meal ?? 'snack');

  const mealsText = ['breakfast', 'lunch', 'dinner', 'snack']
    .filter((k) => groups[k]?.length)
    .map((k) => {
      const items = groups[k]
        .map((e) => `  • ${e.label} — ${e.calories} ккал, Б:${e.protein}г Ж:${e.fat}г У:${e.carbs}г К:${e.fiber ?? 0}г`)
        .join('\n');
      return `${MEAL_NAMES[k]}:\n${items}`;
    })
    .join('\n\n');

  const pct = (v, goal) => `${v} г (${Math.round((v / goal) * 100)}% нормы)`;

  const totalsText = [
    `Калории:    ${totals.calories} / 2000 ккал (${Math.round((totals.calories / 2000) * 100)}%)`,
    `Белки:      ${pct(totals.protein, 150)}`,
    `Жиры:       ${pct(totals.fat, 65)}`,
    `Углеводы:   ${pct(totals.carbs, 250)}`,
    `Клетчатка:  ${pct(totals.fiber ?? 0, 30)}`,
  ].join('\n');

  return `Ты персональный диетолог-нутрициолог. Отвечай только на русском языке. Будь дружелюбным, конкретным и кратким.

ДНЕВНИК ПИТАНИЯ ЗА СЕГОДНЯ:
${mealsText}

ИТОГИ:
${totalsText}

Напиши анализ строго в этом формате (без лишних вступлений):

✅ **Что хорошо**
[1-2 предложения о положительных моментах]

⚠️ **На что обратить внимание**
[1-2 предложения о недостатках или дисбалансе]

💡 **Рекомендация на завтра**
[1 конкретный совет: что добавить или убрать]`;
}

/**
 * Отправляет дневник в Groq и стримит ответ.
 * @param {Array}    log      — записи за день
 * @param {object}   totals   — { calories, protein, fat, carbs, fiber }
 * @param {object}   callbacks — { onChunk, onDone, onError }
 */
export function analyzeDiet(log, totals, callbacks) {
  if (!log.length) {
    callbacks.onError('Дневник пуст. Добавьте хотя бы один приём пищи.');
    return;
  }

  streamGroq(
    buildPrompt(log, totals),
    { max_tokens: 600, temperature: 0.65 },
    callbacks,
  );
}

// ── Советы по нутриентам ─────────────────────────────────

/**
 * Стримит советы по продуктам для восполнения дефицитных нутриентов.
 * @param {Array}  deficient — [{label, value, unit, dv}, ...]  нутриенты < 50% нормы
 * @param {object} callbacks — { onChunk, onDone, onError }
 */
export function getNutrientTips(deficient, callbacks) {
  const list = deficient
    .map((n) => `${n.label}: ${n.value} ${n.unit} (${Math.round((n.value / n.dv) * 100)}% нормы)`)
    .join(', ');

  const prompt = `Ты нутрициолог. Отвечай только на русском, кратко и конкретно.

Пользователю сегодня не хватает: ${list}.

Для каждого нутриента из списка отдельно напиши 4-5 продуктов которые его содержат. Формат строго такой:

**[Название нутриента]**
• Продукт 1
• Продукт 2
• Продукт 3
• Продукт 4

Только продукты, никаких пояснений и вступлений. Продукты должны быть обычными и доступными.`;

  streamGroq(prompt, { max_tokens: 350, temperature: 0.6 }, callbacks);
}
