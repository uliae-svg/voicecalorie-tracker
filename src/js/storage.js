// ────────────────────────────────────────────────────────
//  Storage — работа с дневником питания в localStorage
// ────────────────────────────────────────────────────────

const STORAGE_KEY = 'voicecalorie_log_v1';
const DAYS_TO_KEEP = 30;

/** @returns {string} локальная дата в формате YYYY-MM-DD */
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Извлекает локальную дату из ISO-строки timestamp */
function localDateOf(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Читает все записи из localStorage */
function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Сохраняет все записи в localStorage */
function writeAll(entries) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_KEEP);

  const trimmed = entries.filter(
    (e) => new Date(e.timestamp) > cutoff
  );

  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

/** Возвращает записи за сегодня */
export function getTodayLog() {
  const today = todayKey();
  return readAll().filter((e) => localDateOf(e.timestamp) === today);
}

/** Добавляет новую запись */
export function addEntry(entry) {
  const all = readAll();
  all.push(entry);
  writeAll(all);
}

/** Удаляет запись по id */
export function removeEntry(id) {
  const all = readAll().filter((e) => e.id !== id);
  writeAll(all);
}

/** Очищает записи за сегодня */
export function clearToday() {
  const today = todayKey();
  const all = readAll().filter((e) => localDateOf(e.timestamp) !== today);
  writeAll(all);
}

/**
 * Суммирует КБЖУ по массиву записей
 * @param {Array} entries
 * @returns {{ calories: number, protein: number, fat: number, carbs: number }}
 */
export function calcTotals(entries) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein:  acc.protein  + (e.protein  ?? 0),
      fat:      acc.fat      + (e.fat      ?? 0),
      carbs:    acc.carbs    + (e.carbs    ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  );
}
