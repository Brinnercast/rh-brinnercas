/**
 * THE HANDSOME DESIGN SYSTEM — Autonomous SVG Iconography & Brandmark Engine
 */
(function (global) {
  const ICONS = {
  "01_home": {
    "name": "HOME",
    "category": "Navigation",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <polyline points=\"12,33 32,13 52,33\" />\n  <line x1=\"19\" y1=\"33.5\" x2=\"19\" y2=\"51\" />\n  <line x1=\"45\" y1=\"33.5\" x2=\"45\" y2=\"51\" />\n</svg>"
  },
  "02_menu": {
    "name": "MENU",
    "category": "Navigation",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"12\" y1=\"16\" x2=\"52\" y2=\"16\" />\n  <line x1=\"12\" y1=\"32\" x2=\"52\" y2=\"32\" />\n  <line x1=\"12\" y1=\"48\" x2=\"52\" y2=\"48\" />\n</svg>"
  },
  "03_shopping_basket": {
    "name": "SHOPPING BASKET",
    "category": "Commerce",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <path d=\"M 22.5,21.5 A 9.5,9.5 0 0 1 41.5,21.5\" />\n  <line x1=\"13\" y1=\"21.5\" x2=\"51\" y2=\"21.5\" />\n  <line x1=\"14.5\" y1=\"27\" x2=\"14.5\" y2=\"44.5\" />\n  <line x1=\"49.5\" y1=\"27\" x2=\"49.5\" y2=\"44.5\" />\n  <line x1=\"13\" y1=\"50\" x2=\"51\" y2=\"50\" />\n</svg>"
  },
  "04_my_page": {
    "name": "MY PAGE",
    "category": "User",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <circle cx=\"32\" cy=\"20\" r=\"8\" />\n  <line x1=\"13\" y1=\"35\" x2=\"51\" y2=\"35\" />\n  <line x1=\"14.5\" y1=\"40.5\" x2=\"14.5\" y2=\"52\" />\n  <line x1=\"49.5\" y1=\"40.5\" x2=\"49.5\" y2=\"52\" />\n</svg>"
  },
  "05_message": {
    "name": "MESSAGE",
    "category": "Communication",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"12\" y1=\"15\" x2=\"52\" y2=\"15\" />\n  <line x1=\"13.5\" y1=\"20.5\" x2=\"13.5\" y2=\"36.5\" />\n  <line x1=\"50.5\" y1=\"20.5\" x2=\"50.5\" y2=\"36.5\" />\n  <polyline points=\"12,42 25.5,42 32,53.5 38.5,42 52,42\" />\n</svg>"
  },
  "06_video": {
    "name": "VIDEO",
    "category": "Media",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"11.5\" y1=\"17\" x2=\"52.5\" y2=\"17\" />\n  <line x1=\"13\" y1=\"23\" x2=\"13\" y2=\"41\" />\n  <line x1=\"51\" y1=\"23\" x2=\"51\" y2=\"41\" />\n  <line x1=\"11.5\" y1=\"47\" x2=\"52.5\" y2=\"47\" />\n  <polygon points=\"27.5,25.5 39,32 27.5,38.5\" stroke-linejoin=\"bevel\" />\n</svg>"
  },
  "07_time_sale": {
    "name": "TIME SALE",
    "category": "Commerce",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <circle cx=\"32\" cy=\"34\" r=\"19\" />\n  <polyline points=\"32,21 32,34.5 45,34.5\" />\n  <line x1=\"9\" y1=\"20.5\" x2=\"19.5\" y2=\"10\" />\n  <line x1=\"44.5\" y1=\"10\" x2=\"55\" y2=\"20.5\" />\n</svg>"
  },
  "08_brand": {
    "name": "BRAND",
    "category": "Commerce",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <polyline points=\"12,17 41.5,17 54.5,32 41.5,47 12,47\" stroke-linejoin=\"bevel\" />\n  <line x1=\"13.5\" y1=\"23\" x2=\"13.5\" y2=\"41\" />\n</svg>"
  },
  "09_preparation": {
    "name": "PREPARATION",
    "category": "Order & Logistics",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"11.5\" y1=\"17\" x2=\"52.5\" y2=\"17\" />\n  <polyline points=\"13.5,23 13.5,48 50.5,48 50.5,23\" />\n  <line x1=\"23.5\" y1=\"25.5\" x2=\"40.5\" y2=\"25.5\" />\n</svg>"
  },
  "10_delivery": {
    "name": "DELIVERY",
    "category": "Order & Logistics",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"10\" y1=\"14.5\" x2=\"37.5\" y2=\"14.5\" />\n  <polyline points=\"11.5,20.5 11.5,46.5 19,46.5\" />\n  <line x1=\"36\" y1=\"20.5\" x2=\"36\" y2=\"46.5\" />\n  <line x1=\"28.5\" y1=\"46.5\" x2=\"42\" y2=\"46.5\" />\n  <polyline points=\"36,25.5 49.5,25.5 55.5,32.5 55.5,46.5 51.5,46.5\" stroke-linejoin=\"bevel\" />\n  <circle cx=\"23.8\" cy=\"46.5\" r=\"5\" />\n  <circle cx=\"46.8\" cy=\"46.5\" r=\"5\" />\n</svg>"
  },
  "11_order": {
    "name": "ORDER",
    "category": "Order & Logistics",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <polyline points=\"25.5,16 12.5,16 12.5,51.5 42.5,51.5 42.5,35.5\" />\n  <polygon points=\"24.5,35.5 26,27.5 41.5,12 48,18.5 32.5,34\" stroke-linejoin=\"miter\" />\n  <line x1=\"26\" y1=\"27.5\" x2=\"32.5\" y2=\"34\" />\n  <line x1=\"44.2\" y1=\"8.2\" x2=\"51.8\" y2=\"15.8\" />\n</svg>"
  },
  "12_complete_order": {
    "name": "COMPLETE ORDER",
    "category": "Order & Logistics",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <polyline points=\"26,50.5 13.5,50.5 13.5,13.5 43.5,13.5 43.5,30\" />\n  <line x1=\"21\" y1=\"21.5\" x2=\"36\" y2=\"21.5\" />\n  <line x1=\"21\" y1=\"30.5\" x2=\"36\" y2=\"30.5\" />\n  <line x1=\"21\" y1=\"39.5\" x2=\"30\" y2=\"39.5\" />\n  <circle cx=\"38.5\" cy=\"42.5\" r=\"9.5\" />\n  <polyline points=\"34,42 37.5,45.5 43.5,39.5\" />\n</svg>"
  },
  "13_payment": {
    "name": "PAYMENT",
    "category": "Commerce",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"13\" y1=\"16\" x2=\"51\" y2=\"16\" />\n  <line x1=\"13\" y1=\"24\" x2=\"51\" y2=\"24\" />\n  <polyline points=\"14.5,30 14.5,46.5 49.5,46.5 49.5,30\" />\n  <circle cx=\"40.5\" cy=\"37.5\" r=\"3.2\" />\n</svg>"
  },
  "14_notice": {
    "name": "NOTICE",
    "category": "Communication",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"15.5\" y1=\"22.5\" x2=\"15.5\" y2=\"40.5\" />\n  <line x1=\"24.5\" y1=\"22.5\" x2=\"24.5\" y2=\"40.5\" />\n  <polyline points=\"32,22.5 49.5,14 49.5,49 32,40.5\" stroke-linejoin=\"bevel\" />\n</svg>"
  },
  "15_present": {
    "name": "PRESENT",
    "category": "Commerce",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <polyline points=\"21,13 32,21.5 43,13\" />\n  <line x1=\"12.5\" y1=\"21.5\" x2=\"51.5\" y2=\"21.5\" />\n  <line x1=\"12.5\" y1=\"28.5\" x2=\"51.5\" y2=\"28.5\" />\n  <polyline points=\"14,34 14,50.5 50,50.5 50,34\" />\n  <line x1=\"28.2\" y1=\"21.5\" x2=\"28.2\" y2=\"50.5\" />\n  <line x1=\"35.8\" y1=\"21.5\" x2=\"35.8\" y2=\"50.5\" />\n</svg>"
  },
  "16_waste_basket": {
    "name": "WASTE BASKET",
    "category": "System & Utility",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"22\" y1=\"12\" x2=\"42\" y2=\"12\" />\n  <line x1=\"11.5\" y1=\"19.5\" x2=\"52.5\" y2=\"19.5\" />\n  <polyline points=\"16.5,26.5 16.5,52.5 47.5,52.5 47.5,26.5\" />\n  <line x1=\"26.8\" y1=\"26.5\" x2=\"26.8\" y2=\"46.5\" />\n  <line x1=\"37.2\" y1=\"26.5\" x2=\"37.2\" y2=\"46.5\" />\n</svg>"
  },
  "17_alarm": {
    "name": "ALARM",
    "category": "Communication",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <path d=\"M 18,39.5 L 18,27.5 A 14,14 0 0 1 46,27.5 L 46,39.5\" />\n  <line x1=\"11.5\" y1=\"45\" x2=\"52.5\" y2=\"45\" />\n  <line x1=\"21.5\" y1=\"51.5\" x2=\"42.5\" y2=\"51.5\" />\n</svg>"
  },
  "18_lock": {
    "name": "LOCK",
    "category": "Security",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <path d=\"M 22.5,22.5 A 9.5,9.5 0 0 1 41.5,22.5\" />\n  <line x1=\"12.5\" y1=\"22.5\" x2=\"51.5\" y2=\"22.5\" />\n  <line x1=\"14\" y1=\"28.5\" x2=\"14\" y2=\"45\" />\n  <line x1=\"50\" y1=\"28.5\" x2=\"50\" y2=\"45\" />\n  <line x1=\"32\" y1=\"31\" x2=\"32\" y2=\"42.5\" />\n  <line x1=\"12.5\" y1=\"50.5\" x2=\"51.5\" y2=\"50.5\" />\n</svg>"
  },
  "19_search": {
    "name": "SEARCH",
    "category": "System & Utility",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <circle cx=\"29.5\" cy=\"28.5\" r=\"15.5\" />\n  <line x1=\"43.5\" y1=\"42.5\" x2=\"52.5\" y2=\"51.5\" />\n</svg>"
  },
  "20_filter": {
    "name": "FILTER",
    "category": "System & Utility",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"12\" y1=\"18\" x2=\"19\" y2=\"18\" />\n  <line x1=\"24\" y1=\"12.5\" x2=\"24\" y2=\"23.5\" />\n  <line x1=\"29\" y1=\"18\" x2=\"52\" y2=\"18\" />\n  <line x1=\"12\" y1=\"32\" x2=\"35\" y2=\"32\" />\n  <line x1=\"40\" y1=\"26.5\" x2=\"40\" y2=\"37.5\" />\n  <line x1=\"45\" y1=\"32\" x2=\"52\" y2=\"32\" />\n  <line x1=\"12\" y1=\"46\" x2=\"19\" y2=\"46\" />\n  <line x1=\"24\" y1=\"40.5\" x2=\"24\" y2=\"51.5\" />\n  <line x1=\"29\" y1=\"46\" x2=\"52\" y2=\"46\" />\n</svg>"
  },
  "21_more": {
    "name": "MORE",
    "category": "System & Utility",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"32\" y1=\"11.5\" x2=\"32\" y2=\"52.5\" />\n  <line x1=\"11.5\" y1=\"32\" x2=\"26.5\" y2=\"32\" />\n  <line x1=\"37.5\" y1=\"32\" x2=\"52.5\" y2=\"32\" />\n</svg>"
  },
  "22_close": {
    "name": "CLOSE",
    "category": "System & Utility",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"17\" y1=\"47\" x2=\"47\" y2=\"17\" />\n  <line x1=\"17\" y1=\"17\" x2=\"28\" y2=\"28\" />\n  <line x1=\"36\" y1=\"36\" x2=\"47\" y2=\"47\" />\n</svg>"
  },
  "23_aline": {
    "name": "ALINE",
    "category": "System & Utility",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <polyline points=\"10.5,24.5 21,13.5 31.5,24.5\" stroke-linejoin=\"bevel\" />\n  <line x1=\"21\" y1=\"22.5\" x2=\"21\" y2=\"51.5\" />\n  <line x1=\"41.5\" y1=\"13.5\" x2=\"41.5\" y2=\"42.5\" />\n  <polyline points=\"31,40.5 41.5,51.5 52,40.5\" stroke-linejoin=\"bevel\" />\n</svg>"
  },
  "24_share": {
    "name": "SHARE",
    "category": "Communication",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <circle cx=\"40.5\" cy=\"14.5\" r=\"5.5\" />\n  <circle cx=\"19.5\" cy=\"32\" r=\"5.5\" />\n  <circle cx=\"40.5\" cy=\"49.5\" r=\"5.5\" />\n  <line x1=\"23.8\" y1=\"28.4\" x2=\"36.2\" y2=\"18.1\" />\n  <line x1=\"23.8\" y1=\"35.6\" x2=\"36.2\" y2=\"45.9\" />\n</svg>"
  },
  "25_brandmark_basic": {
    "name": "BRANDMARK (BASIC)",
    "category": "Brandmark System",
    "viewBox": "0 0 360 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 360 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"56\" stroke-width=\"2.4\" />\n  <text x=\"58\" y=\"42\" font-family=\"'Inter', 'TT Interphases', sans-serif\" font-size=\"28\" font-weight=\"400\" letter-spacing=\"1.5\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">THE</text>\n  <line x1=\"104\" y1=\"8\" x2=\"104\" y2=\"56\" stroke-width=\"4\" />\n  <text x=\"222\" y=\"42\" font-family=\"'Inter', 'TT Interphases', sans-serif\" font-size=\"28\" font-weight=\"600\" letter-spacing=\"1.5\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">HANDSOME</text>\n  <line x1=\"342\" y1=\"8\" x2=\"342\" y2=\"56\" stroke-width=\"7.6\" />\n</svg>"
  },
  "26_brandmark_short": {
    "name": "BRANDMARK (SHORT |T|HS|)",
    "category": "Brandmark System",
    "viewBox": "0 0 160 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 160 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"14\" y1=\"8\" x2=\"14\" y2=\"56\" stroke-width=\"2.4\" />\n  <text x=\"38\" y=\"42\" font-family=\"'Inter', 'TT Interphases', sans-serif\" font-size=\"28\" font-weight=\"400\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">T</text>\n  <line x1=\"62\" y1=\"8\" x2=\"62\" y2=\"56\" stroke-width=\"4\" />\n  <text x=\"102\" y=\"42\" font-family=\"'Inter', 'TT Interphases', sans-serif\" font-size=\"28\" font-weight=\"600\" letter-spacing=\"1\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">HS</text>\n  <line x1=\"144\" y1=\"8\" x2=\"144\" y2=\"56\" stroke-width=\"7.6\" />\n</svg>"
  },
  "27_app_icon": {
    "name": "APP ICON (HAND / SOME)",
    "category": "Brandmark System",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <line x1=\"10\" y1=\"11\" x2=\"54\" y2=\"11\" stroke-width=\"1.6\" />\n  <text x=\"32\" y=\"26.5\" font-family=\"'Inter', 'TT Interphases', sans-serif\" font-size=\"13.5\" font-weight=\"500\" letter-spacing=\"0.8\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">HAND</text>\n  <line x1=\"10\" y1=\"32\" x2=\"54\" y2=\"32\" stroke-width=\"2.7\" />\n  <text x=\"32\" y=\"47.5\" font-family=\"'Inter', 'TT Interphases', sans-serif\" font-size=\"13.5\" font-weight=\"700\" letter-spacing=\"0.8\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">SOME</text>\n  <line x1=\"10\" y1=\"53.5\" x2=\"54\" y2=\"53.5\" stroke-width=\"5.1\" />\n</svg>"
  },
  "28_heart_wishlist": {
    "name": "WISHLIST HEART (APP UI)",
    "category": "Brandmark System",
    "viewBox": "0 0 64 64",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3.2\" stroke-linecap=\"butt\" stroke-linejoin=\"miter\">\n  <path d=\"M 32,51 L 14.5,33.5 A 10.5,10.5 0 0 1 29.5,18.5 L 32,21 L 34.5,18.5 A 10.5,10.5 0 0 1 49.5,33.5 L 36.5,46.5\" />\n</svg>"
  }
};
  const ALIASES = {
  "home": "01_home",
  "menu": "02_menu",
  "shopping_basket": "03_shopping_basket",
  "basket": "03_shopping_basket",
  "cart": "03_shopping_basket",
  "my_page": "04_my_page",
  "user": "04_my_page",
  "profile": "04_my_page",
  "message": "05_message",
  "chat": "05_message",
  "video": "06_video",
  "play": "06_video",
  "time_sale": "07_time_sale",
  "clock": "07_time_sale",
  "time": "07_time_sale",
  "brand": "08_brand",
  "tag": "08_brand",
  "preparation": "09_preparation",
  "box": "09_preparation",
  "archive": "09_preparation",
  "delivery": "10_delivery",
  "truck": "10_delivery",
  "shipping": "10_delivery",
  "order": "11_order",
  "edit": "11_order",
  "write": "11_order",
  "complete_order": "12_complete_order",
  "check": "12_complete_order",
  "verified": "12_complete_order",
  "payment": "13_payment",
  "card": "13_payment",
  "wallet": "13_payment",
  "notice": "14_notice",
  "megaphone": "14_notice",
  "announcement": "14_notice",
  "present": "15_present",
  "gift": "15_present",
  "waste_basket": "16_waste_basket",
  "trash": "16_waste_basket",
  "delete": "16_waste_basket",
  "alarm": "17_alarm",
  "bell": "17_alarm",
  "notification": "17_alarm",
  "lock": "18_lock",
  "security": "18_lock",
  "search": "19_search",
  "filter": "20_filter",
  "settings": "20_filter",
  "more": "21_more",
  "plus": "21_more",
  "add": "21_more",
  "close": "22_close",
  "cancel": "22_close",
  "aline": "23_aline",
  "sort": "23_aline",
  "transfer": "23_aline",
  "share": "24_share",
  "brandmark_basic": "25_brandmark_basic",
  "brandmark": "25_brandmark_basic",
  "brandmark_short": "26_brandmark_short",
  "monogram": "26_brandmark_short",
  "app_icon": "27_app_icon",
  "heart_wishlist": "28_heart_wishlist",
  "heart": "28_heart_wishlist",
  "wishlist": "28_heart_wishlist"
};

  function resolveId(nameOrId) {
    if (!nameOrId) return null;
    const key = String(nameOrId).trim().toLowerCase().replace(/[-\s]+/g, '_');
    if (ICONS[key]) return key;
    if (ALIASES[key]) return ALIASES[key];
    const byNumber = Object.keys(ICONS).find(k => k.startsWith(key.padStart(2, '0') + '_'));
    return byNumber || null;
  }

  function getSvg(nameOrId, opts = {}) {
    const id = resolveId(nameOrId);
    if (!id || !ICONS[id]) return '';
    let svg = ICONS[id].svg;
    if (opts.size) {
      svg = svg.replace('<svg ', `<svg width="${opts.size}" height="${opts.size}" `);
    }
    if (opts.strokeWidth) {
      svg = svg.replace(/stroke-width="[^"]*"/, `stroke-width="${opts.strokeWidth}"`);
    }
    if (opts.className) {
      svg = svg.replace('<svg ', `<svg class="${opts.className}" `);
    } else {
      svg = svg.replace('<svg ', '<svg class="hs-icon" ');
    }
    return svg;
  }

  function createBrandmark(word1 = 'THE', word2 = 'HANDSOME') {
    return `<span class="hs-brandmark" aria-label="${word1} ${word2}">
      <span class="hs-bar-left"></span>
      <span class="hs-word-thin">${word1}</span>
      <span class="hs-bar-mid"></span>
      <span class="hs-word-bold">${word2}</span>
      <span class="hs-bar-right"></span>
    </span>`;
  }

  function injectAll(root = document) {
    const iconNodes = root.querySelectorAll('[data-hs-icon], [data-handsome-icon]');
    iconNodes.forEach(node => {
      const name = node.getAttribute('data-hs-icon') || node.getAttribute('data-handsome-icon');
      const size = node.getAttribute('data-hs-size');
      const strokeWidth = node.getAttribute('data-hs-stroke');
      const svg = getSvg(name, { size, strokeWidth });
      if (svg) node.innerHTML = svg;
    });

    const bmNodes = root.querySelectorAll('[data-hs-brandmark]');
    bmNodes.forEach(node => {
      const raw = node.getAttribute('data-hs-brandmark') || 'THE|HANDSOME';
      const parts = raw.split('|');
      node.innerHTML = createBrandmark(parts[0] || 'THE', parts[1] || 'HANDSOME');
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => injectAll());
    } else {
      injectAll();
    }
  }

  global.HandsomeIcons = {
    ICONS,
    ALIASES,
    resolveId,
    getSvg,
    createBrandmark,
    injectAll
  };
})(typeof window !== 'undefined' ? window : globalThis);

