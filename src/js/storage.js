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

/** Преобразует объект Date в локальный ключ YYYY-MM-DD */
export function dateKeyOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

/** Возвращает записи за указанный день (dateKey = YYYY-MM-DD) */
export function getLogForDate(dateKey) {
  return readAll().filter((e) => localDateOf(e.timestamp) === dateKey);
}

/** Возвращает записи за сегодня */
export function getTodayLog() {
  return getLogForDate(todayKey());
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

/** Обновляет поля записи по id */
export function updateEntry(id, patch) {
  const all = readAll().map((e) => e.id === id ? { ...e, ...patch } : e);
  writeAll(all);
}

/** Очищает записи за указанный день */
export function clearDate(dateKey) {
  const all = readAll().filter((e) => localDateOf(e.timestamp) !== dateKey);
  writeAll(all);
}

/** Очищает записи за сегодня */
export function clearToday() {
  clearDate(todayKey());
}

/**
 * Суммирует КБЖУ + микронутриенты по массиву записей.
 * @param {Array} entries
 * @returns {{ calories, protein, fat, carbs, vitamins, minerals }}
 */
export function calcTotals(entries) {
  const base = entries.reduce(
    (acc, e) => ({
      calories: acc.calories + (e.calories ?? 0),
      protein:  acc.protein  + (e.protein  ?? 0),
      fat:      acc.fat      + (e.fat      ?? 0),
      carbs:    acc.carbs    + (e.carbs    ?? 0),
      fiber:    acc.fiber    + (e.fiber    ?? 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
  );

  return {
    ...base,
    vitamins: sumMicros(entries, 'vitamins'),
    minerals: sumMicros(entries, 'minerals'),
  };
}

/** Суммирует витамины или минералы из всех записей */
function sumMicros(entries, field) {
  const map = new Map();

  for (const e of entries) {
    for (const n of (e[field] ?? [])) {
      if (map.has(n.key)) {
        map.get(n.key).value += n.value;
      } else {
        map.set(n.key, { key: n.key, label: n.label, unit: n.unit, dv: n.dv, value: n.value });
      }
    }
  }

  return [...map.values()].map((n) => ({
    ...n,
    value: Math.round(n.value * 10) / 10,
  }));
}
