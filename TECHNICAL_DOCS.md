# Technical Documentation — VoiceFood

**Version:** 4.0  
**Stack:** Vanilla JS (ES2024) · Vite 8 · Web Speech API · Edamam · Groq (Llama 3.3)  
**Last updated:** April 2026

---

## 1. Архитектура проекта

### Принцип разделения на модули

Проект намеренно построен без фреймворков. Каждый файл в `src/js/` реализует одну зону ответственности — принцип Single Responsibility. Это упрощает тестирование, замену отдельных слоёв и онбординг новых разработчиков.

```
src/js/
├── config.js          # Конфигурация: Edamam + Groq ключи, базовые URL
├── speech.js          # Инфраструктура: обёртка над Web Speech API
├── nutrition.js       # Бизнес-логика: перевод + Edamam API, микронутриенты, метки
├── storage.js         # Персистентность: CRUD + calcTotals (КБЖУ + клетчатка + микро)
├── ui.js              # Представление: рендеринг, бейджи, модал, AI-блок
├── swipe.js           # Взаимодействие: свайп-жесты для записей дневника
├── ai-analysis.js     # AI: формирование промпта + Groq SSE-стриминг
└── main.js            # Точка входа: связывает модули, обработчики событий
```

### Поток данных

```
Пользователь
    │
    ▼
[speech.js]          SpeechRecognizer.start() → onResult(text)
    │
    ▼
[nutrition.js]       analyzeFood(text) → NutritionResult
    │  ├─ normalizeUnits()       «курица 120 г» → «курица 120 g»
    │  ├─ translateToEnglish()   «курица 120 g» → «chicken 120 g»
    │  ├─ reorderForEdamam()     «chicken 120 g» → «120g chicken»
    │  └─ fetch(Edamam API)      → calories, macros, vitamins, minerals, labels
    │
    ├──▶ [storage.js]            addEntry(result) → localStorage
    │
    └──▶ [ui.js]                 renderResult() · renderLog() · updateTotals()
                                  ↳ openNutritionModal()  — по клику «Микронутриенты»
                                  ↳ renderDailyMicros()   — витамины/минералы за день

[ai-analysis.js]     analyzeDiet(log, totals) — по клику «🧠 Анализ от диетолога»
    ├─ buildPrompt()    формирует текстовый промпт из дневника
    └─ fetch(Groq SSE)  → onChunk(text) · onDone() · onError()
```

`main.js` не содержит бизнес-логики — только связывание. Если завтра Web Speech API заменить на Whisper API, достаточно заменить `speech.js`, не трогая остальные модули.

---

## 2. Интеграция API

### 2.1 Web Speech API — распознавание речи

```js
// speech.js
const recognition = new webkitSpeechRecognition();
recognition.lang           = 'ru-RU';
recognition.interimResults = false;   // только финальный результат
recognition.continuous     = false;   // один запрос — один результат
```

**Ограничения:**
- Поддерживается только в Chromium-браузерах (Chrome, Edge).
- Требует HTTPS или `localhost` — браузер блокирует микрофон на незащищённых страницах.
- Распознавание выполняется на серверах Google, запросы идут во внешнюю сеть.

### 2.2 MyMemory Translation API — нормализация языка

Edamam Nutrition Analysis API принимает ингредиенты на английском. Прямая передача русского текста приводит к пустому ответу, поэтому введён промежуточный слой перевода.

```
POST https://api.mymemory.translated.net/get
  ?q=курица+120+g
  &langpair=ru|en

→ { responseData: { translatedText: "chicken 120 g" } }
```

**Предобработка перед переводом** (`normalizeUnits`):  
Единицы измерения («г», «мл», «кг») переводятся в латинские аббревиатуры до вызова переводчика, так как MyMemory не транслирует кириллические сокращения:

```
«курица 120 г»
    ↓ normalizeUnits
«курица 120 g»       ← «г» → «g» до перевода
    ↓ translateToEnglish
«chicken 120 g»
    ↓ reorderForEdamam
«120g chicken»       ← Edamam парсит NLP лучше при формате «количество продукт»
```

### 2.3 Edamam Nutrition Analysis API

**Эндпоинт:**
```
GET https://api.edamam.com/api/nutrition-data
  ?app_id=…
  &app_key=…
  &nutrition-type=logging
  &ingr=120g+chicken
```

**Особенность бесплатного тира:**  
На бесплатном плане поля `calories` и `totalWeight` верхнего уровня не заполнены. Все данные находятся по пути:

