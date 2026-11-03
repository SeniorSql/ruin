// Анимированные сцены «техника за работой» для карточек каталога (показываются при наведении)
// viewBox 0 0 240 150: небо, земля, машина. Анимации в css/app.css (классы rx-*), запускаются при наведении.

const BG = '<rect width="240" height="150" fill="#eef0e8"/><rect y="118" width="240" height="32" fill="#cdbb8b"/><path d="M0 118h240" stroke="#b9a676" stroke-width="2"/>';
const wheel = (x, y, r = 12) => `<circle class="w" cx="${x}" cy="${y}" r="${r}"/><circle cx="${x}" cy="${y}" r="${r * 0.35}" fill="#c9cbc2"/>`;
const tracks = (x, w, y = 104, h = 16) => `<rect class="d" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>` +
  Array.from({ length: Math.floor(w / 16) }, (_, i) => `<circle cx="${x + 9 + i * 16}" cy="${y + h / 2}" r="3.5" fill="#6d7066"/>`).join('');
const smoke = (x, y) => `<g class="rx-smoke"><circle cx="${x}" cy="${y}" r="4"/><circle cx="${x + 3}" cy="${y - 2}" r="3" style="animation-delay:.6s"/><circle cx="${x - 2}" cy="${y}" r="3.5" style="animation-delay:1.2s"/></g>`;
const svg = (body) => `<svg viewBox="0 0 240 150" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${BG}${body}</svg>`;

// Экскаватор: стрела опускается, рукоять подгребает, ковш набирает и высыпает грунт
const dig = svg(`
  <path class="soil" d="M178 118 Q204 98 236 118Z"/>
  <g class="rx-shake">
    ${tracks(24, 100)}
    <rect class="d" x="26" y="84" width="12" height="20" rx="2"/>
    <path class="m" d="M34 104 L40 76 H94 L106 104Z"/>
    <path class="g" d="M46 77 L51 56 H72 L75 77Z"/>
    ${smoke(42, 70)}
    <g class="rx-boom" style="transform-origin:96px 84px">
      <path class="m" d="M90 88 L146 46 L156 54 L100 96Z"/>
      <g class="rx-stick" style="transform-origin:151px 50px">
        <path class="m" d="M146 46 L180 92 L172 98 L142 54Z"/>
        <g class="rx-bucket" style="transform-origin:176px 95px">
          <path class="d" d="M170 92 L194 98 L190 114 L172 108Z"/>
          <path class="soil rx-load" d="M174 100 L190 103 L188 109 L174 105Z"/>
        </g>
      </g>
    </g>
  </g>
  <g class="rx-drop"><circle class="soil" cx="186" cy="104" r="3"/><circle class="soil" cx="192" cy="100" r="2.5"/><circle class="soil" cx="182" cy="98" r="2"/></g>`);

// Экскаватор-погрузчик: колёсный, сзади копает траншею
const backhoe = svg(`
  <path d="M150 118 h70 v8 h-70z" fill="#8a6a3e"/>
  <g class="rx-shake">
    <path class="d" d="M14 96 L32 92 L34 110 L12 112Z"/>
    <path class="m" d="M30 98 L44 70 H96 L114 104 H30Z"/>
    <path class="g" d="M52 70 L56 50 H82 L86 70Z"/>
    ${wheel(50, 108, 11)}${wheel(98, 104, 15)}
    ${smoke(46, 64)}
    <g class="rx-boom" style="transform-origin:112px 86px">
      <path class="m" d="M108 90 L156 52 L164 60 L116 96Z"/>
      <g class="rx-stick" style="transform-origin:160px 56px">
        <path class="m" d="M156 52 L184 100 L176 104 L152 60Z"/>
        <g class="rx-bucket" style="transform-origin:180px 102px">
          <path class="d" d="M174 100 L196 106 L192 120 L176 114Z"/>
          <path class="soil rx-load" d="M178 108 L192 110 L190 116 L178 112Z"/>
        </g>
      </g>
    </g>
  </g>
  <path class="soil" d="M196 118 Q212 104 232 118Z"/>`);

