// ────────────────────────────────────────────────────────
//  profile.js — профиль пользователя и расчёт целей КБЖУ
// ────────────────────────────────────────────────────────

const PROFILE_KEY = 'voicefood_profile_v1';

/** Загружает профиль из localStorage или возвращает null */
export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Сохраняет профиль в localStorage */
export function saveProfile(data) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
}

/**
 * Рассчитывает персональные цели по формуле Миффлина-Сан Жеора.
 * Если профиль не заполнен — возвращает стандартные значения.
 * @param {object|null} profile
 * @returns {{ calories, protein, fat, carbs, fiber }}
 */
export function calcGoals(profile) {
  if (!profile) {
    return { calories: 2000, protein: 150, fat: 65, carbs: 250, fiber: 30 };
  }

  const { gender, age, height, weight, activity, goal } = profile;

  // ── BMR (базовый обмен) ──────────────────────────────
  const bmr = gender === 'f'
    ? 10 * weight + 6.25 * height - 5 * age - 161
    : 10 * weight + 6.25 * height - 5 * age + 5;

  // ── TDEE (с учётом активности) ───────────────────────
  const tdee = bmr * (activity ?? 1.375);

  // ── Коррекция на цель ────────────────────────────────
  const calMultiplier = goal === 'loss' ? 0.80 : goal === 'gain' ? 1.15 : 1.0;
  const calories = Math.round(tdee * calMultiplier);

  // ── Макронутриенты ───────────────────────────────────
  // Белки: г/кг веса (больше при дефиците — сохранение мышц)
  const protPerKg = goal === 'loss' ? 2.0 : goal === 'gain' ? 1.8 : 1.6;
  const protein   = Math.round(weight * protPerKg);

  // Жиры: 30% от калорий
  const fat = Math.round((calories * 0.30) / 9);

  // Углеводы: остаток (не менее 50г)
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));

  // Клетчатка: норма ВОЗ по полу
  const fiber = gender === 'f' ? 25 : 38;

  return { calories, protein, fat, carbs, fiber };
}

/**
 * Возвращает инициалы из имени (1–2 заглавных буквы).
 * «Юлия Иванова» → «ЮИ», «Юлия» → «Ю», '' → '?'
 */
export function getInitials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}
