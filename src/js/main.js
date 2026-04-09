// ────────────────────────────────────────────────────────
//  main.js — точка входа, связывает все модули
// ────────────────────────────────────────────────────────

import { SpeechRecognizer }                       from './speech.js';
import { analyzeFood }                             from './nutrition.js';
import { getTodayLog, addEntry, removeEntry,
         clearToday, calcTotals }                  from './storage.js';
import { setMicState, showTranscript, renderResult,
         updateTotals, renderLog, showError,
         setLogDate }                              from './ui.js';

// ── Состояние ────────────────────────────────────────────

let log         = getTodayLog();
let currentMeal = detectMealByTime();

// ── Инициализация UI ─────────────────────────────────────

setLogDate();
initMealTabs();
refreshUI();

// ── Meal Tabs ─────────────────────────────────────────────

/** Определяет приём пищи по текущему времени суток */
function detectMealByTime() {
  const hour = new Date().getHours();
  if (hour >= 6  && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 16) return 'lunch';
  if (hour >= 16 && hour < 22) return 'dinner';
  return 'snack';
}

function initMealTabs() {
  const tabs = document.querySelectorAll('.meal-tab');

  // Активируем таб по времени суток
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.meal === currentMeal);
  });

  // Слушаем клики
  document.getElementById('mealTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.meal-tab');
    if (!tab) return;

    currentMeal = tab.dataset.meal;

    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
  });
}

// ── Speech Recognizer ────────────────────────────────────

const recognizer = new SpeechRecognizer({
  onStart() {
    setMicState('listening');
  },

  async onResult(text) {
    setMicState('processing');
    showTranscript(text);

    try {
      const nutrition = await analyzeFood(text);

      showTranscript(text, nutrition.englishLabel);
      renderResult(nutrition);

      // Сохраняем с текущим приёмом пищи
      addEntry({ ...nutrition, meal: currentMeal });
      log = getTodayLog();
      refreshUI();

    } catch (err) {
      showError(err.message);
      setMicState('idle');
    }
  },

  onEnd() {
    setMicState('idle');
  },

  onError(msg) {
    showError(msg);
    setMicState('idle');
  },
});

// ── Кнопка микрофона ─────────────────────────────────────

document.getElementById('micBtn').addEventListener('click', () => {
  if (recognizer.isListening) {
    recognizer.stop();
  } else {
    document.getElementById('resultContainer').innerHTML = '';
    document.getElementById('transcriptBox').style.display = 'none';
    recognizer.start();
  }
});

// ── Сброс дневника ───────────────────────────────────────

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Очистить дневник за сегодня?')) return;
  clearToday();
  log = [];
  refreshUI();
  document.getElementById('resultContainer').innerHTML = '';
  document.getElementById('transcriptBox').style.display = 'none';
});

// ── Обновление всего UI ──────────────────────────────────

function refreshUI() {
  updateTotals(calcTotals(log));
  renderLog(log, (id) => {
    removeEntry(id);
    log = getTodayLog();
    refreshUI();
  });
}
