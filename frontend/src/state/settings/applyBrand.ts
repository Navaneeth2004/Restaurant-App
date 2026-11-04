import { safeHex, shade } from 'lib/browser/color';

const STYLE_ID = '__brand_override';

/** Brand colour is validated first: server text never reaches the <style> tag unchecked. */
export function applyBrand(input: string | undefined): void {
  const hex = safeHex(input);
  const dark = shade(hex, -15);
  const text = shade(hex, 12);

  let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement('style');
    tag.id = STYLE_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `
    .bg-brand-500, .hover\\:bg-brand-500:hover { background-color: ${hex} !important; }
    .bg-brand-600, .hover\\:bg-brand-600:hover { background-color: ${dark} !important; }
    .bg-brand-500\\/8, .bg-brand-500\\/10 { background-color: ${hex}14 !important; }
    .bg-brand-500\\/15, .bg-brand-500\\/20 { background-color: ${hex}26 !important; }
    .hover\\:bg-brand-500\\/25:hover { background-color: ${hex}40 !important; }
    .text-brand-400, .text-brand-500, .hover\\:text-brand-400:hover { color: ${text} !important; }
    .border-brand-500, .border-brand-600 { border-color: ${hex} !important; }
    .border-brand-500\\/25, .border-brand-500\\/30 { border-color: ${hex}4d !important; }
    .border-brand-500\\/60 { border-color: ${hex}99 !important; }
    .ring-brand-500, .focus\\:ring-brand-500 { --tw-ring-color: ${hex} !important; }
    .focus\\:border-brand-500 { border-color: ${hex} !important; }
    .gradient-brand { background: linear-gradient(135deg, ${hex}, ${dark}) !important; }
  `;
  const root = document.documentElement.style;
  root.setProperty('--brand', hex);
  root.setProperty('--brand-dark', dark);
  root.setProperty('--brand-text', text);
}