// Погрузчик: ковш опускается, набирает грунт и поднимается
const scoop = svg(`
  <path class="soil" d="M170 118 Q196 92 230 118Z"/>
  <g class="rx-drive">
    <path class="m" d="M46 104 V62 H104 L132 104Z"/>
    <path class="g" d="M54 66 H90 L104 94 H54Z"/>
    ${wheel(68, 112, 15)}${wheel(124, 112, 15)}
    ${smoke(52, 56)}
    <g class="rx-scoop" style="transform-origin:134px 86px">
      <path class="m" d="M128 76 L138 72 L160 106 L152 110Z"/>
      <path class="d" d="M150 100 L184 102 L180 118 L152 116Z"/>
      <path class="soil rx-load" d="M156 102 L180 103 L176 96 L160 94Z"/>
    </g>
  </g>`);

// Телескопический погрузчик: стрела поднимается и выдвигается с поддоном
const tele = svg(`
  <rect x="196" y="40" width="40" height="78" fill="#d8d2c4" stroke="#8d8a80"/><path d="M196 62h40M196 84h40" stroke="#8d8a80"/>
  <g>
    <path class="m" d="M36 106 L42 84 H112 L122 106Z"/>
    <path class="g" d="M48 84 L52 62 H70 L72 84Z"/>
    ${wheel(56, 114, 12)}${wheel(108, 114, 12)}
    <g class="rx-tele" style="transform-origin:60px 88px">
      <rect class="m" x="56" y="82" width="88" height="11" rx="3"/>
      <g class="rx-tele-in">
        <rect class="d" x="132" y="84" width="40" height="7"/>
        <path d="M170 80 V100 H190" stroke="#26281f" stroke-width="3" fill="none"/>
        <rect x="172" y="88" width="24" height="10" fill="#b98c4f" stroke="#6b4e25"/>
        <rect x="174" y="78" width="20" height="10" fill="#c7ccd1" stroke="#7d8288"/>
      </g>
    </g>
  </g>`);

// Бульдозер: едет вперёд и толкает отвалом кучу грунта
const dozer = svg(`
  <g class="rx-push">
    ${tracks(30, 90, 104, 16)}
    <path class="m" d="M38 104 V80 H92 L102 104Z"/>
    <path class="g" d="M50 80 V58 H76 V80Z"/>
    ${smoke(44, 72)}
    <path d="M100 98 L120 92" stroke="#26281f" stroke-width="4"/>
    <path class="d" d="M124 80 Q114 98 124 120 H130 V80Z"/>
    <path class="soil rx-pile" style="transform-origin:130px 120px" d="M130 120 Q146 96 166 120Z"/>
  </g>`);

// Грейдер: проходит по площадке и выравнивает бугры
const grader = svg(`
  <g class="rx-bumps"><path class="soil" d="M150 118 q8 -12 16 0z"/><path class="soil" d="M176 118 q9 -14 18 0z"/><path class="soil" d="M204 118 q8 -10 16 0z"/></g>
  <g class="rx-grade">
    <path class="m" d="M20 100 H96 L104 84 H150 V100 H160 L164 110 H20Z"/>
    <path class="g" d="M118 84 V62 H144 V84Z"/>
    <path class="m" d="M20 90 H60 V100 H20Z"/>
    ${wheel(34, 112, 10)}${wheel(130, 112, 10)}${wheel(152, 112, 10)}
    <path class="d" d="M64 104 L96 108 L94 116 L62 112Z"/>
    ${smoke(108, 78)}
  </g>`);

