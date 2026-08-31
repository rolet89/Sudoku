'use strict';

/* =========================================================
   Drift-Rennen - Canvas-Rennspiel mit mitdrehender Kamera
   ========================================================= */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
}
window.addEventListener('resize', resize);
resize();

/* ---------------------------------------------------------
   Strecke: geschlossener Rundkurs, der in alle Richtungen führt
   --------------------------------------------------------- */

const CTRL = [
  [1400, 0], [1000, 700], [300, 900], [-400, 700], [-900, 1100],
  [-1500, 700], [-1300, 0], [-1600, -600], [-1000, -1100], [-200, -900],
  [400, -1200], [1100, -900], [1500, -300]
];
const ROAD_W = 220;
const HALF_W = ROAD_W / 2;
const PATH = [];

(function baueStrecke() {
  const n = CTRL.length, STEPS = 26;
  for (let i = 0; i < n; i++) {
    const p0 = CTRL[(i - 1 + n) % n], p1 = CTRL[i];
    const p2 = CTRL[(i + 1) % n], p3 = CTRL[(i + 2) % n];
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      PATH.push({ x: x, y: y });
    }
  }
})();
const N = PATH.length;

// Grenzen für die Minikarte
const BOUNDS = (function () {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of PATH) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  const m = HALF_W + 40;
  return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
})();

// Richtung der Strecke an einem Stützpunkt
function tangente(i) {
  const a = PATH[(i - 1 + N) % N], b = PATH[(i + 1) % N];
  return Math.atan2(b.y - a.y, b.x - a.x);
}

// Nächster Punkt auf der Mittellinie -> Abstand und Position (0..N)
function naechsterPunkt(px, py) {
  let best = Infinity, bestPos = 0;
  for (let i = 0; i < N; i++) {
    const a = PATH[i], b = PATH[(i + 1) % N];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const cx = a.x + dx * t - px, cy = a.y + dy * t - py;
    const d = cx * cx + cy * cy;
    if (d < best) { best = d; bestPos = i + t; }
  }
  return { dist: Math.sqrt(best), pos: bestPos };
}

/* ---------------------------------------------------------
   Fahrzeug
   --------------------------------------------------------- */

const ACCEL = 780;        // Antrieb  (px/s^2)
const BRAKE = 1500;       // Bremse
const RUECKWAERTS = 380;
const MAX_STEER = 0.62;   // maximaler Lenkeinschlag (rad)
const RADSTAND = 46;

const auto = { x: 0, y: 0, heading: 0, vx: 0, vy: 0, steer: 0 };

function setzeZurueck(pos) {
  const i = pos === undefined ? 0 : Math.round(pos) % N;
  const p = PATH[i];
  auto.x = p.x;
  auto.y = p.y;
  auto.heading = tangente(i);
  auto.vx = 0;
  auto.vy = 0;
  auto.steer = 0;
  spuren.length = 0;
  letzteRaeder = null;
}

/* ---------------------------------------------------------
   Kamera
   --------------------------------------------------------- */

const kamera = { x: 0, y: 0, winkel: 0, zoom: 1 };
let kameraDreht = true;   // true = Fahrtrichtung zeigt nach oben

function winkelDiff(ziel, ist) {
  let d = (ziel - ist) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* ---------------------------------------------------------
   Eingaben
   --------------------------------------------------------- */

const eingabe = { up: false, down: false, left: false, right: false, brake: false };
const TASTEN = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'brake'
};

window.addEventListener('keydown', function (e) {
  if (e.code === 'KeyC') { kameraDreht = !kameraDreht; zeigeKameraModus(); }
  if (e.code === 'KeyR') { setzeZurueck(fortschrittPos); resetRunde(); }
  const t = TASTEN[e.code];
  if (t) { eingabe[t] = true; e.preventDefault(); versteckeHilfe(); }
});
window.addEventListener('keyup', function (e) {
  const t = TASTEN[e.code];
  if (t) { eingabe[t] = false; e.preventDefault(); }
});
window.addEventListener('blur', function () {
  for (const k in eingabe) eingabe[k] = false;
});

document.querySelectorAll('.tbtn').forEach(function (btn) {
  const t = btn.dataset.taste;
  const an = function (e) { e.preventDefault(); eingabe[t] = true; btn.classList.add('aktiv'); versteckeHilfe(); };
  const aus = function (e) { e.preventDefault(); eingabe[t] = false; btn.classList.remove('aktiv'); };
  btn.addEventListener('pointerdown', an);
  btn.addEventListener('pointerup', aus);
  btn.addEventListener('pointerleave', aus);
  btn.addEventListener('pointercancel', aus);
});

