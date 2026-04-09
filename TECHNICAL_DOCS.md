# Technical Documentation — VoiceCalorie Tracker

**Version:** 1.0  
**Stack:** Vanilla JS (ES2024) · Vite 8 · Web Speech API · Edamam Nutrition Analysis API  
**Last updated:** April 2026

---

## 1. Архитектура проекта

### Принцип разделения на модули

Проект намеренно построен без фреймворков. Каждый файл в `src/js/` реализует одну зону ответственности — принцип Single Responsibility. Это упрощает тестирование, замену отдельных слоёв и онбординг новых разработчиков.

```
src/js/
├── config.js       # Конфигурация: читает переменные окружения, экспортирует CONFIG
├── speech.js       # Инфраструктура: обёртка над Web Speech API
├── nutrition.js    # Бизнес-логика: перевод + запрос к Edamam, формирование результата
├── storage.js      # Персистентность: CRUD-операции над localStorage
├── ui.js           # Представление: все DOM-мутации сосредоточены здесь
└── main.js         # Точка входа: связывает модули, регистрирует обработчики событий
```

### Поток данных

```
Пользователь
    │
    ▼
[speech.js]          SpeechRecognizer.start() → onResult(text)
    │
    ▼
[nutrition.js]       analyzeFood(text)
    │  ├─ normalizeUnits()     «курица 120 г» → «курица 120 g»
    │  ├─ translateToEnglish() «курица 120 g» → «chicken 120 g»
    │  ├─ reorderForEdamam()   «chicken 120 g» → «120g chicken»
    │  └─ fetch(Edamam API)    → NutritionResult
    │
    ├──▶ [storage.js]          addEntry(result) → localStorage
    │
    └──▶ [ui.js]               renderResult() · renderLog() · updateTotals()
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

**Почему MyMemory, а не Google Translate API:**  
MyMemory не требует ключа и бесплатен до 5 000 символов/день — достаточно для MVP. Для продакшена с высокой нагрузкой следует заменить на платный провайдер с SLA.

**Предобработка перед переводом** (`normalizeUnits`):  
Единицы измерения («г», «мл», «кг») переводятся в латинские аббревиатуры до вызова переводчика, так как MyMemory не транслирует кириллические сокращения:

```js
«курица 120 г»
    ↓ normalizeUnits
«курица 120 g»     // «г» → «g» до перевода
    ↓ translateToEnglish
«chicken 120 g»
    ↓ reorderForEdamam
«120g chicken»     // Edamam парсит NLP лучше при формате «количество продукт»
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
На бесплатном плане Edamam не агрегирует данные на верхнем уровне ответа. Поля `calories` и `totalWeight` не заполнены. Нутриенты находятся по пути:

```
response.ingredients[0].parsed[0].nutrients.ENERC_KCAL.quantity  // калории
response.ingredients[0].parsed[0].nutrients.PROCNT.quantity       // белки
response.ingredients[0].parsed[0].nutrients.FAT.quantity          // жиры
response.ingredients[0].parsed[0].nutrients.CHOCDF.quantity       // углеводы
response.ingredients[0].parsed[0].weight                          // граммы
```

Валидация ответа производится по полю `parsed[0].status === 'OK'`. Если продукт не распознан, пользователь получает информативное сообщение об ошибке.

---

## 3. Безопасность

### 3.1 Защита API-ключей через переменные окружения

Ключи не хранятся в коде. Они считываются из `.env` через механизм Vite:

```
.env                   ← содержит реальные ключи, в .gitignore
.env.example           ← шаблон без значений, коммитится в репозиторий
```

Vite при сборке статически подставляет значения `import.meta.env.VITE_*` в бандл. Переменные без префикса `VITE_` в клиентский код не попадают — это защита от случайной утечки системных переменных окружения (`PATH`, `HOME` и т.д.).

```js
// config.js
const APP_ID = import.meta.env.VITE_EDAMAM_APP_ID ?? '';
```

**Важная оговорка:** ключи, встроенные в JS-бандл, видны в DevTools → Sources. Это приемлемо для MVP и личного проекта. Для продакшена с коммерческим API рекомендуется проксировать запросы через собственный бэкенд — тогда ключ хранится в `process.env` сервера и клиент его никогда не получает.

### 3.2 Защита от XSS

Весь пользовательский ввод (распознанный текст) и данные из внешних API перед вставкой в DOM экранируются функцией `escHtml()`:

```js
// ui.js
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

`innerHTML` используется только после экранирования. Прямая интерполяция пользовательских данных в HTML-строки отсутствует.

---

## 4. Хранение данных

### 4.1 Структура записи

Каждый приём пищи сохраняется как объект:

```ts
type NutritionEntry = {
  id:           string;   // crypto.randomUUID()
  label:        string;   // исходная русская фраза
  englishLabel: string;   // распознанный продукт от Edamam
  calories:     number;   // ккал
  protein:      number;   // г
  fat:          number;   // г
  carbs:        number;   // г
  fiber:        number;   // г
  weight:       number;   // г продукта
  timestamp:    string;   // ISO 8601, UTC
}
```

Все записи хранятся в одном ключе `voicecalorie_log_v1` как JSON-массив.

### 4.2 Почему localStorage, а не IndexedDB или серверная БД

| Критерий | localStorage | IndexedDB | Серверная БД |
|---|---|---|---|
| Сложность реализации | Минимальная | Средняя | Высокая |
| Объём данных | До ~5 МБ | До ~1 ГБ | Не ограничена |
| Синхронный доступ | Да | Нет (async) | Нет |
| Работа офлайн | Да | Да | Нет |
| Синхронизация устройств | Нет | Нет | Да |

Для MVP с одним пользователем и короткими JSON-объектами localStorage — оптимальный выбор: нет зависимостей, нет асинхронности, нет серверной инфраструктуры. Средний объём одной записи — ~400 байт. При 10 приёмах пищи в день за 30 дней это ~120 КБ — хорошо вписывается в лимит.

### 4.3 Управление данными

- **Фильтрация по дате** использует локальный часовой пояс пользователя (не UTC), чтобы запись в 23:50 по московскому времени попадала в правильный день.
- **Ротация** — записи старше 30 дней удаляются автоматически при каждой записи. Это предотвращает бесконтрольный рост объёма.
- **Удаление записи** — по уникальному `id`, генерируемому через `crypto.randomUUID()`.

```js
// storage.js — фильтрация по локальной дате
function localDateOf(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
```

---

## 5. Решения, принятые осознанно

| Решение | Альтернатива | Причина выбора |
|---|---|---|
| Vanilla JS | React / Vue | Нет необходимости в реактивности для MVP такого масштаба |
| CSS-модули вручную | Tailwind / CSS-in-JS | Полный контроль над дизайном без лишних зависимостей |
| MyMemory (бесплатный) | Google Translate API | Нулевые затраты на старте, легко заменить |
| localStorage | IndexedDB | Достаточно для объёма данных MVP, проще в поддержке |
| Vite без TypeScript | TypeScript | Снижение порога входа; JSDoc-аннотации дают базовую типизацию |
