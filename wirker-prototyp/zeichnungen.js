/* Platzhalter-Zeichnungen als SVG.
   In der echten App kommt hier die hinterlegte Zeichnung (PDF/DXF/PNG) des Auftrags hin. */

const STIL = `
  .k { fill: none; stroke: #1b1f24; stroke-width: 2.2; }
  .mittel { fill: none; stroke: #c0392b; stroke-width: 1; stroke-dasharray: 18 4 3 4; }
  .mass { fill: none; stroke: #2f6fb5; stroke-width: 1; }
  .masstext { fill: #1a4f8a; font: 600 15px system-ui, sans-serif; text-anchor: middle; }
  .titel { fill: #1b1f24; font: 700 17px system-ui, sans-serif; }
  .klein { fill: #5a6672; font: 400 12px system-ui, sans-serif; }
`;

function pfeil(x1, y1, x2, y2, text, ueber) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dy = ueber === undefined ? -8 : ueber;
  return `<line class="mass" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
    marker-start="url(#pf)" marker-end="url(#pf)"/>
    <text class="masstext" x="${mx}" y="${my + dy}">${text}</text>`;
}

function rahmen(titel, nummer, inhalt, vb) {
  return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">
    <style>${STIL}</style>
    <defs>
      <marker id="pf" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto">
        <path d="M0,4.5 L9,2 L9,7 Z" fill="#2f6fb5"/>
      </marker>
    </defs>
    <rect x="0" y="0" width="100%" height="100%" fill="#f3f5f7"/>
    ${inhalt}
    <text class="titel" x="24" y="34">${titel}</text>
    <text class="klein" x="24" y="54">Zeichnung ${nummer} &middot; Ma&szlig;stab 1:2 &middot; Ma&szlig;e in mm</text>
  </svg>`;
}

const ZEICHNUNGEN = {
  flansch: rahmen('Flansch DN100 / PN16', 'ZB-1042', `
    <circle class="k" cx="300" cy="230" r="110"/>
    <circle class="k" cx="300" cy="230" r="55"/>
    <circle class="mittel" cx="300" cy="230" r="82"/>
    <line class="mittel" x1="300" y1="95" x2="300" y2="365"/>
    <line class="mittel" x1="165" y1="230" x2="435" y2="230"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const a = (i * Math.PI) / 4;
      return `<circle class="k" cx="${(300 + Math.cos(a) * 82).toFixed(1)}" cy="${(230 + Math.sin(a) * 82).toFixed(1)}" r="9"/>`;
    }).join('')}
    ${pfeil(190, 385, 410, 385, '&#216; 220')}
    ${pfeil(300, 230, 410, 230, '&#216; 110', -10)}
    <text class="klein" x="430" y="120">8 &times; &#216; 18</text>
    <line class="mass" x1="428" y1="128" x2="358" y2="172"/>
  `, '0 0 600 420'),

  blech: rahmen('Grundplatte geschnitten', 'ZB-2187', `
    <path class="k" d="M110 110 L470 110 L470 210 L390 210 L390 310 L110 310 Z"/>
    <circle class="k" cx="160" cy="160" r="14"/>
    <circle class="k" cx="420" cy="160" r="14"/>
    <circle class="k" cx="160" cy="260" r="14"/>
    <circle class="k" cx="340" cy="260" r="14"/>
    <line class="mittel" x1="140" y1="160" x2="180" y2="160"/>
    <line class="mittel" x1="160" y1="140" x2="160" y2="180"/>
    ${pfeil(110, 350, 470, 350, '360')}
    ${pfeil(500, 110, 500, 310, '200', 0)}
    <text class="klein" x="300" y="390">4 &times; &#216; 28 &middot; Kanten entgratet</text>
  `, '0 0 600 420'),

  winkel: rahmen('Konsolenwinkel geschwei&szlig;t', 'ZB-3301', `
    <path class="k" d="M120 320 L120 110 L170 110 L170 270 L430 270 L430 320 Z"/>
    <path class="k" d="M170 230 L250 270" />
    <circle class="k" cx="145" cy="150" r="11"/>
    <circle class="k" cx="145" cy="200" r="11"/>
    <circle class="k" cx="360" cy="295" r="11"/>
    ${pfeil(120, 360, 430, 360, '310')}
    ${pfeil(90, 110, 90, 320, '210', 0)}
    <text class="klein" x="250" y="225">a4 umlaufend</text>
  `, '0 0 600 420'),

  welle: rahmen('Antriebswelle gedreht', 'ZB-4455', `
    <rect class="k" x="100" y="190" width="120" height="70"/>
    <rect class="k" x="220" y="160" width="200" height="130"/>
    <rect class="k" x="420" y="195" width="90" height="60"/>
    <line class="mittel" x1="80" y1="225" x2="530" y2="225"/>
    ${pfeil(100, 330, 510, 330, '410')}
    ${pfeil(70, 160, 70, 290, '&#216; 90', 0)}
    <text class="klein" x="300" y="375">Passung h7 &middot; Rz 16</text>
  `, '0 0 600 420')
};