// Каток: катается по свежему асфальту, валец вращается
const roller = svg(`
  <rect y="112" width="240" height="8" fill="#3b3d38"/><rect class="rx-shine" y="113" width="40" height="2" fill="#6f726a"/>
  <g class="rx-roll">
    <path class="m" d="M70 100 V70 H120 L128 100Z"/>
    <path class="g" d="M84 70 V50 H110 V70Z"/>
    ${smoke(76, 62)}
    <g class="rx-spin" style="transform-origin:52px 96px"><circle cx="52" cy="96" r="18" fill="#e3b200" stroke="#26281f" stroke-width="2"/><path d="M52 78V114M34 96H70" stroke="#26281f" stroke-width="2"/></g>
    <g class="rx-spin" style="transform-origin:144px 96px"><circle cx="144" cy="96" r="18" fill="#e3b200" stroke="#26281f" stroke-width="2"/><path d="M144 78V114M126 96H162" stroke="#26281f" stroke-width="2"/></g>
    <path class="m" d="M48 76 H140 V84 H48Z"/>
  </g>`);

// Асфальтоукладчик: едет и оставляет за собой полосу горячего асфальта
const paver = svg(`
  <rect class="rx-asphalt" style="transform-origin:240px 116px" x="120" y="110" width="120" height="10" fill="#33352f"/>
  <g class="rx-steam"><circle cx="160" cy="104" r="4"/><circle cx="190" cy="104" r="4" style="animation-delay:.7s"/><circle cx="220" cy="104" r="4" style="animation-delay:1.4s"/></g>
  <g class="rx-pave">
    <path class="d" d="M40 94 H70 L66 112 H40Z"/>
    <path class="m" d="M66 104 V78 H120 V104Z"/>
    <path class="g" d="M90 78 V58 H112 V78Z"/>
    ${tracks(70, 54, 104, 14)}
    <path class="d" d="M120 100 H132 V114 H120Z"/>
    ${smoke(80, 72)}
  </g>`);

// Автокран: поднимает бетонную плиту
const crane = svg(`
  <g>
    <path class="m" d="M24 96 H180 V108 H24Z"/>
    <path class="g" d="M28 80 H56 V96 H28Z"/>
    ${wheel(44, 112, 10)}${wheel(120, 112, 10)}${wheel(146, 112, 10)}${wheel(168, 112, 10)}
    <path class="m" d="M86 96 V82 H110 V96Z"/>
    <path d="M98 86 L190 24" stroke="#f5c400" stroke-width="9" stroke-linecap="round"/><path d="M98 86 L190 24" stroke="#26281f" stroke-width="1.5" stroke-dasharray="6 6"/>
    <path d="M70 96 L72 116 M178 96 L182 116" stroke="#26281f" stroke-width="3"/>
    <rect class="rx-cable" style="transform-origin:190px 26px" x="189" y="26" width="2" height="76" fill="#26281f"/>
    <g class="rx-lift" style="transform-origin:190px 104px">
      <path d="M190 102 L172 108 M190 102 L208 108" stroke="#26281f" stroke-width="1.5"/>
      <rect x="160" y="108" width="60" height="10" fill="#b8bbb4" stroke="#6f726a"/><path d="M175 108v10M190 108v10M205 108v10" stroke="#8f928a"/>
    </g>
  </g>`);

// Автовышка: стрела поднимает люльку с рабочим
const platform = svg(`
  <rect x="190" y="20" width="44" height="98" fill="#d8d2c4" stroke="#8d8a80"/><path d="M196 34h32M196 54h32M196 74h32M196 94h32" stroke="#a9a397"/>
  <path class="m" d="M20 98 H150 V108 H20Z"/>
  <path class="g" d="M24 80 H52 V98 H24Z"/>
  ${wheel(40, 112, 10)}${wheel(122, 112, 10)}${wheel(140, 112, 10)}
  <g class="rx-arm" style="transform-origin:96px 94px">
    <rect class="m" x="92" y="90" width="84" height="8" rx="3"/>
    <g class="rx-basket" style="transform-origin:176px 94px">
      <rect x="168" y="78" width="22" height="14" fill="#f5c400" stroke="#26281f" stroke-width="2"/>
      <circle cx="178" cy="72" r="4" fill="#f0c9a0" stroke="#26281f"/><path d="M174 70 h8" stroke="#e24d2b" stroke-width="3"/>
    </g>
  </g>`);