const hilfe = document.getElementById('hilfe');
function versteckeHilfe() { hilfe.classList.add('weg'); }
document.getElementById('hilfeZu').addEventListener('click', versteckeHilfe);

/* ---------------------------------------------------------
   Rundenlogik
   --------------------------------------------------------- */

let fortschrittPos = 0;
let naechsteZone = 1;
let runde = 1;
let gestartet = false;
let rundenStart = 0;
let letzteZeit = 0;
let besteZeit = 0;
let aufStrecke = true;

function resetRunde() {
  naechsteZone = 1;
  gestartet = false;
  rundenStart = 0;
}

function zeitText(ms) {
  if (!ms) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(r).padStart(3, '0');
}

const elTempo = document.getElementById('tempo');
const elRunde = document.getElementById('runde');
const elZeit = document.getElementById('zeit');
const elLetzte = document.getElementById('letzte');
const elBeste = document.getElementById('beste');
const elDrift = document.getElementById('driftbalken');
const elWarnung = document.getElementById('warnung');
const elKamera = document.getElementById('kameramodus');

function zeigeKameraModus() {
  elKamera.textContent = 'Kamera: ' + (kameraDreht ? 'mitdrehend' : 'fest (Norden oben)');
}

/* ---------------------------------------------------------
   Reifenspuren
   --------------------------------------------------------- */

const spuren = [];
const MAX_SPUREN = 420;
let letzteRaeder = null;

function merkeSpur(seitwaerts) {
  const cos = Math.cos(auto.heading), sin = Math.sin(auto.heading);
  const hx = auto.x - cos * 16, hy = auto.y - sin * 16;
  const links = { x: hx + sin * 11, y: hy - cos * 11 };
  const rechts = { x: hx - sin * 11, y: hy + cos * 11 };
  const staerke = Math.min(1, (Math.abs(seitwaerts) - 55) / 200);

  if (letzteRaeder) {
    const d = Math.hypot(links.x - letzteRaeder.l.x, links.y - letzteRaeder.l.y);
    if (d < 120) {
      spuren.push({ ax: letzteRaeder.l.x, ay: letzteRaeder.l.y, bx: links.x, by: links.y, a: staerke });
      spuren.push({ ax: letzteRaeder.r.x, ay: letzteRaeder.r.y, bx: rechts.x, by: rechts.y, a: staerke });
    }
  }
  letzteRaeder = { l: links, r: rechts };
  while (spuren.length > MAX_SPUREN) spuren.shift();
}

/* ---------------------------------------------------------
   Physik
   --------------------------------------------------------- */

