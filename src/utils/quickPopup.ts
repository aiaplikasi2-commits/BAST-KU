export interface QuickPopupItem {
  id: number;
  message: string;
  variant: 'success' | 'info' | 'warning';
}

type PopupListener = (item: QuickPopupItem | null) => void;

const listeners = new Set<PopupListener>();
let currentPopup: QuickPopupItem | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let lastExplicitTimestamp = 0;

export function showQuickPopup(
  message: string,
  variant: 'success' | 'info' | 'warning' = 'success',
  isExplicit = true
) {
  const clean = message.replace(/\s+/g, ' ').trim();
  if (!clean) return;

  const now = Date.now();
  // If an explicit action popup was just shown within 250ms, don't overwrite it with generic button click text
  if (!isExplicit && now - lastExplicitTimestamp < 250) {
    return;
  }
  if (isExplicit) {
    lastExplicitTimestamp = now;
  }

  currentPopup = {
    id: now + Math.random(),
    message: clean.slice(0, 110),
    variant,
  };

  listeners.forEach((cb) => cb(currentPopup));

  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  hideTimer = setTimeout(() => {
    currentPopup = null;
    listeners.forEach((cb) => cb(null));
  }, 1800);
}

export function subscribeQuickPopup(cb: PopupListener): () => void {
  listeners.add(cb);
  if (currentPopup) {
    cb(currentPopup);
  }
  return () => {
    listeners.delete(cb);
  };
}