// Самосвал: кузов поднимается, песок высыпается в кучу
const dump = svg(`
  <path class="sand rx-heap" style="transform-origin:214px 118px" d="M190 118 Q214 96 238 118Z"/>
  <g class="rx-sandfall"><circle class="sand" cx="206" cy="96" r="3"/><circle class="sand" cx="210" cy="92" r="2.5" style="animation-delay:.25s"/><circle class="sand" cx="203" cy="90" r="2" style="animation-delay:.5s"/><circle class="sand" cx="208" cy="100" r="2.5" style="animation-delay:.75s"/></g>
  <path class="d" d="M24 104 H200 V112 H24Z"/>
  ${wheel(54, 114, 12)}${wheel(160, 114, 12)}${wheel(186, 114, 12)}
  <path class="m" d="M22 104 V76 H50 L70 90 V104Z"/>
  <path class="g" d="M28 80 H48 L62 92 H28Z"/>
  ${smoke(30, 70)}
  <g class="rx-tip" style="transform-origin:200px 102px">
    <path class="m" d="M74 66 H200 V102 H74Z"/>
    <path class="sand" d="M78 66 Q138 50 196 66Z"/>
    <path d="M90 74v22M112 74v22M134 74v22M156 74v22M178 74v22" stroke="#c49a00" stroke-width="2"/>
  </g>`);

// Манипулятор: снимает поддон с блоками с кузова и ставит на землю
const manip = svg(`
  <path class="d" d="M20 104 H170 V112 H20Z"/>
  ${wheel(44, 114, 11)}${wheel(136, 114, 11)}${wheel(158, 114, 11)}
  <path class="m" d="M18 104 V76 H46 L60 90 V104Z"/>
  <path class="g" d="M24 80 H44 L54 92 H24Z"/>
  <path class="m" d="M64 98 H170 V104 H64Z"/>
  <rect class="m" x="66" y="56" width="10" height="42"/>
  <g>
    <rect class="m" x="70" y="52" width="70" height="9" rx="3"/>
    <g class="rx-reach">
      <rect class="d" x="130" y="54" width="34" height="5"/>
      <rect class="rx-cable2" style="transform-origin:162px 59px" x="161" y="59" width="2" height="27" fill="#26281f"/>
      <g class="rx-carry">
        <path d="M162 84 L150 88 M162 84 L174 88" stroke="#26281f" stroke-width="1.5"/>
        <rect x="148" y="88" width="28" height="4" fill="#b98c4f"/>
        <rect x="149" y="78" width="12" height="10" fill="#c9ccc4" stroke="#7d8288"/><rect x="162" y="78" width="12" height="10" fill="#c9ccc4" stroke="#7d8288"/>
      </g>
    </g>
  </g>`);

// Буровая установка: шнек вращается и уходит в грунт
const drill = svg(`
  ${tracks(36, 90, 104, 14)}
  <path class="m" d="M44 104 V82 H110 V104Z"/>
  <path class="g" d="M52 82 V64 H74 V82Z"/>
  ${smoke(84, 76)}
  <rect class="m" x="126" y="10" width="10" height="94"/>
  <path d="M110 92 L126 70" stroke="#26281f" stroke-width="3"/>
  <g class="rx-bore">
    <rect x="129" y="14" width="4" height="70" fill="#7a7d74"/>
    <g class="rx-auger" style="transform-origin:131px 98px"><path d="M131 82 l-9 4 l18 4 l-18 4 l18 4 l-18 4 l18 4 l-9 2" fill="none" stroke="#3a3c36" stroke-width="3"/></g>
  </g>
  <rect x="0" y="118" width="240" height="32" fill="#cdbb8b"/><path d="M0 118h240" stroke="#b9a676" stroke-width="2"/><ellipse cx="131" cy="119" rx="8" ry="2" fill="#5e4524"/>
  <g class="rx-spoil"><circle class="soil" cx="146" cy="114" r="3"/><circle class="soil" cx="116" cy="114" r="2.5" style="animation-delay:.4s"/><circle class="soil" cx="150" cy="112" r="2" style="animation-delay:.8s"/></g>
  <path class="soil" d="M112 118 q19 -8 38 0z"/>`);