```
response.ingredients[0].parsed[0].nutrients.ENERC_KCAL.quantity  // калории
response.ingredients[0].parsed[0].nutrients.PROCNT.quantity       // белки
response.ingredients[0].parsed[0].nutrients.FAT.quantity          // жиры
response.ingredients[0].parsed[0].nutrients.CHOCDF.quantity       // углеводы
response.ingredients[0].parsed[0].weight                          // граммы
```

**Микронутриенты** — дополнительные ключи из того же объекта `nutrients`:

| Ключ Edamam | Нутриент | Единица | Дневная норма |
|---|---|---|---|
| `VITA_RAE` | Витамин A | мкг | 900 |
| `VITC` | Витамин C | мг | 90 |
| `VITD` | Витамин D | мкг | 20 |
| `TOCHPH` | Витамин E | мг | 15 |
| `VITK1` | Витамин K | мкг | 120 |
| `VITB6A` | Витамин B6 | мг | 1.7 |
| `VITB12` | Витамин B12 | мкг | 2.4 |
| `CA` | Кальций | мг | 1300 |
| `FE` | Железо | мг | 18 |
| `MG` | Магний | мг | 420 |
| `K` | Калий | мг | 4700 |
| `NA` | Натрий | мг | 2300 |
| `SUGAR` | Сахар | г | — |

**Метки здоровья** (`healthLabels`, `dietLabels`) — массивы строк на верхнем уровне ответа. Если приходит объект вместо массива (разные версии API), код нормализует его через `Object.keys()`:

```js
const rawHealth  = data.healthLabels ?? [];
const healthLabels = Array.isArray(rawHealth) ? rawHealth : Object.keys(rawHealth);
```

---

## 3. AI-диетолог (Groq API)

### 3.1 Архитектура

Модуль `ai-analysis.js` отвечает за весь цикл: формирование промпта → запрос к Groq → SSE-стриминг → колбэки в UI. `main.js` только передаёт `log` и `totals` и реагирует на колбэки.

### 3.2 Формирование промпта

Промпт строится из трёх частей:

```
1. Роль: «Ты персональный диетолог-нутрициолог. Отвечай на русском.»
2. Данные дневника — сгруппированы по приёмам пищи:
     Завтрак:
       • Овсянка 100г — 350 ккал, Б:12г Ж:7г У:60г К:3г
     Обед:
       • Куриная грудка 150г — 165 ккал, Б:31г Ж:3г У:0г К:0г
3. Итоги: калории (% нормы), белки, жиры, углеводы, клетчатка
4. Инструкция формата — три блока: ✅ хорошо / ⚠️ улучшить / 💡 рекомендация
```

### 3.3 SSE-стриминг

Groq возвращает ответ в формате Server-Sent Events (OpenAI-совместимый):

```js
const reader  = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // Один read() может содержать несколько строк SSE
  const lines = decoder.decode(value, { stream: true }).split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') { onDone(); return; }

    const text = JSON.parse(payload).choices?.[0]?.delta?.content ?? '';
    if (text) onChunk(text);
  }
}
```

Каждый вызов `onChunk(text)` добавляет текст в DOM немедленно — пользователь видит ответ по словам. После `onDone()` применяется markdown-форматирование (`**текст**` → `<strong>`).

### 3.4 Модель и параметры

```js
model:       'llama-3.3-70b-versatile',  // лучшая бесплатная модель Groq
max_tokens:  600,
temperature: 0.65,  // достаточно детерминированно для медицинского контекста
stream:      true,
```

Groq предоставляет бесплатный тир с лимитом ~14 400 запросов/день — достаточно для личного использования.

---

## 5. Микронутриенты и метки здоровья

### 3.1 Цветовая схема бейджей

Бейджи рендерятся через CSS-переменные `--badge-bg` и `--badge-color`, что позволяет использовать один класс `.health-badge` для всех цветов:

```js
// ui.js — BADGE_MAP
const BADGE_MAP = {
  VEGAN:         { label: 'Vegan',        bg: '#dcfce7', color: '#15803d' },
  HIGH_PROTEIN:  { label: 'High Protein', bg: '#dbeafe', color: '#1d4ed8' },
  LOW_CARB:      { label: 'Low Carb',     bg: '#ffedd5', color: '#c2410c' },
  DAIRY_FREE:    { label: 'Dairy Free',   bg: '#f3e8ff', color: '#7e22ce' },
  KETO_FRIENDLY: { label: 'Keto',         bg: '#fef08a', color: '#713f12' },
  // ...и другие
};
```

### 3.2 Логика предупреждений