function update(dt) {
  // Lenkung weich nachführen
  let ziel = 0;
  if (eingabe.left) ziel -= 1;
  if (eingabe.right) ziel += 1;
  auto.steer += (ziel - auto.steer) * Math.min(1, dt * 9);

  // Geschwindigkeit in Auto-Koordinaten zerlegen (alte Ausrichtung!)
  const cos = Math.cos(auto.heading), sin = Math.sin(auto.heading);
  let vorwaerts = auto.vx * cos + auto.vy * sin;
  let seitwaerts = -auto.vx * sin + auto.vy * cos;

  const info = naechsterPunkt(auto.x, auto.y);
  fortschrittPos = info.pos;
  aufStrecke = info.dist < HALF_W;
  const griffFaktor = aufStrecke ? 1 : 0.55;

  // Antrieb / Bremse
  if (eingabe.up) vorwaerts += ACCEL * griffFaktor * dt;
  if (eingabe.down) {
    if (vorwaerts > 15) vorwaerts -= BRAKE * dt;
    else vorwaerts -= RUECKWAERTS * griffFaktor * dt;
  }

  // Rollwiderstand längs (begrenzt die Höchstgeschwindigkeit)
  vorwaerts -= vorwaerts * (aufStrecke ? 1.15 : 2.1) * dt;

  // Seitenhaftung: hoher Wert = wenig Haftung = langer Drift
  let haftung = aufStrecke ? 0.86 : 0.94;
  if (eingabe.brake) haftung = 0.985;
  seitwaerts *= Math.pow(haftung, dt * 60);

  // Handbremse blockiert zusätzlich die Hinterachse
  if (eingabe.brake) vorwaerts -= vorwaerts * 0.9 * dt;

  // Zurück in Weltkoordinaten - noch mit der ALTEN Ausrichtung,
  // damit das Drehen den Geschwindigkeitsvektor nicht mitzieht (= Drift)
  auto.vx = vorwaerts * cos - seitwaerts * sin;
  auto.vy = vorwaerts * sin + seitwaerts * cos;

  // Lenkeinschlag: bei hohem Tempo begrenzt
  const tempo = Math.hypot(auto.vx, auto.vy);
  const limit = MAX_STEER * (1 - Math.min(0.55, tempo / 1500));
  const einschlag = auto.steer * limit;
  auto.heading += (vorwaerts / (RADSTAND * 3.2)) * Math.tan(einschlag) * dt;

  // Position integrieren
  auto.x += auto.vx * dt;
  auto.y += auto.vy * dt;

  // Reifenspuren beim Rutschen
  if (Math.abs(seitwaerts) > 55 && tempo > 40) merkeSpur(seitwaerts);
  else letzteRaeder = null;

  // Kamera nachführen
  const vorausschau = Math.min(150, tempo * 0.26);
  const zielX = auto.x + Math.cos(auto.heading) * vorausschau;
  const zielY = auto.y + Math.sin(auto.heading) * vorausschau;
  const folge = Math.min(1, dt * 6);
  kamera.x += (zielX - kamera.x) * folge;
  kamera.y += (zielY - kamera.y) * folge;

  const zielWinkel = kameraDreht ? -auto.heading - Math.PI / 2 : 0;
  kamera.winkel += winkelDiff(zielWinkel, kamera.winkel) * Math.min(1, dt * 3.6);

  const zielZoom = 1.05 - Math.min(0.35, tempo / 2200);
  kamera.zoom += (zielZoom - kamera.zoom) * Math.min(1, dt * 2);

  // Runden zählen
  const anteil = fortschrittPos / N;
  const zone = Math.min(3, Math.floor(anteil * 4));
  if (!gestartet && tempo > 25) { gestartet = true; rundenStart = performance.now(); }
  if (zone === naechsteZone) {
    naechsteZone = (zone + 1) % 4;
    if (zone === 0 && gestartet) {
      const jetzt = performance.now();
      letzteZeit = jetzt - rundenStart;
      if (!besteZeit || letzteZeit < besteZeit) besteZeit = letzteZeit;
      rundenStart = jetzt;
      runde++;
    }
  }

  // HUD
  elTempo.textContent = Math.round(tempo * 0.36);
  elRunde.textContent = runde;
  elZeit.textContent = gestartet ? zeitText(performance.now() - rundenStart) : '--:--.---';
  elLetzte.textContent = zeitText(letzteZeit);
  elBeste.textContent = zeitText(besteZeit);
  elDrift.style.width = Math.min(100, Math.abs(seitwaerts) / 3.2) + '%';
  elWarnung.classList.toggle('hidden', aufStrecke);
}

/* ---------------------------------------------------------
   Zeichnen
   --------------------------------------------------------- */

function streckenPfad() {
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < N; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.closePath();
}

