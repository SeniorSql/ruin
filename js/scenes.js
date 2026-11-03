// Видео «техника за работой» для карточек каталога: играют при наведении курсора.
// Все ролики — Wikimedia Commons, свободные лицензии; автор показывается поверх видео.
// Для категорий без видео при наведении плавно приближается само фото.

const C = 'https://upload.wikimedia.org/wikipedia/commons/transcoded/';
const v = (path, author, license, file) => ({ src: C + path, author, license, page: 'https://commons.wikimedia.org/wiki/File:' + file });

const DIG = v('c/cb/Excavator_digging_land_and_loading_truck.webm/Excavator_digging_land_and_loading_truck.webm.480p.vp9.webm',
  'KEmel49', 'CC BY-SA 4.0', 'Excavator_digging_land_and_loading_truck.webm');

export const VIDEOS = {
  excavators: DIG,
  mini_excavators: v('6/6c/Backhoedigginginjapan-tokyoarea-feb27-2013.webm/Backhoedigginginjapan-tokyoarea-feb27-2013.webm.480p.vp9.webm',
    'Nesnad', 'CC BY-SA 4.0', 'Backhoedigginginjapan-tokyoarea-feb27-2013.webm'),
  backhoe_loaders: v('f/f3/%C5%A0eberov%2C_%C4%8Di%C5%A1t%C4%9Bn%C3%AD_Kov%C3%A1%C5%99sk%C3%A9ho_rybn%C3%ADka.webm/%C5%A0eberov%2C_%C4%8Di%C5%A1t%C4%9Bn%C3%AD_Kov%C3%A1%C5%99sk%C3%A9ho_rybn%C3%ADka.webm.480p.vp9.webm',
    'ŠJů', 'CC BY 4.0', '%C5%A0eberov,_%C4%8Di%C5%A1t%C4%9Bn%C3%AD_Kov%C3%A1%C5%99sk%C3%A9ho_rybn%C3%ADka.webm'),
  mini_loaders: v('b/bc/Hydraulic_breaker_attachment_on_a_skid-steer_loader.webm/Hydraulic_breaker_attachment_on_a_skid-steer_loader.webm.480p.vp9.webm',
    'Z22', 'CC BY-SA 4.0', 'Hydraulic_breaker_attachment_on_a_skid-steer_loader.webm'),
  bulldozers: v('f/f0/2025-06-12_Steinbruch_Werbach_-_Arbeiten_mit_Planierraupe_%2893620%29.webm/2025-06-12_Steinbruch_Werbach_-_Arbeiten_mit_Planierraupe_%2893620%29.webm.480p.vp9.webm',
    'Triplec85', 'CC BY-SA 4.0', '2025-06-12_Steinbruch_Werbach_-_Arbeiten_mit_Planierraupe_(93620).webm'),
  pavers: v('f/f9/Asphaltfertiger_Betrieb_1.ogv/Asphaltfertiger_Betrieb_1.ogv.240p.vp9.webm',
    'ChNPP', 'CC BY-SA 3.0', 'Asphaltfertiger_Betrieb_1.ogv'),
  aerial_platforms: v('d/d5/Aerial_Work_Platforms_-_Japan_-_2012.ogv/Aerial_Work_Platforms_-_Japan_-_2012.ogv.480p.vp9.webm',
    'Nesnad', 'CC BY-SA 3.0', 'Aerial_Work_Platforms_-_Japan_-_2012.ogv'),
  dump_trucks: v('a/a8/Asphaltfertiger_Betrieb_2.ogv/Asphaltfertiger_Betrieb_2.ogv.240p.vp9.webm',
    'ChNPP', 'CC BY-SA 3.0', 'Asphaltfertiger_Betrieb_2.ogv'),
  manipulators: v('4/4f/Camion_Kiloutou_-_Beynost_2017.webm/Camion_Kiloutou_-_Beynost_2017.webm.480p.vp9.webm',
    'Benoît Prieur', 'CC0', 'Camion_Kiloutou_-_Beynost_2017.webm'),
  drilling_rigs: v('4/48/Errichtung_des_Besichtigungsbauwerks.webm/Errichtung_des_Besichtigungsbauwerks.webm.480p.vp9.webm',
    'Raimond Spekking', 'CC BY-SA 4.0', 'Errichtung_des_Besichtigungsbauwerks.webm'),
  concrete: v('6/62/Cement_mixer_truck_rotating_and_mixing.webm/Cement_mixer_truck_rotating_and_mixing.webm.480p.vp9.webm',
    '驭龙飞车手', 'CC BY 4.0', 'Cement_mixer_truck_rotating_and_mixing.webm'),
  other: v('0/06/ETZ202_360p.webm/ETZ202_360p.webm.240p.vp9.webm',
    'Traktor174', 'CC BY-SA 3.0', 'ETZ202_360p.webm')
};

// Разметка для карточки: видео загружается только при первом наведении (preload="none")
export function sceneHtml(categoryCode) {
  const x = VIDEOS[categoryCode];
  if (!x) return '';
  return `<video class="pv-video" muted loop playsinline preload="none" data-src="${x.src}" aria-hidden="true"></video>
    <span class="credit vcredit">Видео: ${x.author} · ${x.license}</span>`;
}

// Делегированное управление видео: старт при наведении, пауза при уходе курсора
export function bindVideos() {
  if (window.matchMedia('(hover: none)').matches) return;
  document.addEventListener('mouseover', (e) => {
    const card = e.target.closest?.('.product');
    if (!card || card.contains(e.relatedTarget)) return;
    const vid = card.querySelector('.pv-video');
    if (!vid) return;
    if (!vid.src) {
      vid.src = vid.dataset.src;
      vid.addEventListener('playing', () => card.classList.add('playing'));
    }
    vid.play().then(() => card.classList.add('playing')).catch(() => {});
  });
  document.addEventListener('mouseout', (e) => {
    const card = e.target.closest?.('.product');
    if (!card || card.contains(e.relatedTarget)) return;
    card.classList.remove('playing');
    const vid = card.querySelector('.pv-video');
    if (vid && vid.src) vid.pause();
  });
}
