/* RC ORDERA — no-polling safety net for menu updates missed during tab suspension.
 * Staff can keep their order open; this only reads the published menu.
 * Existing waiterAuthorize and waiterLoadMenu single-flight guards remain authoritative.
 */
(() => {
  "use strict";
  const MIN_FOCUS_REFRESH_MS = 20_000;
  let lastFocusRefreshAt = 0;

  function refreshPublishedMenuOnReturn() {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    if (!waiterClient || !waiterUser || !waiterStoreId ||
        !["waiter", "cashier", "manager"].includes(waiterMembership?.station)) return;
    // The existing authorization handler also runs on visibilitychange.
    // If it is refreshing, it will load the menu as part of authorization.
    if (waiterAuthorizeInFlight || waiterMenuLoadInFlight) return;
    const now = Date.now();
    if (now - lastFocusRefreshAt < MIN_FOCUS_REFRESH_MS) return;
    lastFocusRefreshAt = now;
    // Exactly one additional read on focus (never a loop, no timer).
    // Never overwrite a cart, pending order, or local draft.
    waiterLoadMenu().catch((error) => {
      console.warn("[RC ORDERA] La actualización del menú de estación requiere reintento manual.", error);
    });
  }

  document.addEventListener("visibilitychange", refreshPublishedMenuOnReturn);
  window.addEventListener("focus", refreshPublishedMenuOnReturn);
})();
