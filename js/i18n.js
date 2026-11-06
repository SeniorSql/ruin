// Язык сайта: русский (основной) и английский. Перевод пишется прямо рядом с текстом: t('Главная', 'Home').
// Страницы, которые ещё не переведены, показываются по-русски.
const KEY = 'ruin.lang';
let saved = null;
try { saved = localStorage.getItem(KEY); } catch {}
export const lang = saved === 'en' ? 'en' : 'ru';
document.documentElement.lang = lang;

export const isEn = () => lang === 'en';
export const t = (ru, en) => (lang === 'en' && en != null ? en : ru);

export function setLang(l) {
  try { localStorage.setItem(KEY, l === 'en' ? 'en' : 'ru'); } catch {}
  location.reload();
}

// Названия категорий техники (в базе — по-русски)
const CAT_EN = {
  excavators: 'Excavators', mini_excavators: 'Mini excavators', backhoe_loaders: 'Backhoe loaders', wheel_loaders: 'Wheel loaders',
  mini_loaders: 'Skid steer loaders', telehandlers: 'Telehandlers', bulldozers: 'Bulldozers', graders: 'Motor graders', rollers: 'Rollers',
  pavers: 'Asphalt pavers', truck_cranes: 'Truck cranes', aerial_platforms: 'Aerial work platforms', dump_trucks: 'Dump trucks',
  manipulators: 'Crane trucks', drilling_rigs: 'Drilling rigs', concrete: 'Concrete equipment', other: 'Other machinery'
};
export const catName = (c) => (lang === 'en' && c && CAT_EN[c.code]) || c?.name || '';

// Склонение числительных: ru — [один, два, пять], en — [one, many]
export const plural2 = (n, ru, en) => {
  if (lang === 'en') return n === 1 ? en[0] : en[1];
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? ru[2] : b > 1 && b < 5 ? ru[1] : b === 1 ? ru[0] : ru[2];
};
