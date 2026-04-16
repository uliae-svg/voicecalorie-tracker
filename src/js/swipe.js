// ────────────────────────────────────────────────────────
//  swipe.js — свайп-жесты для строк дневника
//  Влево → удалить   Вправо → изменить приём пищи
// ────────────────────────────────────────────────────────

const STAY_OPEN_PX   = 55;   // при отпускании — остаётся открытым
const AUTO_DELETE_PX = 160;  // при отпускании — авто-удаление
const DELETE_W       = 76;   // ширина зоны удаления (px)
const EDIT_W         = 90;   // ширина зоны редактирования (px)

/**
 * @param {HTMLElement} shell   — .log-item-shell
 * @param {HTMLElement} picker  — .log-item-meal-picker (следующий сиблинг)
 * @param {{ onDelete: () => void, onChangeMeal: (meal: string) => void }} cbs
 */
export function makeSwipeable(shell, picker, { onDelete, onChangeMeal }) {
  const item   = shell.querySelector('.log-item');
  const bgDel  = shell.querySelector('.swipe-action--delete');
  const bgEdit = shell.querySelector('.swipe-action--edit');

  // AbortController — снимает все глобальные слушатели когда элемент удаляется
  const ac = new AbortController();
  const { signal } = ac;

  // Когда shell уходит из DOM (после анимации удаления) — чистим всё
  new MutationObserver((_, obs) => {
    if (!document.contains(shell)) { ac.abort(); obs.disconnect(); }
  }).observe(document.body, { childList: true, subtree: true });

  let startX = 0, startY = 0, curDx = 0;
  let tracking = false, isHoriz = null;
  let openSide = null; // null | 'delete' | 'edit'

  // ── Позиционирование ─────────────────────────────────

  function setX(x, spring = false) {
    item.style.transition = spring
      ? 'transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1)'
      : 'none';
    item.style.transform = x === 0 ? '' : `translateX(${x}px)`;
  }

  function close(spring = true) {
    setX(0, spring);
    openSide = null;
  }

  function openDelete() { setX(-DELETE_W, true); openSide = 'delete'; }
  function openEdit()   { setX(EDIT_W,    true); openSide = 'edit';   }

  // ── Анимация удаления ─────────────────────────────────

  function doDelete() {
    item.style.transition = 'transform 0.26s ease-in, opacity 0.22s ease-in';
    item.style.transform  = 'translateX(-110%)';
    item.style.opacity    = '0';
    if (picker) picker.hidden = true;

    const h = shell.offsetHeight;
    shell.style.overflow   = 'hidden';
    shell.style.maxHeight  = h + 'px';
    shell.style.transition = 'max-height 0.3s ease 0.18s, margin-bottom 0.3s ease 0.18s';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      shell.style.maxHeight    = '0';
      shell.style.marginBottom = '0';
    }));

    setTimeout(onDelete, 520);
  }

  // ── Жест: touch ───────────────────────────────────────

  item.addEventListener('touchstart', (e) => {
    if (openSide) { close(); return; }
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY;
    curDx = 0; isHoriz = null; tracking = true;
  }, { passive: true });

  item.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (isHoriz === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isHoriz = Math.abs(dx) > Math.abs(dy);
      if (!isHoriz) { tracking = false; return; }
    }
    if (!isHoriz) return;
    curDx = dx;
    setX(Math.max(-(AUTO_DELETE_PX + 20), Math.min(EDIT_W + 16, curDx)));
  }, { passive: true });

  item.addEventListener('touchend',   finishGesture);
  item.addEventListener('touchcancel', () => { tracking = false; close(); });

  // ── Жест: мышь (для тестирования на десктопе) ─────────

  let mouseHeld = false;

  item.addEventListener('mousedown', (e) => {
    if (openSide) { close(); return; }
    startX = e.clientX; startY = e.clientY;
    curDx = 0; isHoriz = null; tracking = true; mouseHeld = true;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!mouseHeld || !tracking) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (isHoriz === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isHoriz = Math.abs(dx) > Math.abs(dy);
      if (!isHoriz) { tracking = false; return; }
    }
    if (!isHoriz) return;
    curDx = dx;
    setX(Math.max(-(AUTO_DELETE_PX + 20), Math.min(EDIT_W + 16, curDx)));
  }, { signal });

  window.addEventListener('mouseup', () => {
    if (mouseHeld) { mouseHeld = false; finishGesture(); }
  }, { signal });

  function finishGesture() {
    if (!tracking) return;
    tracking = false;
    if      (curDx < -AUTO_DELETE_PX) doDelete();
    else if (curDx < -STAY_OPEN_PX)   openDelete();
    else if (curDx >  STAY_OPEN_PX)   openEdit();
    else                              close();
  }

  // ── Кнопки в раскрытых зонах ──────────────────────────

  bgDel?.addEventListener('click', doDelete);

  bgEdit?.addEventListener('click', () => {
    close();
    if (picker) picker.hidden = !picker.hidden;
  });

  // Тап по item когда открыто → закрыть
  item.addEventListener('click', () => {
    if (openSide) { close(); return; }
  });

  // Кнопки выбора приёма пищи
  picker?.querySelectorAll('[data-meal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      picker.hidden = true;
      onChangeMeal(btn.dataset.meal);
    });
  });

  // Глобальный тап вне — закрыть пикер
  document.addEventListener('click', (e) => {
    if (picker && !picker.hidden &&
        !shell.contains(e.target) &&
        !picker.contains(e.target)) {
      picker.hidden = true;
    }
  }, { signal });
}
