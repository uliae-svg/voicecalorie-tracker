// ────────────────────────────────────────────────────────
//  UI — функции рендеринга DOM
// ────────────────────────────────────────────────────────

/** Переключает состояние кнопки микрофона
 * @param {'idle' | 'listening' | 'processing'} state
 */
export function setMicState(state) {
  const btn  = document.getElementById('micBtn');
  const hint = document.getElementById('micHint');

  btn.classList.remove('listening', 'processing');

  const hints = {
    idle:       'Нажмите и скажите что вы съели',
    listening:  'Слушаю... говорите',
    processing: 'Анализирую...',
  };

  if (state !== 'idle') btn.classList.add(state);
  hint.textContent = hints[state];

  document.getElementById('loading').style.display =
    state === 'processing' ? 'flex' : 'none';
}

/** Показывает распознанный текст
 * @param {string} original   — русский текст
 * @param {string} [translated] — английский перевод
 */
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

/** Рендерит карточку с результатом анализа
 * @param {import('./nutrition.js').NutritionResult} nutrition
 */
export function renderResult(nutrition) {
  const container = document.getElementById('resultContainer');

  const card = document.createElement('div');
  card.className = 'food-card animate-in';
  card.dataset.id = nutrition.id;

  const time = new Date(nutrition.timestamp).toLocaleTimeString('ru-RU', {
    hour: '2-digit', minute: '2-digit',
  });

  card.innerHTML = `
    <div class="food-card__header">
      <div class="food-card__name">${escHtml(nutrition.label)}</div>
      <div class="food-card__meta">
        <span class="food-card__en">${escHtml(nutrition.englishLabel)}</span>
        <span class="food-card__time">${time}</span>
      </div>
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
    ${nutrition.weight ? `<div class="food-card__weight">≈ ${nutrition.weight} г продукта</div>` : ''}
  `;

  container.innerHTML = '';
  container.appendChild(card);
}

/** Обновляет суммарные показатели в шапке
 * @param {{ calories: number, protein: number, fat: number, carbs: number }} totals
 */
export function updateTotals(totals) {
  animateNumber('totalCalories', totals.calories);
  document.getElementById('totalProtein').textContent = totals.protein + 'г';
  document.getElementById('totalFat').textContent     = totals.fat     + 'г';
  document.getElementById('totalCarbs').textContent   = totals.carbs   + 'г';
}

/** Рендерит список дневного журнала
 * @param {Array} entries
 * @param {(id: string) => void} onDelete
 */
export function renderLog(entries, onDelete) {
  const list = document.getElementById('logList');

  if (entries.length === 0) {
    list.innerHTML = '<div class="log-empty">Записей пока нет. Скажите что вы съели!</div>';
    return;
  }

  list.innerHTML = entries.map((e) => {
    const time = new Date(e.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit', minute: '2-digit',
    });
    return `
      <div class="log-item" data-id="${e.id}">
        <div class="log-item__left">
          <span class="log-item__name">${escHtml(e.label)}</span>
          <span class="log-item__time">${time}</span>
        </div>
        <div class="log-item__right">
          <span class="log-item__cal">${e.calories} ккал</span>
          <span class="log-item__macros">${e.protein}б / ${e.fat}ж / ${e.carbs}у</span>
        </div>
        <button class="log-item__delete" data-id="${e.id}" title="Удалить">×</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.log-item__delete').forEach((btn) => {
    btn.addEventListener('click', () => onDelete(btn.dataset.id));
  });
}

/** Показывает сообщение об ошибке
 * @param {string} message
 */
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

/** Устанавливает текущую дату в журнале */
export function setLogDate() {
  const now = new Date();

  const shortDate = now.toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // «Сегодня, Четверг, 10 апреля» — заглавная первая буква
  const todayStr = 'Сегодня, ' + shortDate.charAt(0).toUpperCase() + shortDate.slice(1);

  document.getElementById('todayDate').textContent = todayStr;

  // Журнал внизу — только «Четверг, 10 апреля» без «Сегодня»
  document.getElementById('logDate').textContent =
    shortDate.charAt(0).toUpperCase() + shortDate.slice(1);
}

// ── Утилиты ──────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const duration = 400;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}