// Бетононасос: стрела раскладывается, бетон льётся в опалубку
const pump = svg(`
  <rect x="176" y="108" width="56" height="10" fill="none" stroke="#7a5a32" stroke-width="2"/>
  <rect class="rx-fill" style="transform-origin:204px 118px" x="178" y="110" width="52" height="8" fill="#9a9c94"/>
  <path class="d" d="M20 104 H150 V112 H20Z"/>
  ${wheel(42, 114, 11)}${wheel(118, 114, 11)}${wheel(138, 114, 11)}
  <path class="m" d="M18 104 V78 H44 L56 92 V104Z"/>
  <path class="g" d="M24 82 H42 L50 94 H24Z"/>
  <path class="m" d="M60 90 H150 V104 H60Z"/>
  <g class="rx-p1" style="transform-origin:80px 88px">
    <rect class="m" x="76" y="84" width="64" height="8" rx="3"/>
    <g class="rx-p2" style="transform-origin:138px 88px">
      <rect class="m" x="134" y="84" width="56" height="7" rx="3"/>
      <g class="rx-p3" style="transform-origin:188px 87px">
        <rect class="d" x="186" y="84" width="5" height="22"/>
      </g>
    </g>
  </g>
  <g class="rx-pour"><circle cx="204" cy="94" r="2.5" fill="#8b8d85"/><circle cx="204" cy="100" r="2.5" fill="#8b8d85" style="animation-delay:.2s"/><circle cx="204" cy="104" r="2" fill="#8b8d85" style="animation-delay:.4s"/></g>`);

// Прочая техника: двигатель заводится, машина вибрирует и дымит
const start = svg(`
  <g class="rx-shake">
    <path class="m" d="M50 104 V72 H112 L132 104Z"/>
    <path class="g" d="M58 76 H92 L104 96 H58Z"/>
    ${wheel(70, 110, 14)}${wheel(122, 110, 14)}
    <path class="d" d="M132 92 H176 V110 H132Z"/>
    <rect class="d" x="56" y="54" width="6" height="18"/>
  </g>
  ${smoke(59, 50)}`);

const SCENES = {
  excavators: [dig, 'КОПАЕТ КОТЛОВАН'], mini_excavators: [dig, 'КОПАЕТ ТРАНШЕЮ'], backhoe_loaders: [backhoe, 'РОЕТ ТРАНШЕЮ'],
  wheel_loaders: [scoop, 'НАБИРАЕТ КОВШ'], mini_loaders: [scoop, 'НАБИРАЕТ КОВШ'], telehandlers: [tele, 'ПОДАЁТ ПОДДОН'],
  bulldozers: [dozer, 'ТОЛКАЕТ ГРУНТ'], graders: [grader, 'РАВНЯЕТ ДОРОГУ'], rollers: [roller, 'УКАТЫВАЕТ АСФАЛЬТ'],
  pavers: [paver, 'УКЛАДЫВАЕТ АСФАЛЬТ'], truck_cranes: [crane, 'ПОДНИМАЕТ ПЛИТУ'], aerial_platforms: [platform, 'ПОДНИМАЕТ ЛЮЛЬКУ'],
  dump_trucks: [dump, 'РАЗГРУЖАЕТ ПЕСОК'], manipulators: [manip, 'РАЗГРУЖАЕТ БЛОКИ'], drilling_rigs: [drill, 'БУРИТ СКВАЖИНУ'],
  concrete: [pump, 'ПОДАЁТ БЕТОН'], other: [start, 'ЗАВОДИТСЯ']
};

export function sceneHtml(categoryCode) {
  const [s, label] = SCENES[categoryCode] || SCENES.other;
  return `<div class="scene" aria-hidden="true">${s}<span class="scene-label">${label}</span></div>`;
}