Предупреждения основаны на **реальных числовых значениях**, а не на наличии или отсутствии меток. Это исключает ложные срабатывания (например, мясо не имеет метки `SUGAR_CONSCIOUS`, но сахара в нём нет):

```js
// Много сахара — больше 15 г на порцию
if ((nutrition.sugar ?? 0) > 15) {
  warnings.push(`⚠ Много сахара: ${nutrition.sugar} г`);
}

// Высокий натрий — больше 600 мг (>26% дневной нормы)
if (sodiumItem.value > 600) {
  warnings.push(`⚠ Высокий натрий: ${sodiumItem.value} мг`);
}
```

### 3.3 Модальное окно микронутриентов

Модал реализован как **singleton**: создаётся один раз при первом вызове и переиспользуется. Это избегает накопления DOM-узлов при многократном открытии:

```js
let modal = null;

function getModal() {
  if (modal) return modal;       // уже создан — переиспользуем
  modal = document.createElement('div');
  // ...
  document.body.appendChild(modal);
  return modal;
}
```

Прогресс-бары нутриентов анимируются через CSS `transition: width` с задержкой через `requestAnimationFrame`, обеспечивая плавное появление при открытии модала.

---

## 6. Свайп-жесты (swipe.js)

### 4.1 Принцип работы

Функция `makeSwipeable(shell, picker, callbacks)` подключается к каждому элементу дневника. Она обрабатывает как тач-события (мобильные), так и мышь (десктоп) через единый обработчик.

```
Свайп влево > 55px  → открыть зону удаления (красный фон)
Свайп влево > 160px → автоматически удалить с анимацией collapse
Свайп вправо > 55px → открыть пикер приёма пищи (синий фон)
```

### 4.2 Управление памятью — AbortController

**Проблема:** `window.addEventListener('mousemove')` и `window.addEventListener('mouseup')` добавляются при каждом рендере списка и никогда не удалялись — утечка памяти.

**Решение:** `AbortController` с `{ signal }` позволяет отписаться от всех глобальных слушателей одним вызовом `ac.abort()`. `MutationObserver` следит за удалением элемента из DOM и вызывает `abort()` автоматически:

```js
const ac = new AbortController();
const { signal } = ac;

// Следим за удалением shell из DOM
new MutationObserver((_, obs) => {
  if (!document.contains(shell)) {
    ac.abort();      // снимаем все глобальные слушатели
    obs.disconnect();
  }
}).observe(document.body, { childList: true, subtree: true });

// Все глобальные слушатели получают { signal }
window.addEventListener('mousemove', handler, { signal });
window.addEventListener('mouseup',   handler, { signal });
document.addEventListener('click',   handler, { signal });
```

Это паттерн 2024+ (AbortController для EventListener появился в Chrome 88, Firefox 87).

---

## 7. Безопасность

### 5.1 Защита API-ключей

Ключи не хранятся в коде. Vite при сборке статически подставляет значения `import.meta.env.VITE_*` в бандл. Переменные без префикса `VITE_` не попадают в клиентский код.

```
.env          ← реальные ключи, в .gitignore
.env.example  ← шаблон без значений, коммитится
```

> Ключи, встроенные в JS-бандл, видны в DevTools. Для продакшена рекомендуется проксировать запросы через бэкенд.

### 5.2 Защита от XSS

Весь пользовательский ввод и данные из API экранируются функцией `escHtml()` перед вставкой в `innerHTML`:

```js
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

Числовые значения нутриентов (результат `Math.round`) в `innerHTML` не экранируются — они не могут содержать HTML-теги по природе.

---

## 8. Хранение данных

### 6.1 Структура записи

```ts
type NutritionEntry = {
  id:           string;        // crypto.randomUUID()
  label:        string;        // исходная русская фраза
  englishLabel: string;        // распознанный продукт от Edamam
  meal:         'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories:     number;        // ккал
  protein:      number;        // г
  fat:          number;        // г
  carbs:        number;        // г
  fiber:        number;        // г
  sugar:        number;        // г
  weight:       number;        // г продукта
  timestamp:    string;        // ISO 8601, UTC
  healthLabels: string[];      // ['VEGAN', 'HIGH_PROTEIN', ...]
  dietLabels:   string[];      // ['LOW_CARB', ...]
  vitamins:     Nutrient[];    // [{key, label, value, unit, dv}, ...]
  minerals:     Nutrient[];    // [{key, label, value, unit, dv}, ...]
}

