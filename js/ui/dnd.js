// Glisser-déposer universel (souris, stylet, doigt) basé sur les Pointer Events.
// Les zones de dépôt portent l'attribut data-drop="valeur".

export function startDrag(e, { ghost, data, onDrop, onStart, onEnd, threshold = 5 }) {
  if (e.button != null && e.button !== 0) return;
  const sx = e.clientX, sy = e.clientY;
  const src = e.currentTarget;
  let ghostEl = null;
  let over = null;
  let started = false;
  let ox = 0, oy = 0;

  const begin = () => {
    started = true;
    const r = src.getBoundingClientRect();
    ox = sx - r.left; oy = sy - r.top;
    ghostEl = (ghost ? ghost() : src.cloneNode(true));
    ghostEl.classList.add('drag-ghost');
    ghostEl.style.width = r.width + 'px';
    ghostEl.style.height = r.height + 'px';
    document.body.appendChild(ghostEl);
    src.classList.add('drag-src');
    document.documentElement.classList.add('is-dragging');
    onStart?.(data);
  };
  const move = (ev) => {
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return;
      begin();
    }
    ev.preventDefault();
    ghostEl.style.transform = `translate(${ev.clientX - ox}px, ${ev.clientY - oy}px) rotate(-2deg) scale(1.04)`;
    ghostEl.style.visibility = 'hidden';
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    ghostEl.style.visibility = '';
    const zone = el?.closest('[data-drop]');
    if (zone !== over) {
      over?.classList.remove('drop-over');
      over = zone;
      over?.classList.add('drop-over');
    }
  };
  const up = (ev) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    if (!started) return;
    over?.classList.remove('drop-over');
    src.classList.remove('drag-src');
    document.documentElement.classList.remove('is-dragging');
    const target = over?.dataset.drop;
    if (ghostEl) {
      ghostEl.classList.add('drop');
      setTimeout(() => ghostEl.remove(), 160);
    }
    if (target != null) onDrop?.(target, data, ev);
    onEnd?.();
    // Évite le « clic » qui suit un glisser.
    const stop = (c) => { c.stopPropagation(); c.preventDefault(); };
    window.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 50);
  };
  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    over?.classList.remove('drop-over');
    src.classList.remove('drag-src');
    document.documentElement.classList.remove('is-dragging');
    ghostEl?.remove();
    onEnd?.();
  };
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

/** Animation FLIP : les éléments glissent de leur ancienne à leur nouvelle position. */
export function flip(container, selector = '[data-flip]', duration = 420) {
  if (!container) return () => {};
  const first = new Map();
  container.querySelectorAll(selector).forEach((el) => first.set(el.dataset.flip, el.getBoundingClientRect()));
  return () => {
    container.querySelectorAll(selector).forEach((el) => {
      const a = first.get(el.dataset.flip);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  };
}
