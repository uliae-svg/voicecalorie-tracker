// ────────────────────────────────────────────────────────
//  UI — функции рендеринга DOM
// ────────────────────────────────────────────────────────

let microsExpanded = false; // состояние раскрытия блока витаминов
const RING_CIRC    = 552.92; // 2π × 88

// Цели по умолчанию (используются пока профиль не заполнен)
const DEFAULT_GOALS = { calories: 2000, protein: 150, fat: 65, carbs: 250, fiber: 30 };

// ── Конфигурация бейджей ──────────────────────────────────

const BADGE_CONFIG = {
  // Зелёные — растительное / чистое
  VEGAN:            { color: 'green',  label: 'Веган' },
  VEGETARIAN:       { color: 'green',  label: 'Вегет.' },
  PLANT_BASED:      { color: 'green',  label: 'Plant-based' },
  ORGANIC:          { color: 'green',  label: 'Органик' },

  // Синие — белок / спорт
  'HIGH_PROTEIN':   { color: 'blue',   label: 'Много белка' },
  'PALEO':          { color: 'blue',   label: 'Палео' },
  'KETO_FRIENDLY':  { color: 'blue',   label: 'Кето' },

  // Оранжевые — диеты
  'LOW_CARB':       { color: 'orange', label: 'Мало углев.' },
  'LOW_FAT':        { color: 'orange', label: 'Мало жира' },
  'LOW_SODIUM':     { color: 'orange', label: 'Мало соли' },
  'LOW_SUGAR':      { color: 'orange', label: 'Мало сахара' },
  'SUGAR_CONSCIOUS':{ color: 'orange', label: 'Без сахара' },
  'FAT_FREE':       { color: 'orange', label: 'Без жира' },

  // Фиолетовые — без аллергенов / специальные
  'GLUTEN_FREE':    { color: 'purple', label: 'Без глютена' },
  'DAIRY_FREE':     { color: 'purple', label: 'Без лактозы' },
  'EGG_FREE':       { color: 'purple', label: 'Без яиц' },
  'PEANUT_FREE':    { color: 'purple', label: 'Без арахиса' },
  'SOY_FREE':       { color: 'purple', label: 'Без сои' },
  'WHEAT_FREE':     { color: 'purple', label: 'Без пшеницы' },
};

// Метки, которые показываем в карточке (топ-4 самые интересные)
const CARD_PRIORITY = [
  'VEGAN','VEGETARIAN','HIGH_PROTEIN','KETO_FRIENDLY','LOW_CARB',
  'LOW_FAT','GLUTEN_FREE','DAIRY_FREE','SUGAR_CONSCIOUS','PALEO',
];

/** Переключает состояние кнопки микрофона */
export function setMicState(state) {
  const btn  = document.getElementById('micBtn');
  const hint = document.getElementById('micHint');

  btn.classList.remove('listening', 'processing');

  const hints = {
    idle:       'Нажмите для записи',
    listening:  'Слушаю... говорите',
    processing: 'Анализирую...',
  };

  if (state !== 'idle') btn.classList.add(state);
  hint.textContent = hints[state];

  document.getElementById('loading').style.display =
    state === 'processing' ? 'flex' : 'none';
}

/** Показывает распознанный текст */
export function showTranscript(original, translated = '') {
  const box  = document.getElementById('transcriptBox');
  const orig = document.getElementById('transcriptText');
  const tran = document.getElementById('transcriptTranslated');

  orig.textContent = `«${original}»`;
  tran.textContent = translated && translated !== original
    ? `→ ${translated}`
    : '';

  box.style.display = 'block';
  box.classList.add('animate-in');
  setTimeout(() => box.classList.remove('animate-in'), 600);
}

