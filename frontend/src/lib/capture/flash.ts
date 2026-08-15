/**
 * One-shot confirmation hand-off between capture routes: saving on
 * /capture/note or /capture/review navigates back to /capture, which shows
 * the message. sessionStorage (not module state) so the confirmation
 * survives the navigation being a full reload (PWA relaunch, back gesture).
 */

const KEY = 'travelstream.pendingFlash';

export function setPendingFlash(message: string): void {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    /* storage full/blocked: losing a confirmation is acceptable */
  }
}

export function takePendingFlash(): string {
  try {
    const message = sessionStorage.getItem(KEY) ?? '';
    sessionStorage.removeItem(KEY);
    return message;
  } catch {
    return '';
  }
}
