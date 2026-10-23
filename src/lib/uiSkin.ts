/**
 * The enterprise look (styles/enterprise.css) is switched on by `<html data-ui="enterprise">`.
 *
 * On a computer it is on everywhere. On a phone the Sales app — what installs to the home
 * screen, and the sign-in it opens on — keeps its phone look (big top bar, chat-style
 * lists, bottom tabs), so the attribute is taken off there. Everything else stays enterprise
 * on a phone too.
 */
const PHONE_APP = /^\/(sales|login)(\/|$)/;
const PHONE = "(max-width: 767px)";

export function isPhoneApp(pathname: string): boolean {
  return PHONE_APP.test(pathname) && typeof window !== "undefined" && window.matchMedia(PHONE).matches;
}

export function applySkin(pathname: string): void {
  const html = document.documentElement;
  if (isPhoneApp(pathname)) delete html.dataset.ui;
  else html.dataset.ui = "enterprise";
}

/** Re-applies the skin when the window crosses the phone width (a rotated tablet, a resized window). */
export function followSkinOnResize(): void {
  window.matchMedia(PHONE).addEventListener("change", () => applySkin(window.location.pathname));
}