/** Рендерит карточку с результатом анализа */
export function renderResult(nutrition) {
  const container = document.getElementById('resultContainer');

  const card = document.createElement('div');
  card.className = 'food-card animate-in';
  card.dataset.id = nutrition.id;

  const time = new Date(nutrition.timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit', minute: '2-digit',
  });

  // ── Бейджи ────────────────────────────────────────────
  const allLabels = [...(nutrition.healthLabels ?? []), ...(nutrition.dietLabels ?? [])];
  const badgeHtml = buildBadges(allLabels, 4);

  // ── Предупреждения ────────────────────────────────────
  const warnings = buildWarnings(nutrition);

  card.innerHTML = `
    <div class="food-card__header">
      <div class="food-card__name">${escHtml(nutrition.label)}</div>
      <div class="food-card__meta">
        <span class="food-card__en">${escHtml(nutrition.englishLabel)}</span>
        <span class="food-card__time">${time}</span>
      </div>
      ${badgeHtml ? `<div class="food-card__badges">${badgeHtml}</div>` : ''}
      ${warnings  ? `<div class="food-card__warnings">${warnings}</div>` : ''}
    </div>
    <div class="food-card__macros">
      <div class="macro macro--cal">
        <span class="macro__value">${nutrition.calories}</span>
        <span class="macro__label">ккал</span>
      </div>
      <div class="macro macro--protein">
        <span class="macro__value">${nutrition.protein}<small>г</small></span>
        <span class="macro__label">белки</span>
      </div>
      <div class="macro macro--fat">
        <span class="macro__value">${nutrition.fat}<small>г</small></span>
        <span class="macro__label">жиры</span>
      </div>
      <div class="macro macro--carbs">
        <span class="macro__value">${nutrition.carbs}<small>г</small></span>
        <span class="macro__label">углев.</span>
      </div>
    </div>
    <div class="food-card__footer">
      ${nutrition.weight ? `<span class="food-card__weight">≈ ${nutrition.weight} г</span>` : '<span></span>'}
      <button class="food-card__details-btn" data-id="${nutrition.id}">
        Микронутриенты →
      </button>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(card);

  // Кнопка «Микронутриенты»
  card.querySelector('.food-card__details-btn')
    ?.addEventListener('click', () => openMicroModal(nutrition));
}

/** Обновляет кольцо калорий, прогресс-бары макросов и блок микронутриентов */
export function updateTotals(totals, goals = DEFAULT_GOALS) {
  const { calories, protein, fat, carbs, fiber, vitamins, minerals } = totals;
  const g = { ...DEFAULT_GOALS, ...goals };

  // ── Calorie ring ──
  const ring    = document.getElementById('ringProgress');
  const remain  = document.getElementById('ringRemain');
  const left    = Math.max(0, g.calories - calories);
  const over    = calories > g.calories;
  const progress = Math.min(calories / g.calories, 1);

  animateNumber('totalCalories', calories);
  const ringGoalEl = document.getElementById('ringGoal');
  if (ringGoalEl) ringGoalEl.textContent = g.calories;
  if (ring) {
    ring.style.strokeDashoffset = RING_CIRC * (1 - progress);
    ring.classList.toggle('over', over);
  }
  if (remain) {
    remain.textContent = over
      ? `Перебор ${calories - g.calories} ккал`
      : `Осталось ${left}`;
    remain.classList.toggle('over', over);
  }

  // ── Macro values ──
  const protEl  = document.getElementById('totalProtein');
  const fatEl   = document.getElementById('totalFat');
  const carbEl  = document.getElementById('totalCarbs');
  const fiberEl = document.getElementById('totalFiber');
  if (protEl)  protEl.textContent  = protein;
  if (fatEl)   fatEl.textContent   = fat;
  if (carbEl)  carbEl.textContent  = carbs;
  if (fiberEl) fiberEl.textContent = fiber;

  // ── Goal labels ──
  const goalProt  = document.getElementById('goalProteinText');
  const goalFat   = document.getElementById('goalFatText');
  const goalCarbs = document.getElementById('goalCarbsText');
  const goalFiber = document.getElementById('goalFiberText');
  if (goalProt)  goalProt.textContent  = `${g.protein} г цель`;
  if (goalFat)   goalFat.textContent   = `${g.fat} г цель`;
  if (goalCarbs) goalCarbs.textContent = `${g.carbs} г цель`;
  if (goalFiber) goalFiber.textContent = `${g.fiber} г цель`;

  // ── Progress bars ──
  setBar('barProtein', protein, g.protein);
  setBar('barFat',     fat,     g.fat);
  setBar('barCarbs',   carbs,   g.carbs);
  setBar('barFiber',   fiber,   g.fiber);

  // ── Daily micros ──
  renderDailyMicros(vitamins, minerals);
}

function setBar(id, value, goal) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, (value / goal) * 100) + '%';
}

/** Рендерит список дневного журнала */
export function renderLog(entries, { onDelete, onChangeMeal }) {
  const list = document.getElementById('logList');

  if (entries.length === 0) {
    list.innerHTML = '<div class="log-empty">Записей пока нет. Скажите что вы съели!</div>';
    return;
  }

  const MEALS = [
    { key: 'breakfast', icon: '🌅', name: 'Завтрак' },
    { key: 'lunch',     icon: '☀️', name: 'Обед' },
    { key: 'dinner',    icon: '🌙', name: 'Ужин' },
    { key: 'snack',     icon: '🍎', name: 'Перекус' },
  ];

  const groups = Object.groupBy(entries, (e) => e.meal ?? 'snack');

  list.innerHTML = MEALS
    .filter((m) => groups[m.key]?.length)
    .map((m) => {
      const items   = groups[m.key];
      const mealCal = items.reduce((sum, e) => sum + e.calories, 0);

      const rows = items.map((e) => {
        const time = new Date(e.timestamp).toLocaleTimeString('ru-RU', {
          hour: '2-digit', minute: '2-digit',
        });

        // Маленький бейдж в строке лога (только 1-2 самых важных)
        const allLabels = [...(e.healthLabels ?? []), ...(e.dietLabels ?? [])];
        const logBadge = buildBadges(allLabels, 1);

        return `
          <div class="log-item-shell">
            <div class="swipe-action swipe-action--delete" role="button" aria-label="Удалить">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
              <span>Удалить</span>
            </div>
            <div class="swipe-action swipe-action--edit" role="button" aria-label="Изменить приём">
              <span>Изменить</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
            <div class="log-item" data-id="${e.id}">
              <div class="log-item__left">
                <div class="log-item__name-row">
                  <span class="log-item__name">${escHtml(e.label)}</span>
                  ${logBadge ? `<span class="log-item__badge-wrap">${logBadge}</span>` : ''}
                </div>
                <div class="log-item__macros-row">
                  <span class="lm lm--cal"><span class="lm__icon">🔥</span>${e.calories}</span>
                  <span class="lm lm--prot"><span class="lm__icon">💪</span>${e.protein}г</span>
                  <span class="lm lm--fat"><span class="lm__icon">💧</span>${e.fat}г</span>
                  <span class="lm lm--carb"><span class="lm__icon">🌾</span>${e.carbs}г</span>
                </div>
                <span class="log-item__time">${time}</span>
              </div>
              <div class="log-item__right">
                <button class="log-item__delete" data-id="${e.id}" title="Удалить">×</button>
              </div>
            </div>
          </div>
          <div class="log-item-meal-picker" hidden>
            <button class="log-item-meal-btn" data-meal="breakfast"><span>🌅</span>Завтрак</button>
            <button class="log-item-meal-btn" data-meal="lunch"><span>☀️</span>Обед</button>
            <button class="log-item-meal-btn" data-meal="dinner"><span>🌙</span>Ужин</button>
            <button class="log-item-meal-btn" data-meal="snack"><span>🍎</span>Перекус</button>
          </div>`;
      }).join('');

      return `
        <div class="log-meal-group">
          <div class="log-meal-header">
            <div class="log-meal-header__badge log-meal-header__badge--${m.key}">${m.icon}</div>
            <span class="log-meal-header__name">${m.name}</span>
            <span class="log-meal-header__cal">${mealCal} ккал</span>
          </div>
          ${rows}
        </div>`;
    }).join('');

  // Кнопки удаления (fallback для мыши)
  list.querySelectorAll('.log-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => onDelete(btn.dataset.id));
  });

  // Свайп
  import('./swipe.js').then(({ makeSwipeable }) => {
    list.querySelectorAll('.log-item-shell').forEach((shell) => {
      const picker = shell.nextElementSibling;
      const id     = shell.querySelector('.log-item').dataset.id;
      makeSwipeable(shell, picker, {
        onDelete:     () => onDelete(id),
        onChangeMeal: (meal) => onChangeMeal(id, meal),
      });
    });
  });
}

// ── AI Диетолог ───────────────────────────────────────────

/** Переключает состояние кнопки AI-анализа */
export function setAiState(state) {
  const btn  = document.getElementById('aiBtn');
  const icon = document.getElementById('aiBtnIcon');
  if (!btn) return;

  btn.disabled = state === 'loading';
  btn.classList.toggle('ai-btn--loading', state === 'loading');

  if (icon) {
    icon.textContent = state === 'loading' ? '⏳' : '🧠';
  }
}

/** Открывает блок ответа и сбрасывает содержимое */
export function startAiResponse() {
  const wrap = document.getElementById('aiResponse');
  if (!wrap) return;
  wrap.style.display = '';
  wrap.innerHTML = '<div class="ai-response__text" id="aiText"></div>';
}

/** Добавляет кусочек текста в блок ответа */
export function appendAiChunk(text) {
  const el = document.getElementById('aiText');
  if (el) el.textContent += text;
}

/** Финализирует ответ — применяет markdown-форматирование и убирает курсор */
export function finalizeAiResponse() {
  const el = document.getElementById('aiText');
  if (!el) return;

  el.innerHTML = formatMarkdown(el.textContent);
  el.classList.add('done');
}

/** Показывает ошибку AI внутри блока ответа */
export function showAiError(message) {
  const wrap = document.getElementById('aiResponse');
  if (!wrap) return;
  wrap.style.display = '';
  wrap.innerHTML = `<div class="ai-response__error">${escHtml(message)}</div>`;
}

/** Показывает сообщение об ошибке */
export function showError(message) {
  const container = document.getElementById('resultContainer');
  const el = document.createElement('div');
  el.className = 'error-card animate-in';
  el.innerHTML = `
    <div class="error-card__icon">⚠</div>
    <div class="error-card__text">${escHtml(message)}</div>
  `;
  container.innerHTML = '';
  container.appendChild(el);
}

/** Обновляет отображение даты и состояние кнопок навигации */
export function setLogDate(date = new Date()) {
  const now  = new Date();
  const cap  = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const todayKey = _dateKey(now);
  const selKey   = _dateKey(date);
  const diffDays = Math.round((now - date) / 86400000);

  // Метка «Сегодня / Вчера / N дней назад»
  let dayLabel;
  if (selKey === todayKey) dayLabel = 'Сегодня';
  else if (diffDays === 1) dayLabel = 'Вчера';
  else                     dayLabel = `${diffDays} дн. назад`;

  const isToday = selKey === todayKey;

  // Заголовок даты
  const weekdayEl = document.getElementById('todayDate');
  if (weekdayEl) {
    weekdayEl.textContent = cap(
      date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
    );
  }

  // Метка в шапке даты
  const labelEl = document.getElementById('dayLabel');
  if (labelEl) {
    labelEl.textContent = dayLabel;
    labelEl.className = `dash-date-label${isToday ? '' : ' dash-date-label--past'}`;
  }

  // Дата в заголовке дневника
  const logDateEl = document.getElementById('logDate');
  if (logDateEl) {
    logDateEl.textContent = cap(
      date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    );
  }

  // Кнопка «→» отключена если просматриваем сегодня
  const nextBtn = document.getElementById('nextDayBtn');
  if (nextBtn) {
    nextBtn.disabled = isToday;
    nextBtn.setAttribute('aria-disabled', isToday);
  }
}

/** Внутренний хелпер: Date → 'YYYY-MM-DD' */
function _dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Дневные микронутриенты ────────────────────────────────

function renderDailyMicros(vitamins, minerals) {
  const wrap = document.getElementById('dailyMicros');
  if (!wrap) return;

  if (!vitamins?.length && !minerals?.length) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';

  const chip = (n) => {
    const pct       = Math.min(150, Math.round((n.value / n.dv) * 100));
    const fillPct   = Math.min(100, pct);
    const modifier  = pct >= 70 ? 'good' : pct >= 25 ? 'mid' : 'low';
    return `
      <div class="micro-chip micro-chip--${modifier}" title="${n.label}: ${n.value} ${n.unit} (${pct}% дн.н.)">
        <div class="micro-chip__name">${n.label}</div>
        <div class="micro-chip__value">${n.value}<small> ${n.unit}</small></div>
        <div class="micro-chip__bar"><div class="micro-chip__fill" style="width:${fillPct}%"></div></div>
        <div class="micro-chip__pct">${pct}%</div>
      </div>`;
  };

  const vitHtml = vitamins?.length
    ? `<p class="micro-chips__label">Витамины</p>
       <div class="micro-chips__row">${vitamins.map(chip).join('')}</div>`
    : '';
  const minHtml = minerals?.length
    ? `<p class="micro-chips__label">Минералы</p>
       <div class="micro-chips__row">${minerals.map(chip).join('')}</div>`
    : '';

  // Дефицитные нутриенты (< 50% нормы) для кнопки совета
  const allNutrients = [...(vitamins ?? []), ...(minerals ?? [])];
  const deficient    = allNutrients.filter((n) => n.dv && (n.value / n.dv) < 0.5);
  const tipBtnHtml   = deficient.length
    ? `<button class="micros-tip-btn" id="microsTipBtn">
         💡 Что съесть для восполнения?
       </button>
       <div class="micros-tip-response" id="microsTipResponse" style="display:none"></div>`
    : '';

  wrap.innerHTML = `
    <button class="daily-micros__toggle" id="dailyMicrosToggle" aria-expanded="${microsExpanded}">
      <span>Витамины и минералы за день</span>
      <svg class="daily-micros__chevron${microsExpanded ? ' rotated' : ''}"
           width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <div class="daily-micros__body${microsExpanded ? ' open' : ''}" id="dailyMicrosBody">
      ${vitHtml}${minHtml}
      ${tipBtnHtml}
    </div>`;

  wrap.querySelector('#dailyMicrosToggle').addEventListener('click', () => {
    microsExpanded = !microsExpanded;
    const body    = wrap.querySelector('#dailyMicrosBody');
    const chevron = wrap.querySelector('.daily-micros__chevron');
    body.classList.toggle('open', microsExpanded);
    chevron.classList.toggle('rotated', microsExpanded);
    wrap.querySelector('#dailyMicrosToggle').setAttribute('aria-expanded', microsExpanded);
  });

  // Кнопка совета нутрициолога
  wrap.querySelector('#microsTipBtn')?.addEventListener('click', () => {
    _fireMicrosTip(deficient, wrap);
  });
}

/** Запускает Groq-запрос по дефицитным нутриентам */
async function _fireMicrosTip(deficient, wrap) {
  const btn      = wrap.querySelector('#microsTipBtn');
  const respWrap = wrap.querySelector('#microsTipResponse');
  if (!btn || !respWrap) return;

  btn.disabled    = true;
  btn.textContent = '⏳ Думаю...';
  respWrap.style.display = '';
  respWrap.innerHTML     = '<div class="micros-tip-text" id="microsTipText"></div>';

  const { getNutrientTips } = await import('./ai-analysis.js');

  getNutrientTips(deficient, {
    onChunk: (text) => {
      const el = respWrap.querySelector('#microsTipText');
      if (el) el.textContent += text;
    },
    onDone: () => {
      btn.disabled    = false;
      btn.textContent = '💡 Что съесть для восполнения?';
      const el = respWrap.querySelector('#microsTipText');
      if (el) {
        el.innerHTML = formatMarkdown(el.textContent);
        el.classList.add('done');
      }
    },
    onError: (msg) => {
      btn.disabled    = false;
      btn.textContent = '💡 Что съесть для восполнения?';
      respWrap.innerHTML = `<div class="micros-tip-error">${escHtml(msg)}</div>`;
    },
  });
}

// ── Бейджи ────────────────────────────────────────────────

/**
 * Строит HTML бейджей из массива меток.
 * @param {string[]} labels
 * @param {number} max — максимальное количество
 * @returns {string}
 */
function buildBadges(labels, max = 4) {
  const shown = CARD_PRIORITY
    .filter((k) => labels.includes(k))
    .slice(0, max);

  return shown.map((key) => {
    const { color, label } = BADGE_CONFIG[key];
    return `<span class="badge badge--${color}">${label}</span>`;
  }).join('');
}

// ── Предупреждения ────────────────────────────────────────

function buildWarnings(nutrition) {
  const warnings = [];

  // Много сахара — больше 15 г на порцию
  if ((nutrition.sugar ?? 0) > 15) {
    warnings.push(`⚠ Много сахара: ${nutrition.sugar} г`);
  }

  // Высокий натрий — больше 600 мг (30% дневной нормы)
  const sodium = nutrition.minerals?.find((m) => m.key === 'sodium');
  if (sodium && sodium.value > 600) {
    warnings.push(`⚠ Высокий натрий: ${sodium.value} мг`);
  }

  return warnings.map((w) => `<div class="food-warning">${w}</div>`).join('');
}

// ── Модальное окно микронутриентов ────────────────────────

function openMicroModal(nutrition) {
  // Убираем старое модальное окно
  document.getElementById('microModal')?.remove();

  const allLabels = [...(nutrition.healthLabels ?? []), ...(nutrition.dietLabels ?? [])];
  const allBadges = buildBadges(allLabels, 12);

  // Витамины
  const vitRows = (nutrition.vitamins ?? []).map((v) => {
    const pct = Math.min(100, Math.round((v.value / v.dv) * 100));
    return `
      <div class="micro-row">
        <div class="micro-row__info">
          <span class="micro-row__label">${v.label}</span>
          <span class="micro-row__value">${v.value} ${v.unit}</span>
        </div>
        <div class="micro-bar">
          <div class="micro-bar__fill micro-bar__fill--vit" style="width:${pct}%"></div>
        </div>
        <span class="micro-row__pct">${pct}%</span>
      </div>`;
  }).join('');

  // Минералы
  const minRows = (nutrition.minerals ?? []).map((m) => {
    const pct = Math.min(100, Math.round((m.value / m.dv) * 100));
    const isSodiumHigh = m.key === 'sodium' && m.value > 600;
    return `
      <div class="micro-row${isSodiumHigh ? ' micro-row--warn' : ''}">
        <div class="micro-row__info">
          <span class="micro-row__label">${m.label}</span>
          <span class="micro-row__value">${m.value} ${m.unit}${isSodiumHigh ? ' ⚠' : ''}</span>
        </div>
        <div class="micro-bar">
          <div class="micro-bar__fill micro-bar__fill--min${isSodiumHigh ? ' micro-bar__fill--warn' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="micro-row__pct">${pct}%</span>
      </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.id = 'microModal';
  modal.className = 'micro-modal-overlay';
  modal.innerHTML = `
    <div class="micro-modal" role="dialog" aria-modal="true" aria-label="Микронутриенты">
      <div class="micro-modal__header">
        <div>
          <div class="micro-modal__title">${escHtml(nutrition.label)}</div>
          <div class="micro-modal__sub">${escHtml(nutrition.englishLabel)} · ${nutrition.calories} ккал · ${nutrition.weight ? nutrition.weight + ' г' : ''}</div>
        </div>
        <button class="micro-modal__close" aria-label="Закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      ${allBadges ? `<div class="micro-modal__badges">${allBadges}</div>` : ''}

      <div class="micro-modal__section">
        <div class="micro-modal__section-title">Витамины</div>
        <div class="micro-grid">${vitRows || '<div class="micro-empty">Нет данных</div>'}</div>
      </div>

      <div class="micro-modal__section">
        <div class="micro-modal__section-title">Минералы</div>
        <div class="micro-grid">${minRows || '<div class="micro-empty">Нет данных</div>'}</div>
      </div>

      <div class="micro-modal__note">% от суточной нормы взрослого человека</div>
    </div>
  `;

  document.body.appendChild(modal);

  // Закрытие
  const close = () => {
    modal.classList.add('micro-modal-overlay--out');
    modal.addEventListener('animationend', () => modal.remove(), { once: true });
  };

  modal.querySelector('.micro-modal__close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

  // Trigger in-animation
  requestAnimationFrame(() => modal.classList.add('micro-modal-overlay--in'));
}

