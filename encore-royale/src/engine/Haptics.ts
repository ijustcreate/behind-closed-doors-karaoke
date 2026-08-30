export type HapticPattern = number | number[];

export function haptic(pattern: HapticPattern): void {
  if (document.visibilityState !== 'visible' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* Optional on unsupported phones. */ }
}
