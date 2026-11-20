/**
 * BUTTON WEB UI KIT — Autonomous SVG Icon & Component Engine
 * Usage in HTML:
 *   <span data-bw-icon="cart"></span>
 *   <span data-bw-icon="search" data-bw-size="22"></span>
 * Usage in JS:
 *   ButtonWebIcons.getSvg('heart', { size: 20 })
 */
(function (global) {
  const ICONS = {
  "01_search": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"14\" cy=\"14\" r=\"8.5\"/><line x1=\"20.2\" y1=\"20.2\" x2=\"27\" y2=\"27\"/></svg>",
  "02_check": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"6,16.5 12.8,23.2 26,9\"/></svg>",
  "03_close": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"><line x1=\"8\" y1=\"8\" x2=\"24\" y2=\"24\"/><line x1=\"24\" y1=\"8\" x2=\"8\" y2=\"24\"/></svg>",
  "04_chevron_down": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"8,12 16,20 24,12\"/></svg>",
  "05_chevron_right": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"12,7 21,16 12,25\"/></svg>",
  "06_chevron_left": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"20,7 11,16 20,25\"/></svg>",
  "07_caret_up": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"9,20 16,12 23,20\"/></svg>",
  "08_caret_down": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"9,12 16,20 23,12\"/></svg>",
  "09_help": "<svg viewBox=\"0 0 32 32\" fill=\"none\"><path d=\"M12.5 11.5C12.5 9.6 14.1 8 16.2 8C18.3 8 19.8 9.4 19.8 11.3C19.8 12.8 18.9 13.7 17.5 14.6C16.3 15.4 15.8 16.2 15.8 17.8V18.5\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><circle cx=\"15.8\" cy=\"23\" r=\"1.6\" fill=\"currentColor\"/></svg>",
  "10_facebook": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><path d=\"M18.5 27V17.2H21.8L22.3 13.3H18.5V10.8C18.5 9.7 18.8 8.9 20.4 8.9H22.5V5.4C22.1 5.3 20.9 5.2 19.5 5.2C16.5 5.2 14.5 7 14.5 10.4V13.3H11.2V17.2H14.5V27H18.5Z\"/></svg>",
  "11_twitter": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><path d=\"M27.2 9.3C26.4 9.7 25.5 9.9 24.6 10C25.5 9.4 26.2 8.5 26.6 7.5C25.7 8 24.7 8.4 23.7 8.6C22.9 7.7 21.7 7.1 20.4 7.1C17.9 7.1 15.9 9.1 15.9 11.6C15.9 12 15.9 12.3 16 12.6C12.3 12.4 9 10.6 6.8 7.9C6.4 8.6 6.2 9.4 6.2 10.2C6.2 11.8 7 13.1 8.2 13.9C7.5 13.9 6.8 13.7 6.2 13.3V13.4C6.2 15.6 7.8 17.4 9.8 17.8C9.4 17.9 9 18 8.6 18C8.3 18 8 18 7.7 17.9C8.3 19.7 10 21 11.9 21C10.4 22.2 8.4 22.9 6.3 22.9C5.9 22.9 5.6 22.9 5.2 22.8C7.2 24.1 9.6 24.9 12.1 24.9C20.4 24.9 24.9 18 24.9 12.1C24.9 11.9 24.9 11.7 24.9 11.5C25.8 10.9 26.6 10.1 27.2 9.3Z\"/></svg>",
  "12_google_plus": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><path d=\"M12.6 14.2C14.6 14.2 16 12.7 16 10.4C16 8.4 14.9 7.1 13.7 6.5H16.8L18.2 5H12.2C8.8 5 6.6 7.1 6.6 9.9C6.6 12 8.1 13.8 10.4 14.1C10.1 14.5 9.9 15 9.9 15.6C9.9 16.5 10.4 17.1 11.1 17.6C8.3 17.8 5.6 19.2 5.6 22C5.6 24.6 8.3 26.5 12.2 26.5C16.4 26.5 18.8 24.2 18.8 21.5C18.8 19.4 17.5 18.3 15.1 16.7L13.8 15.8C13.3 15.4 13 15.1 13 14.6C13 14.3 13.1 14.2 12.6 14.2ZM9.4 9.7C9.4 8 10.5 6.7 12.1 6.7C13.8 6.7 14.9 8.3 14.9 10.2C14.9 11.9 13.8 13.1 12.2 13.1C10.5 13.1 9.4 11.5 9.4 9.7ZM12.1 24.9C9.6 24.9 8 23.6 8 21.8C8 20.1 9.6 19 12.2 18.9C12.9 18.9 13.5 19 14.1 19.2C15.5 20.2 16.5 20.8 16.5 22.1C16.5 23.8 14.8 24.9 12.1 24.9ZM24.5 11.5V8.5H22.7V11.5H19.7V13.3H22.7V16.3H24.5V13.3H27.5V11.5H24.5Z\"/></svg>",
  "13_pin_solid": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M16 3C10.2 3 5.5 7.7 5.5 13.5C5.5 20.8 16 29 16 29C16 29 26.5 20.8 26.5 13.5C26.5 7.7 21.8 3 16 3ZM16 17.2C13.8 17.2 12 15.4 12 13.2C12 11 13.8 9.2 16 9.2C18.2 9.2 20 11 20 13.2C20 15.4 18.2 17.2 16 17.2Z\"/></svg>",
  "14_pin_outline": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\"><path d=\"M16 4C10.8 4 6.5 8.2 6.5 13.5C6.5 20.1 16 28 16 28C16 28 25.5 20.1 25.5 13.5C25.5 8.2 21.2 4 16 4Z\"/><circle cx=\"16\" cy=\"13.2\" r=\"3.5\"/></svg>",
  "15_email": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"><rect x=\"4\" y=\"7\" width=\"24\" height=\"18\" rx=\"1.5\"/><polyline points=\"4.5,8 16,17.5 27.5,8\"/><line x1=\"4.5\" y1=\"24\" x2=\"12.5\" y2=\"16\"/><line x1=\"27.5\" y1=\"24\" x2=\"19.5\" y2=\"16\"/></svg>",
  "16_phone": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><path d=\"M6 11.5C10.8 8.3 21.2 8.3 26 11.5C26.9 12.1 27.3 13.2 26.8 14.2L25.2 16.5C24.7 17.2 23.6 17.3 22.8 16.8L20.5 15.2C19.9 14.8 19.5 14.1 19.5 13.3V11.8C17.2 11.3 14.8 11.3 12.5 11.8V13.3C12.5 14.1 12.1 14.8 11.5 15.2L9.2 16.8C8.4 17.3 7.3 17.2 6.8 16.5L5.2 14.2C4.7 13.2 5.1 12.1 6 11.5ZM10.5 16.5H21.5L24.5 22.5C24.9 23.3 24.3 24.2 23.4 24.2H8.6C7.7 24.2 7.1 23.3 7.5 22.5L10.5 16.5Z\"/></svg>",
  "17_calendar": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><rect x=\"4\" y=\"6\" width=\"24\" height=\"21\" rx=\"1.5\"/><line x1=\"4\" y1=\"12\" x2=\"28\" y2=\"12\"/><line x1=\"10\" y1=\"3.5\" x2=\"10\" y2=\"8\"/><line x1=\"22\" y1=\"3.5\" x2=\"22\" y2=\"8\"/><rect x=\"8.5\" y=\"15\" width=\"3\" height=\"3\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"14.5\" y=\"15\" width=\"3\" height=\"3\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"20.5\" y=\"15\" width=\"3\" height=\"3\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"8.5\" y=\"20.5\" width=\"3\" height=\"3\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"14.5\" y=\"20.5\" width=\"3\" height=\"3\" fill=\"currentColor\" stroke=\"none\"/><rect x=\"20.5\" y=\"20.5\" width=\"3\" height=\"3\" fill=\"currentColor\" stroke=\"none\"/></svg>",
  "18_clock": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"16\" cy=\"16\" r=\"11.5\"/><polyline points=\"16,9.5 16,16.5 21,16.5\"/></svg>",
  "19_cart": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><path d=\"M4 5.5H7.8L10.6 18.5H24.2L27.2 9.5H9.2\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M9.5 9.5H26.8L24.2 17.8H11.2L9.5 9.5Z\"/><circle cx=\"12.2\" cy=\"24.2\" r=\"2.5\"/><circle cx=\"22.5\" cy=\"24.2\" r=\"2.5\"/></svg>",
  "20_heart": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M16 26.8C16 26.8 4.5 19.2 4.5 11.3C4.5 7.5 7.5 4.8 11 4.8C13.3 4.8 15.1 6 16 7.7C16.9 6 18.7 4.8 21 4.8C24.5 4.8 27.5 7.5 27.5 11.3C27.5 19.2 16 26.8 16 26.8Z\"/></svg>",
  "21_plus": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"round\"><line x1=\"16\" y1=\"7\" x2=\"16\" y2=\"25\"/><line x1=\"7\" y1=\"16\" x2=\"25\" y2=\"16\"/></svg>",
  "22_minus": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"round\"><line x1=\"7\" y1=\"16\" x2=\"25\" y2=\"16\"/></svg>",
  "23_star": "<svg viewBox=\"0 0 32 32\" fill=\"currentColor\"><polygon points=\"16,3.5 19.9,11.4 28.6,12.7 22.3,18.8 23.8,27.5 16,23.4 8.2,27.5 9.7,18.8 3.4,12.7 12.1,11.4\"/></svg>",
  "24_slideshow": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"26\" height=\"22\" rx=\"2\"/><path d=\"M5 23L11.5 15.5L16.5 20.5L21 15L27 23H5Z\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"21.5\" cy=\"10.5\" r=\"2.2\" fill=\"currentColor\" stroke=\"none\"/></svg>",
  "25_arrow_left": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"26\" y1=\"16\" x2=\"6\" y2=\"16\"/><polyline points=\"13,9 6,16 13,23\"/></svg>",
  "26_arrow_right": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"6\" y1=\"16\" x2=\"26\" y2=\"16\"/><polyline points=\"19,9 26,16 19,23\"/></svg>",
  "27_circle_check": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"16\" cy=\"16\" r=\"12.5\"/><polyline points=\"10.5,16.5 14.5,20.5 22,12.5\"/></svg>",
  "28_circle_error": "<svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\"><circle cx=\"16\" cy=\"16\" r=\"12.5\"/><line x1=\"11.5\" y1=\"11.5\" x2=\"20.5\" y2=\"20.5\"/><line x1=\"20.5\" y1=\"11.5\" x2=\"11.5\" y2=\"20.5\"/></svg>"
};
  const ALIASES = {
  "search": "01_search",
  "lupa": "01_search",
  "find": "01_search",
  "check": "02_check",
  "success": "02_check",
  "tick": "02_check",
  "ok": "02_check",
  "close": "03_close",
  "error": "03_close",
  "x": "03_close",
  "clear": "03_close",
  "chevron_down": "04_chevron_down",
  "down": "04_chevron_down",
  "select": "04_chevron_down",
  "chevron_right": "05_chevron_right",
  "right": "05_chevron_right",
  "next": "05_chevron_right",
  "chevron_left": "06_chevron_left",
  "left": "06_chevron_left",
  "back": "06_chevron_left",
  "prev": "06_chevron_left",
  "caret_up": "07_caret_up",
  "up": "07_caret_up",
  "caret_down": "08_caret_down",
  "help": "09_help",
  "question": "09_help",
  "facebook": "10_facebook",
  "fb": "10_facebook",
  "twitter": "11_twitter",
  "tw": "11_twitter",
  "google": "12_google_plus",
  "google_plus": "12_google_plus",
  "gplus": "12_google_plus",
  "pin": "13_pin_solid",
  "location": "13_pin_solid",
  "pin_solid": "13_pin_solid",
  "pin_outline": "14_pin_outline",
  "email": "15_email",
  "mail": "15_email",
  "phone": "16_phone",
  "call": "16_phone",
  "calendar": "17_calendar",
  "date": "17_calendar",
  "clock": "18_clock",
  "time": "18_clock",
  "cart": "19_cart",
  "basket": "19_cart",
  "shopping_cart": "19_cart",
  "heart": "20_heart",
  "favorites": "20_heart",
  "wishlist": "20_heart",
  "plus": "21_plus",
  "add": "21_plus",
  "minus": "22_minus",
  "remove": "22_minus",
  "star": "23_star",
  "rating": "23_star",
  "slideshow": "24_slideshow",
  "gallery": "24_slideshow",
  "image": "24_slideshow",
  "arrow_left": "25_arrow_left",
  "arrow_right": "26_arrow_right",
  "circle_check": "27_circle_check",
  "circle_error": "28_circle_error"
};

  function resolveId(nameOrId) {
    if (!nameOrId) return null;
    const key = String(nameOrId).trim().toLowerCase().replace(/[-\s]+/g, '_');
    if (ICONS[key]) return key;
    if (ALIASES[key]) return ALIASES[key];
    const byNum = Object.keys(ICONS).find(k => k.startsWith(key.padStart(2, '0') + '_'));
    return byNum || null;
  }

  function getSvg(nameOrId, opts = {}) {
    const id = resolveId(nameOrId);
    if (!id || !ICONS[id]) return '';
    let svg = ICONS[id];
    const size = opts.size || 18;
    svg = svg.replace('<svg ', `<svg width="${size}" height="${size}" class="${opts.className || 'bw-icon'}" `);
    return svg;
  }

  function injectAll(root = document) {
    const nodes = root.querySelectorAll('[data-bw-icon]');
    nodes.forEach(node => {
      const name = node.getAttribute('data-bw-icon');
      const size = node.getAttribute('data-bw-size') || 18;
      const svg = getSvg(name, { size });
      if (svg) node.innerHTML = svg;
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => injectAll());
    } else {
      injectAll();
    }
  }

  global.ButtonWebIcons = { ICONS, ALIASES, resolveId, getSvg, injectAll };
})(typeof window !== 'undefined' ? window : globalThis);