function zeichneGras() {
  const R = Math.hypot(W, H) / (2 * kamera.zoom) + 260;
  const T = 260;
  const ix0 = Math.floor((kamera.x - R) / T), ix1 = Math.ceil((kamera.x + R) / T);
  const iy0 = Math.floor((kamera.y - R) / T), iy1 = Math.ceil((kamera.y + R) / T);
  ctx.fillStyle = '#1d5c2e';
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iy = iy0; iy <= iy1; iy++) {
      const h = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
      const f = h - Math.floor(h);
      if (f < 0.5) continue;
      const px = ix * T + f * T * 0.8;
      const py = iy * T + (f * 7 % 1) * T * 0.8;
      ctx.beginPath();
      ctx.arc(px, py, 10 + f * 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function zeichneStartlinie() {
  const p = PATH[0];
  const a = tangente(0);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(a);
  const kachel = ROAD_W / 8;
  for (let reihe = 0; reihe < 2; reihe++) {
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = (k + reihe) % 2 ? '#f4f4f4' : '#22262b';
      ctx.fillRect(reihe * kachel - kachel, -HALF_W + k * kachel, kachel, kachel);
    }
  }
  ctx.restore();
}

function zeichneAuto() {
  ctx.save();
  ctx.translate(auto.x, auto.y);
  ctx.rotate(auto.heading);

  // Schatten
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.beginPath();
  ctx.roundRect(-24, -14, 50, 28, 7);
  ctx.fill();

  // Räder
  ctx.fillStyle = '#15181c';
  const einschlag = auto.steer * MAX_STEER * 0.6;
  [[16, -13], [16, 13]].forEach(function (r) {
    ctx.save();
    ctx.translate(r[0], r[1]);
    ctx.rotate(einschlag);
    ctx.fillRect(-8, -4, 16, 8);
    ctx.restore();
  });
  ctx.fillRect(-20, -17, 16, 8);
  ctx.fillRect(-20, 9, 16, 8);

  // Karosserie
  const grad = ctx.createLinearGradient(0, -14, 0, 14);
  grad.addColorStop(0, '#ff8a3d');
  grad.addColorStop(0.5, '#f2621b');
  grad.addColorStop(1, '#c34406');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(-26, -13, 52, 26, 8);
  ctx.fill();

  // Scheiben
  ctx.fillStyle = 'rgba(20,30,45,.85)';
  ctx.beginPath();
  ctx.roundRect(-2, -10, 12, 20, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-16, -9, 8, 18, 3);
  ctx.fill();

  // Scheinwerfer
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(24, -10, 3, 6);
  ctx.fillRect(24, 4, 3, 6);
  ctx.restore();
}

function zeichneMinikarte() {
  const groesse = 132, rand = 14;
  const bx = W - groesse - rand, by = rand;
  const bw = BOUNDS.x1 - BOUNDS.x0, bh = BOUNDS.y1 - BOUNDS.y0;
  const s = Math.min(groesse / bw, groesse / bh);

  ctx.save();
  ctx.fillStyle = 'rgba(10,16,22,.62)';
  ctx.strokeStyle = 'rgba(255,255,255,.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx, by, groesse, groesse, 10);
  ctx.fill();
  ctx.stroke();
  ctx.clip();

  ctx.translate(bx + (groesse - bw * s) / 2, by + (groesse - bh * s) / 2);
  ctx.scale(s, s);
  ctx.translate(-BOUNDS.x0, -BOUNDS.y0);

  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = ROAD_W * 0.8;
  ctx.lineJoin = 'round';
  streckenPfad();
  ctx.stroke();

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(auto.x, auto.y, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#237038';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H * 0.62);
  ctx.rotate(kamera.winkel);
  ctx.scale(kamera.zoom, kamera.zoom);
  ctx.translate(-kamera.x, -kamera.y);

  zeichneGras();

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Randstreifen
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = ROAD_W + 20;
  streckenPfad();
  ctx.stroke();

  // Fahrbahn
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = ROAD_W;
  streckenPfad();
  ctx.stroke();

  // Reifenspuren
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < spuren.length; i++) {
    const s = spuren[i];
    const alter = (i + 1) / spuren.length;
    ctx.strokeStyle = 'rgba(24,24,26,' + (0.5 * s.a * alter).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.bx, s.by);
    ctx.stroke();
  }

  // Mittellinie
  ctx.setLineDash([46, 42]);
  ctx.strokeStyle = 'rgba(245,220,90,.75)';
  ctx.lineWidth = 5;
  streckenPfad();
  ctx.stroke();
  ctx.setLineDash([]);

  zeichneStartlinie();
  zeichneAuto();
  ctx.restore();

  zeichneMinikarte();
}

/* ---------------------------------------------------------
   Schleife
   --------------------------------------------------------- */

let letzterFrame = 0;
function schleife(t) {
  if (!letzterFrame) letzterFrame = t;
  let dt = (t - letzterFrame) / 1000;
  letzterFrame = t;
  if (dt > 1 / 25) dt = 1 / 25;   // nach Tab-Wechsel nicht springen
  update(dt);
  render();
  requestAnimationFrame(schleife);
}

// Zugriff für Tests und Fehlersuche
window.spiel = { auto: auto, kamera: kamera, eingabe: eingabe, PATH: PATH, ROAD_W: ROAD_W,
  status: function () { return { runde: runde, letzteZeit: letzteZeit, besteZeit: besteZeit, aufStrecke: aufStrecke, pos: fortschrittPos / N }; } };

setzeZurueck(0);
kamera.x = auto.x;
kamera.y = auto.y;
kamera.winkel = -auto.heading - Math.PI / 2;
zeigeKameraModus();
requestAnimationFrame(schleife);