// ── Профиль ───────────────────────────────────────────────

/** Обновляет аватар в хедере */
export function updateAvatar(name = '') {
  const el = document.getElementById('headerAvatar');
  if (!el) return;
  const words = name.trim().split(/\s+/).filter(Boolean);
  el.textContent = words.length
    ? words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
    : '?';
}

/**
 * Открывает модальное окно профиля.
 * @param {object|null} profile — текущий сохранённый профиль
 * @param {function} onSave — вызывается с новым профилем при сохранении
 * @param {function} calcGoals — функция расчёта целей
 */
export function openProfileModal(profile, onSave, calcGoals) {
  const overlay = document.getElementById('profileModalOverlay');
  if (!overlay) return;

  // Заполняем форму текущими данными
  const set = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
  set('pfName',   profile?.name   ?? '');
  set('pfAge',    profile?.age    ?? '');
  set('pfHeight', profile?.height ?? '');
  set('pfWeight', profile?.weight ?? '');

  // Сегментированные кнопки
  const activateSeg = (groupId, val) => {
    document.querySelectorAll(`#${groupId} .pf-seg__btn`).forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.val === String(val));
    });
  };
  if (profile?.gender)   activateSeg('pfGender',   profile.gender);
  if (profile?.activity) activateSeg('pfActivity', profile.activity);
  if (profile?.goal)     activateSeg('pfGoal',     profile.goal);

  // Клики по сегментам
  ['pfGender', 'pfGoal'].forEach((groupId) => {
    document.querySelectorAll(`#${groupId} .pf-seg__btn`).forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(`#${groupId} .pf-seg__btn`).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        updatePreview();
      });
    });
  });
  document.querySelectorAll('#pfActivity .pf-activity__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pfActivity .pf-activity__btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updatePreview();
    });
  });

  // Live-превью
  const previewEmpty = document.getElementById('pfPreviewEmpty');
  const previewGrid  = document.getElementById('pfPreviewGrid');

  function readForm() {
    const gender   = document.querySelector('#pfGender .pf-seg__btn.active')?.dataset.val;
    const activity = parseFloat(document.querySelector('#pfActivity .pf-activity__btn.active')?.dataset.val);
    const goal     = document.querySelector('#pfGoal .pf-seg__btn.active')?.dataset.val;
    const age      = parseInt(document.getElementById('pfAge')?.value);
    const height   = parseInt(document.getElementById('pfHeight')?.value);
    const weight   = parseInt(document.getElementById('pfWeight')?.value);
    return { gender, age, height, weight, activity, goal };
  }

  function updatePreview() {
    const data = readForm();
    const complete = data.gender && data.age > 0 && data.height > 0 && data.weight > 0 && data.activity && data.goal;
    if (!complete) {
      if (previewEmpty) previewEmpty.style.display = '';
      if (previewGrid)  previewGrid.style.display  = 'none';
      return;
    }
    const g = calcGoals(data);
    if (previewEmpty) previewEmpty.style.display = 'none';
    if (previewGrid)  previewGrid.style.display  = '';
    const v = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    v('pfCalVal',  g.calories);
    v('pfProtVal', g.protein);
    v('pfFatVal',  g.fat);
    v('pfCarbVal', g.carbs);
  }

  ['pfAge', 'pfHeight', 'pfWeight'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePreview);
  });

  updatePreview();

  // Открываем
  overlay.classList.add('open');

  // Закрытие
  const close = () => overlay.classList.remove('open');
  document.getElementById('pfCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Сохранение
  document.getElementById('pfSaveBtn').addEventListener('click', () => {
    const data = readForm();
    const name = document.getElementById('pfName')?.value.trim() ?? '';
    const newProfile = { ...data, name };
    onSave(newProfile);
    close();
  });
}

// ── Утилиты ──────────────────────────────────────────────

/** Конвертирует **жирный** и \n в HTML */
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start    = parseInt(el.textContent) || 0;
  const duration = 500;
  const t0       = performance.now();

  function step(now) {
    const p    = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (p < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