type Nutrient = {
  key:   string;   // 'vitA', 'calcium', ...
  label: string;   // 'Витамин A', 'Кальций', ...
  value: number;   // количество
  unit:  string;   // 'мкг', 'мг'
  dv:    number;   // дневная норма (для расчёта %)
}
```

Все записи хранятся в одном ключе `voicecalorie_log_v1` как JSON-массив.

### 6.2 Управление данными

- **Фильтрация по дате** использует локальный часовой пояс пользователя (не UTC), чтобы запись в 23:50 по московскому времени попадала в правильный день.
- **Ротация** — записи старше 30 дней удаляются автоматически при каждой записи.
- **Обновление записи** — `updateEntry(id, patch)` делает иммутабельный merge: `{ ...entry, ...patch }`.

---

## 9. Навигация по датам

### 9.1 Состояние в main.js

Вся навигация строится вокруг одной переменной `selectedDate: Date`. При переходе на другой день меняется только она — `loadLog()` и `refreshUI()` автоматически обновляют весь UI:

```js
let selectedDate = new Date(); // текущая просматриваемая дата

function loadLog() {
  return getLogForDate(dateKeyOf(selectedDate));
}

function isToday() {
  return dateKeyOf(selectedDate) === dateKeyOf(new Date());
}
```

### 9.2 Новые функции в storage.js

```js
// Преобразует Date → 'YYYY-MM-DD' в локальном часовом поясе
export function dateKeyOf(date) { ... }

// Возвращает записи за конкретный день
export function getLogForDate(dateKey) {
  return readAll().filter((e) => localDateOf(e.timestamp) === dateKey);
}

// Удаляет записи за конкретный день
export function clearDate(dateKey) { ... }
```

`getTodayLog()` и `clearToday()` теперь просто вызывают `getLogForDate(todayKey())` и `clearDate(todayKey())`.

### 9.3 Сохранение в прошедшую дату

Когда пользователь добавляет запись на прошедшую дату, timestamp подменяется на выбранный день с текущим временем:

```js
let entry = { ...nutrition, meal: currentMeal };
if (!isToday()) {
  const ts = new Date(selectedDate);
  ts.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
  entry = { ...entry, timestamp: ts.toISOString() };
}
addEntry(entry);
```

Это позволяет записи «лежать» в правильном дне при фильтрации по `localDateOf(timestamp)`.

### 9.4 UX-детали

- Кнопка **›** (`nextDayBtn`) заблокирована (`disabled`) на сегодняшней дате — нельзя уйти в будущее.
- Метка под датой: **Сегодня** (синяя) / **Вчера** / **N дн. назад** (серая).
- При переходе между датами очищаются `resultContainer`, `transcriptBox` и `aiResponse` — интерфейс не показывает результат предыдущего дня.
- Диалог сброса дневника показывает имя выбранной даты: «Очистить за 14 апреля?».

---

## 10. Решения, принятые осознанно

| Решение | Альтернатива | Причина выбора |
|---|---|---|
| Vanilla JS | React / Vue | Нет необходимости в реактивности для MVP такого масштаба |
| CSS-модули вручную | Tailwind / CSS-in-JS | Полный контроль над дизайном без лишних зависимостей |
| MyMemory (бесплатный) | Google Translate API | Нулевые затраты на старте, легко заменить |
| localStorage | IndexedDB | Достаточно для объёма данных MVP, проще в поддержке |
| Vite без TypeScript | TypeScript | Снижение порога входа; JSDoc-аннотации дают базовую типизацию |
| AbortController для свайпов | removeEventListener | Один вызов `abort()` снимает все слушатели; нет риска утечки |
| Singleton-модал | Новый элемент на каждый вызов | Нет накопления DOM-узлов; анимация переиспользуется |
| Числовые пороги для предупреждений | Метки API (SUGAR_CONSCIOUS) | Метки присваиваются непоследовательно; числа точны |
| Groq (бесплатный) | OpenAI GPT-4 | Llama 3.3 70B бесплатно; скорость генерации в 3-5 раз выше GPT-4 |
| SSE-стриминг для AI | Ждать полного ответа | Пользователь видит текст мгновенно; UX значительно лучше |
| Промпт на русском | Промпт на английском | Модель точнее соблюдает формат ответа при совпадении языка |
| `selectedDate` в main.js | URL-параметр или роутер | Нет необходимости в роутинге; SPA, дата живёт только в памяти |
| Подмена timestamp при вводе прошлой даты | Отдельное поле `date` | Вся фильтрация уже построена на `localDateOf(timestamp)`; менять не нужно |
