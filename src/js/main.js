// ────────────────────────────────────────────────────────
//  main.js — точка входа, связывает все модули
// ────────────────────────────────────────────────────────

import { SpeechRecognizer }                       from './speech.js';
import { analyzeFood }                             from './nutrition.js';
import { getLogForDate, addEntry, removeEntry, updateEntry,
         clearDate, calcTotals, dateKeyOf }        from './storage.js';
import { setMicState, showTranscript, renderResult,
         updateTotals, renderLog, showError,
         setLogDate, setAiState, startAiResponse,
         appendAiChunk, finalizeAiResponse,
         showAiError, openProfileModal,
         updateAvatar }                            from './ui.js';
import { analyzeDiet }                             from './ai-analysis.js';
import { getProfile, saveProfile,
         calcGoals }                               from './profile.js';

// ── Состояние ────────────────────────────────────────────

let selectedDate = new Date();           // просматриваемая дата
let log          = loadLog();
let currentMeal  = detectMealByTime();
let profile      = getProfile();         // профиль пользователя
let goals        = calcGoals(profile);   // персональные цели КБЖУ

/** Загружает записи для выбранной даты */
function loadLog() {
  return getLogForDate(dateKeyOf(selectedDate));
}

/** Сегодня ли выбранная дата */
function isToday() {
  return dateKeyOf(selectedDate) === dateKeyOf(new Date());
}

// ── Инициализация UI ─────────────────────────────────────

setLogDate(selectedDate);
initMealTabs();
updateAvatar(profile?.name ?? '');
refreshUI();

// Онбординг-баннер при первом запуске
const onboardingBanner = document.getElementById('onboardingBanner');
if (!profile && onboardingBanner) {
  onboardingBanner.style.display = '';
  onboardingBanner.addEventListener('click', openProfile);
}

// ── Профиль ──────────────────────────────────────────────

function openProfile() {
  openProfileModal(profile, (newProfile) => {
    profile = newProfile;
    goals   = calcGoals(profile);
    saveProfile(profile);
    updateAvatar(profile.name ?? '');
    // Скрываем онбординг-баннер после первого сохранения
    if (onboardingBanner) onboardingBanner.style.display = 'none';
    refreshUI();
  }, calcGoals);
}

document.getElementById('profileBtn').addEventListener('click', openProfile);

// ── Навигация по датам ───────────────────────────────────

document.getElementById('prevDayBtn').addEventListener('click', () => {
  selectedDate = new Date(selectedDate);
  selectedDate.setDate(selectedDate.getDate() - 1);
  log = loadLog();
  setLogDate(selectedDate);
  refreshUI();
  // Сбрасываем результаты предыдущего запроса
  document.getElementById('resultContainer').innerHTML = '';
  document.getElementById('transcriptBox').style.display = 'none';
  document.getElementById('aiResponse').style.display = 'none';
});

document.getElementById('nextDayBtn').addEventListener('click', () => {
  if (isToday()) return; // нельзя переходить в будущее
  selectedDate = new Date(selectedDate);
  selectedDate.setDate(selectedDate.getDate() + 1);
  log = loadLog();
  setLogDate(selectedDate);
  refreshUI();
  document.getElementById('resultContainer').innerHTML = '';
  document.getElementById('transcriptBox').style.display = 'none';
  document.getElementById('aiResponse').style.display = 'none';
});

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

  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.meal === currentMeal);
  });

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

      // Если дата не сегодня — подменяем timestamp на выбранную дату
      let entry = { ...nutrition, meal: currentMeal };
      if (!isToday()) {
        const ts = new Date(selectedDate);
        ts.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
        entry = { ...entry, timestamp: ts.toISOString() };
      }

      addEntry(entry);
      log = loadLog();
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

// ── AI Диетолог ──────────────────────────────────────────

document.getElementById('aiBtn').addEventListener('click', () => {
  setAiState('loading');
  startAiResponse();

  analyzeDiet(log, calcTotals(log), {
    onChunk: (text) => appendAiChunk(text),
    onDone:  ()     => { finalizeAiResponse(); setAiState('idle'); },
    onError: (msg)  => { showAiError(msg);     setAiState('idle'); },
  });
});

// ── Сброс дневника ───────────────────────────────────────

document.getElementById('resetBtn').addEventListener('click', () => {
  const label = isToday() ? 'сегодня' : selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  if (!confirm(`Очистить дневник за ${label}?`)) return;
  clearDate(dateKeyOf(selectedDate));
  log = [];
  refreshUI();
  document.getElementById('resultContainer').innerHTML = '';
  document.getElementById('transcriptBox').style.display = 'none';
});

// ── Обновление всего UI ──────────────────────────────────

function refreshUI() {
  updateTotals(calcTotals(log), goals);
  renderLog(log, {
    onDelete: (id) => {
      removeEntry(id);
      log = loadLog();
      refreshUI();
    },
    onChangeMeal: (id, meal) => {
      updateEntry(id, { meal });
      log = loadLog();
      refreshUI();
    },
  });
}
