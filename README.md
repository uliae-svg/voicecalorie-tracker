# ◈ VoiceCalorie Tracker

> Инновационный голосовой ИИ-трекер калорий — скажите что съели, получите КБЖУ мгновенно.

![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-ES2024-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)

---

## ✨ Особенности

- 🎙️ **Голосовой ввод на русском** — Web Speech API, никакого набора текста
- 🌐 **Автоматический перевод** — русский текст переводится в английский перед запросом к API
- ⚡ **КБЖУ в реальном времени** — калории, белки, жиры, углеводы появляются мгновенно
- 📓 **Дневник питания** — все приёмы пищи за день сохраняются локально
- 🌙 **Тёмный интерфейс** — минималистичный дизайн в стиле health-приложений
- 📱 **Mobile-first** — адаптирован под любой экран

---

## 🛠️ Технологии

| Слой | Технология |
|---|---|
| Сборщик | [Vite 8](https://vitejs.dev/) |
| Язык | Vanilla JS (ES Modules, ES2024) |
| Речь | [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) |
| Перевод | [MyMemory Translation API](https://mymemory.translated.net/) |
| Питание | [Edamam Nutrition Analysis API](https://developer.edamam.com/) |
| Хранилище | `localStorage` |
| Деплой | [Vercel](https://vercel.com/) |

---

## 🚀 Как запустить

### 1. Клонируйте репозиторий

```bash
git clone https://github.com/uliae-svg/voicecalorie-tracker.git
cd voicecalorie-tracker
```

### 2. Установите зависимости

```bash
npm install
```

### 3. Настройте переменные окружения

```bash
cp .env.example .env
```

Откройте `.env` и заполните ключи от [Edamam](https://developer.edamam.com/) → Food Database → Nutrition Analysis:

```env
VITE_EDAMAM_APP_ID=ваш_app_id
VITE_EDAMAM_APP_KEY=ваш_app_key
```

### 4. Запустите dev-сервер

```bash
npm run dev
```

Откройте [http://127.0.0.1:3000](http://127.0.0.1:3000) в **Chrome** или **Edge**.

> ⚠️ Web Speech API работает только в Chrome и Edge. Firefox не поддерживается.

---

## 📦 Сборка для продакшена

```bash
npm run build    # собирает в папку /dist
npm run preview  # локальный просмотр сборки
```

---

## 📁 Структура проекта

```
voicecalorie-tracker/
├── index.html
├── vite.config.js
├── .env                          # секреты (в .gitignore)
├── .env.example                  # шаблон для новых разработчиков
└── src/
    ├── css/
    │   ├── variables.css         # дизайн-токены
    │   ├── main.css              # базовые стили
    │   └── components/
    │       ├── mic-button.css
    │       ├── food-card.css
    │       └── daily-log.css
    └── js/
        ├── config.js             # конфигурация API
        ├── speech.js             # Web Speech API wrapper
        ├── nutrition.js          # перевод + Edamam API
        ├── storage.js            # localStorage CRUD
        ├── ui.js                 # DOM-рендеринг
        └── main.js               # точка входа
```

---

## 🎙️ Как пользоваться

1. Откройте приложение в Chrome/Edge
2. Разрешите доступ к микрофону
3. Нажмите кнопку **◉** и скажите что вы съели:
   - _«борщ 300 грамм»_
   - _«два яблока»_
   - _«гречка 200 грамм»_
4. Получите КБЖУ на экране — запись автоматически добавится в дневник

---

## 🔐 Безопасность

API-ключи хранятся в `.env` и **не попадают в Git**. Для продакшена рекомендуется проксировать запросы к Edamam через собственный бэкенд, чтобы ключи не были видны в браузере.

---

## 📄 Лицензия

MIT © 2026
