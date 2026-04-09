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

let log = getTodayLog();

// ── Инициализация UI ─────────────────────────────────────

setLogDate();
refreshUI();

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

      // Обновляем transcript с переводом
      showTranscript(text, nutrition.englishLabel);

      // Рендерим карточку
      renderResult(nutrition);

      // Сохраняем в дневник
      addEntry(nutrition);
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
  const totals = calcTotals(log);
  updateTotals(totals);
  renderLog(log, (id) => {
    removeEntry(id);
    log = getTodayLog();
    refreshUI();
  });
}
