'use strict';

/* =========================================================
   Wirker - Auftrag-Materialeingabe (Prototyp)
   ========================================================= */

const SPEICHER = 'wirker.auftraege.v1';

const WERKSTOFFE = [
  { kurz: '4301', voll: '1.4301 V2A' },
  { kurz: '16Mn', voll: '16Mn / S355' },
  { kurz: '4404', voll: '1.4404 V4A' },
  { kurz: 'S235', voll: 'S235JR' },
  { kurz: 'S355', voll: 'S355J2' },
  { kurz: 'DC01', voll: 'DC01 blank' },
  { kurz: 'AlMg3', voll: 'Alu AlMg3' },
  { kurz: 'E-Cu', voll: 'Kupfer E-Cu' }
];

const DEMO = [
  { nr: 'A-26-0141', kunde: 'Mayer Anlagenbau', teil: 'Flansch DN100', stueck: 12, zeichnung: 'flansch', status: 'angelegt' },
  { nr: 'A-26-0142', kunde: 'Stahlbau Ritter', teil: 'Grundplatte 360x200', stueck: 40, zeichnung: 'blech', status: 'angelegt' },
  { nr: 'A-26-0143', kunde: 'Hofmann KG', teil: 'Konsolenwinkel', stueck: 8, zeichnung: 'winkel', status: 'angelegt' },
  { nr: 'A-26-0144', kunde: 'Mayer Anlagenbau', teil: 'Antriebswelle', stueck: 4, zeichnung: 'welle', status: 'angelegt' },
  {
    nr: 'A-26-0139', kunde: 'Weber Technik', teil: 'Deckel rund', stueck: 25, zeichnung: 'flansch', status: 'planung',
    material: { werkstoff: '1.4301 V2A', form: 'flach', masse: { dicke: '5', breite: '200', laenge: '1000' } },
    planung: { termin: '2026-10-07', maschine: 'Laser 1', bemerkung: '' }
  },
  {
    nr: 'A-26-0136', kunde: 'Stahlbau Ritter', teil: 'Rohrstutzen', stueck: 60, zeichnung: 'welle', status: 'fertigung',
    material: { werkstoff: '16Mn / S355', form: 'rohr', masse: { aussen: '88,9', wand: '3,2', laenge: '6000' } },
    planung: { termin: '2026-10-02', maschine: 'Dreherei', bemerkung: 'Eilauftrag' }
  }
];

let auftraege = laden();
let aktuellerAuftrag = null;
let aktiveForm = 'flach';
let gewaehlterWerkstoff = null;
let planZiel = null;

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (roh) return JSON.parse(roh);
  } catch (e) { /* Speicher nicht verfügbar - dann nur im Arbeitsspeicher */ }
  return JSON.parse(JSON.stringify(DEMO));
}

function sichern() {
  try { localStorage.setItem(SPEICHER, JSON.stringify(auftraege)); } catch (e) { /* egal */ }
}

/* ---------------------------------------------------------
   Kurzzugriffe
   --------------------------------------------------------- */

const $ = function (id) { return document.getElementById(id); };
const koerper = document.body;

/* ---------------------------------------------------------
   Administrator-Modus
   --------------------------------------------------------- */

function adminAn() { return $('adminAn').checked; }

$('adminAn').addEventListener('change', function () {
  koerper.classList.toggle('admin', adminAn());
  try { localStorage.setItem('wirker.admin', adminAn() ? '1' : '0'); } catch (e) { }
  zeichneListe();
  if (aktiveAnsicht === 'material') oeffneMaterial(aktuellerAuftrag || naechsterOffener());
});

try {
  if (localStorage.getItem('wirker.admin') === '1') {
    $('adminAn').checked = true;
    koerper.classList.add('admin');
  }
} catch (e) { }

/* ---------------------------------------------------------
   Ansichten
   --------------------------------------------------------- */

let aktiveAnsicht = 'liste';
const TITEL = {
  liste: ['Aufträge', 'Werkstatt-Terminal'],
  material: ['Materialeingabe', 'Administrator-Modus'],
  planung: ['Planen', 'Jeder Auftrag, jederzeit']
};

function zeige(ansicht) {
  aktiveAnsicht = ansicht;
  document.querySelectorAll('.ansicht').forEach(function (el) { el.classList.remove('aktiv'); });
  $('ansicht' + ansicht.charAt(0).toUpperCase() + ansicht.slice(1)).classList.add('aktiv');
  document.querySelectorAll('#nav button').forEach(function (b) {
    b.classList.toggle('aktiv', b.dataset.ziel === ansicht);
  });
  $('kopfTitel').textContent = TITEL[ansicht][0];
  $('kopfUnter').textContent = TITEL[ansicht][1];
  $('zurueck').hidden = ansicht === 'liste';
  numpadZu();
  window.scrollTo(0, 0);
}

document.querySelectorAll('#nav button').forEach(function (b) {
  b.addEventListener('click', function () {
    const ziel = b.dataset.ziel;
    if (ziel === 'material') { oeffneMaterial(aktuellerAuftrag || naechsterOffener()); return; }
    if (ziel === 'planung') zeichnePlanliste();
    zeige(ziel);
  });
});

$('zurueck').addEventListener('click', function () {
  if (koerper.classList.contains('zeichnung-voll')) { vollbildAus(); return; }
  zeichneListe();
  zeige('liste');
});

/* ---------------------------------------------------------
   Auftragsliste
   --------------------------------------------------------- */

let filter = 'alle';

document.querySelectorAll('#filterleiste .chip').forEach(function (c) {
  c.addEventListener('click', function () {
    document.querySelectorAll('#filterleiste .chip').forEach(function (x) { x.classList.remove('aktiv'); });
    c.classList.add('aktiv');
    filter = c.dataset.filter;
    zeichneListe();
  });
});

function statusText(s) {
  return { angelegt: 'angelegt', planung: 'Planung', fertigung: 'Fertigung', fertig: 'fertig' }[s] || s;
}

function materialText(m) {
  if (!m) return null;
  const z = m.masse;
  let dim = '';
  if (m.form === 'flach') dim = [z.dicke, z.breite, z.laenge].filter(Boolean).join(' × ');
  else if (m.form === 'rund') dim = 'Ø ' + [z.durchm, z.laenge].filter(Boolean).join(' × ');
  else dim = 'Ø ' + [z.aussen, z.wand, z.laenge].filter(Boolean).join(' × ');
  return m.werkstoff + '  ·  ' + dim + ' mm';
}

function zeichneListe() {
  const ziel = $('auftragsliste');
  ziel.innerHTML = '';
  const sichtbar = auftraege.filter(function (a) { return filter === 'alle' || a.status === filter; });
  $('listeLeer').hidden = sichtbar.length > 0;

  sichtbar.forEach(function (a) {
    const karte = document.createElement('div');
    karte.className = 'karte';
    const mt = materialText(a.material);
    karte.innerHTML =
      '<div><h3>' + a.nr + '</h3><div class="zeile2">' + a.teil + ' · ' + a.stueck + ' Stück</div>' +
      '<div class="zeile2">' + a.kunde + '</div></div>' +
      '<span class="status-pille status-' + a.status + '">' + statusText(a.status) + '</span>' +
      (mt ? '<div class="material">' + mt + '</div>' : '') +
      (a.planung ? '<div class="material">Geplant: ' + datumText(a.planung.termin) + ' · ' + a.planung.maschine + '</div>' : '');

    const knoepfe = document.createElement('div');
    knoepfe.className = 'knoepfe';

    const bMat = document.createElement('button');
    bMat.className = 'klein-btn blau';
    bMat.textContent = a.material ? 'Material ändern' : 'Material erfassen';
    bMat.addEventListener('click', function () { oeffneMaterial(a); });

    const bPlan = document.createElement('button');
    bPlan.className = 'klein-btn';
    bPlan.textContent = a.planung ? 'Umplanen' : 'Planen';
    bPlan.addEventListener('click', function () { oeffnePlanDialog(a); });

    knoepfe.append(bMat, bPlan);
    karte.append(knoepfe);
    ziel.append(karte);
  });

  if (adminAn()) {
    const reset = document.createElement('button');
    reset.className = 'klein-btn';
    reset.style.marginTop = '18px';
    reset.textContent = 'Demodaten zurücksetzen';
    reset.addEventListener('click', function () {
      auftraege = JSON.parse(JSON.stringify(DEMO));
      aktuellerAuftrag = null;
      sichern();
      zeichneListe();
      toast('Demodaten zurückgesetzt', 'warn');
    });
    ziel.append(reset);
  }
}

function datumText(iso) {
  if (!iso) return '–';
  const t = iso.split('-');
  return t[2] + '.' + t[1] + '.' + t[0];
}

function naechsterOffener() {
  return auftraege.find(function (a) { return a.status === 'angelegt'; }) || null;
}

/* ---------------------------------------------------------
   Materialmaske
   --------------------------------------------------------- */

function oeffneMaterial(auftrag) {
  const gesperrt = !adminAn();
  $('materialGesperrt').hidden = !gesperrt;
  $('zeichnungBox').hidden = gesperrt;
  $('eingabeBox').hidden = gesperrt;
  if (gesperrt) { zeige('material'); return; }

  if (!auftrag) {
    toast('Kein offener Auftrag vorhanden', 'warn');
    zeige('liste');
    return;
  }

  aktuellerAuftrag = auftrag;
  $('matAuftragNr').textContent = auftrag.nr;
  $('matAuftragTeil').textContent = auftrag.teil + ' · ' + auftrag.stueck + ' Stück · ' + auftrag.kunde;
  const pille = $('matStatus');
  pille.textContent = statusText(auftrag.status);
  pille.className = 'status-pille status-' + auftrag.status;

  $('zeichnungFlaeche').innerHTML = ZEICHNUNGEN[auftrag.zeichnung] || ZEICHNUNGEN.blech;
  $('zeichnungName').textContent = 'Zeichnung · ' + auftrag.teil;
  zeichnungZuruecksetzen();

  // Werkstoff und Maße aus dem Auftrag übernehmen
  gewaehlterWerkstoff = auftrag.material ? auftrag.material.werkstoff : null;
  setzeForm(auftrag.material ? auftrag.material.form : 'flach');
  const m = auftrag.material ? auftrag.material.masse : {};
  $('mDicke').value = m.dicke || '';
  $('mBreite').value = m.breite || '';
  $('mLaenge').value = m.laenge || '';
  $('mDurchm').value = m.durchm || '';
  $('mLaengeR').value = m.laenge || '';
  $('mAussen').value = m.aussen || '';
  $('mWand').value = m.wand || '';
  $('mLaengeRo').value = m.laenge || '';

  $('materialFrei').value = '';
  $('statusMit').checked = auftrag.status === 'angelegt';
  $('statusMit').parentElement.hidden = auftrag.status !== 'angelegt';

  zeichneWerkstoffe();
  aktualisiereZusammenfassung();
  zeige('material');
}

function zeichneWerkstoffe() {
  const gitter = $('materialGitter');
  gitter.innerHTML = '';
  const liste = WERKSTOFFE.slice();
  // frei eingegebener Werkstoff, der nicht im Katalog steht
  if (gewaehlterWerkstoff && !liste.some(function (w) { return w.voll === gewaehlterWerkstoff; })) {
    liste.push({ kurz: gewaehlterWerkstoff.split(' ')[0], voll: gewaehlterWerkstoff });
  }
  liste.forEach(function (w) {
    const b = document.createElement('button');
    b.className = 'mat-btn' + (gewaehlterWerkstoff === w.voll ? ' aktiv' : '');
    b.innerHTML = '<b>' + w.kurz + '</b><small>' + w.voll + '</small>';
    b.addEventListener('click', function () {
      gewaehlterWerkstoff = (gewaehlterWerkstoff === w.voll) ? null : w.voll;
      zeichneWerkstoffe();
      aktualisiereZusammenfassung();
      if (gewaehlterWerkstoff) springeZuErstemLeerenMass();
    });
    gitter.append(b);
  });
}

$('materialFreiOk').addEventListener('click', uebernehmeFreitext);
$('materialFrei').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); uebernehmeFreitext(); }
});
$('materialFrei').addEventListener('focus', numpadZu);

function uebernehmeFreitext() {
  const wert = $('materialFrei').value.trim();
  if (!wert) return;
  gewaehlterWerkstoff = wert;
  $('materialFrei').value = '';
  $('materialFrei').blur();
  zeichneWerkstoffe();
  aktualisiereZusammenfassung();
  springeZuErstemLeerenMass();
}

/* ----- Form (flach / rund / rohr) ----- */

function setzeForm(form) {
  aktiveForm = form || 'flach';
  document.querySelectorAll('#formUmschalter button').forEach(function (b) {
    b.classList.toggle('aktiv', b.dataset.form === aktiveForm);
  });
  $('masseFlach').hidden = aktiveForm !== 'flach';
  $('masseRund').hidden = aktiveForm !== 'rund';
  $('masseRohr').hidden = aktiveForm !== 'rohr';
}

document.querySelectorAll('#formUmschalter button').forEach(function (b) {
  b.addEventListener('click', function () {
    setzeForm(b.dataset.form);
    numpadZu();
    aktualisiereZusammenfassung();
  });
});

/* ---------------------------------------------------------
   Zahlentastatur
   --------------------------------------------------------- */

let aktivesFeld = null;

function sichtbareFelder() {
  const box = { flach: 'masseFlach', rund: 'masseRund', rohr: 'masseRohr' }[aktiveForm];
  return Array.prototype.slice.call($(box).querySelectorAll('input.zahl'));
}

function numpadAuf(feld) {
  aktivesFeld = feld;
  document.querySelectorAll('.mass').forEach(function (m) { m.classList.remove('aktiv'); });
  feld.closest('.mass').classList.add('aktiv');
  $('numpadFeld').textContent = feld.closest('.mass').querySelector('span').textContent;
  $('numpadWert').textContent = feld.value || '0';
  $('numpad').hidden = false;
  koerper.classList.add('numpad-offen');
  // Das aktive Maß soll direkt unter der klebenden Zeichnung stehen
  setTimeout(function () { scrolleUnterZeichnung(feld); }, 230);
}

function scrolleUnterZeichnung(feld) {
  const box = feld.closest('.mass');
  if (!box) return;
  const zeichnung = $('zeichnungBox');
  const obergrenze = (zeichnung && !zeichnung.hidden)
    ? zeichnung.getBoundingClientRect().bottom + 12
    : $('kopf').offsetHeight + 12;
  const versatz = box.getBoundingClientRect().top - obergrenze;
  if (Math.abs(versatz) > 6) window.scrollBy({ top: versatz, behavior: 'smooth' });
}

function numpadZu() {
  $('numpad').hidden = true;
  koerper.classList.remove('numpad-offen');
  document.querySelectorAll('.mass').forEach(function (m) { m.classList.remove('aktiv'); });
  aktivesFeld = null;
}

document.querySelectorAll('input.zahl').forEach(function (feld) {
  feld.addEventListener('mousedown', function (e) { e.preventDefault(); });   // kein Fokus, keine Systemtastatur
  feld.addEventListener('click', function () { numpadAuf(feld); });
});

$('numpadZu').addEventListener('click', numpadZu);

$('numpad').addEventListener('click', function (e) {
  const taste = e.target.closest('button[data-t]');
  if (!taste || !aktivesFeld) return;
  const t = taste.dataset.t;
  let wert = aktivesFeld.value;

  if (t === 'back') wert = wert.slice(0, -1);
  else if (t === 'clear') wert = '';
  else if (t === 'next') { weiterZumNaechsten(); return; }
  else if (t === ',') { if (wert.indexOf(',') === -1) wert = (wert || '0') + ','; }
  else if (t === '00') { if (wert && wert !== '0') wert += '00'; }
  else {
    if (wert === '0') wert = '';
    // höchstens drei Nachkommastellen
    const k = wert.indexOf(',');
    if (k !== -1 && wert.length - k > 3) return;
    if (wert.replace(',', '').length >= 7) return;
    wert += t;
  }

  aktivesFeld.value = wert;
  $('numpadWert').textContent = wert || '0';
  aktualisiereZusammenfassung();
});

function weiterZumNaechsten() {
  const felder = sichtbareFelder();
  const i = felder.indexOf(aktivesFeld);
  if (i > -1 && i < felder.length - 1) numpadAuf(felder[i + 1]);
  else numpadZu();
}

function springeZuErstemLeerenMass() {
  const leer = sichtbareFelder().find(function (f) { return !f.value; });
  if (leer) numpadAuf(leer);
}

// Tippen außerhalb schließt die Zahlentastatur
document.addEventListener('click', function (e) {
  if (!koerper.classList.contains('numpad-offen')) return;
  if (e.target.closest('#numpad') || e.target.closest('input.zahl')) return;
  numpadZu();
}, true);

/* ---------------------------------------------------------
   Zusammenfassung und Speichern
   --------------------------------------------------------- */

function aktuelleMasse() {
  if (aktiveForm === 'flach') return { dicke: $('mDicke').value, breite: $('mBreite').value, laenge: $('mLaenge').value };
  if (aktiveForm === 'rund') return { durchm: $('mDurchm').value, laenge: $('mLaengeR').value };
  return { aussen: $('mAussen').value, wand: $('mWand').value, laenge: $('mLaengeRo').value };
}

function vollstaendig() {
  const m = aktuelleMasse();
  return gewaehlterWerkstoff && Object.keys(m).every(function (k) { return m[k] !== ''; });
}

function aktualisiereZusammenfassung() {
  const feld = $('zusammenfassung');
  const m = aktuelleMasse();
  const werte = Object.keys(m).map(function (k) { return m[k] || '–'; });
  const dim = aktiveForm === 'flach' ? werte.join(' × ') : 'Ø ' + werte.join(' × ');

  if (!gewaehlterWerkstoff && werte.every(function (w) { return w === '–'; })) {
    feld.textContent = 'Noch kein Material gewählt';
    feld.classList.add('leer');
  } else {
    feld.textContent = (gewaehlterWerkstoff || 'Werkstoff?') + '   ' + dim + ' mm';
    feld.classList.remove('leer');
  }
  $('speichern').disabled = !vollstaendig();
  $('speichern').textContent = $('statusMit').checked && aktuellerAuftrag && aktuellerAuftrag.status === 'angelegt'
    ? 'Speichern & einplanen' : 'Material speichern';
}

$('statusMit').addEventListener('change', aktualisiereZusammenfassung);

$('speichern').addEventListener('click', function () {
  if (!aktuellerAuftrag || !vollstaendig()) return;
  const a = aktuellerAuftrag;
  a.material = { werkstoff: gewaehlterWerkstoff, form: aktiveForm, masse: aktuelleMasse() };

  let meldung = a.nr + ' – Material gespeichert';
  if ($('statusMit').checked && a.status === 'angelegt') {
    a.status = 'planung';
    meldung = a.nr + ' → Status: Planung';
  }
  sichern();
  zeichneListe();
  toast(meldung);

  const naechster = naechsterOffener();
  if (naechster) oeffneMaterial(naechster);
  else { zeichneListe(); zeige('liste'); }
});

$('naechster').addEventListener('click', function () {
  const n = naechsterOffener();
  if (n && n !== aktuellerAuftrag) oeffneMaterial(n);
  else toast('Kein weiterer offener Auftrag', 'warn');
});

/* ---------------------------------------------------------
   Zeichnung: zoomen, schieben, Vollbild
   --------------------------------------------------------- */

const zf = $('zeichnungFlaeche');
let zoom = 1, vx = 0, vy = 0, zieht = false, startX = 0, startY = 0;
const zeiger = new Map();
let startAbstand = 0, startZoom = 1;

function zeichnungZuruecksetzen() { zoom = 1; vx = 0; vy = 0; wendeAn(); }
function wendeAn() {
  const svg = zf.querySelector('svg');
  if (svg) svg.style.transform = 'translate(' + vx + 'px,' + vy + 'px) scale(' + zoom + ')';
}

zf.addEventListener('pointerdown', function (e) {
  zeiger.set(e.pointerId, e);
  zf.setPointerCapture(e.pointerId);
  if (zeiger.size === 1) { zieht = true; startX = e.clientX - vx; startY = e.clientY - vy; }
  if (zeiger.size === 2) {
    const p = Array.from(zeiger.values());
    startAbstand = Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
    startZoom = zoom;
    zieht = false;
  }
});
zf.addEventListener('pointermove', function (e) {
  if (!zeiger.has(e.pointerId)) return;
  zeiger.set(e.pointerId, e);
  if (zeiger.size === 2) {
    const p = Array.from(zeiger.values());
    const abstand = Math.hypot(p[0].clientX - p[1].clientX, p[0].clientY - p[1].clientY);
    zoom = Math.min(6, Math.max(1, startZoom * (abstand / startAbstand)));
    wendeAn();
  } else if (zieht && zoom > 1) {
    vx = e.clientX - startX;
    vy = e.clientY - startY;
    wendeAn();
  }
});
['pointerup', 'pointercancel'].forEach(function (typ) {
  zf.addEventListener(typ, function (e) { zeiger.delete(e.pointerId); zieht = false; });
});
zf.addEventListener('wheel', function (e) {
  e.preventDefault();
  zoom = Math.min(6, Math.max(1, zoom - e.deltaY * 0.0015));
  if (zoom === 1) { vx = 0; vy = 0; }
  wendeAn();
}, { passive: false });
zf.addEventListener('dblclick', zeichnungZuruecksetzen);

$('zeichnungGross').addEventListener('click', function () {
  koerper.classList.toggle('zeichnung-voll');
  $('zeichnungGross').textContent = koerper.classList.contains('zeichnung-voll') ? 'Schließen' : 'Vollbild';
  if (koerper.classList.contains('zeichnung-voll')) numpadZu();
  $('zurueck').hidden = false;
});
function vollbildAus() {
  koerper.classList.remove('zeichnung-voll');
  $('zeichnungGross').textContent = 'Vollbild';
}

/* ---------------------------------------------------------
   Planen - von überall erreichbar
   --------------------------------------------------------- */

$('planFab').addEventListener('click', function () {
  if (aktiveAnsicht === 'material' && aktuellerAuftrag) oeffnePlanDialog(aktuellerAuftrag);
  else oeffneAuftragswahl();
});

function oeffneAuftragswahl() {
  $('wahlDialog').hidden = false;
  $('wahlSuche').value = '';
  zeichneWahlliste('');
  setTimeout(function () { $('wahlSuche').focus(); }, 60);
}

$('wahlSuche').addEventListener('input', function () { zeichneWahlliste(this.value); });
$('wahlAbbruch').addEventListener('click', function () { $('wahlDialog').hidden = true; });

function passt(a, text) {
  const s = text.trim().toLowerCase();
  if (!s) return true;
  return (a.nr + ' ' + a.kunde + ' ' + a.teil).toLowerCase().indexOf(s) !== -1;
}

function zeichneWahlliste(text) {
  const ziel = $('wahlListe');
  ziel.innerHTML = '';
  auftraege.filter(function (a) { return passt(a, text); }).forEach(function (a) {
    const b = document.createElement('button');
    b.className = 'wahl-zeile';
    b.innerHTML = '<span><b>' + a.nr + '</b><small>' + a.teil + ' · ' + a.kunde + '</small></span>' +
      '<span class="status-pille status-' + a.status + '">' + statusText(a.status) + '</span>';
    b.addEventListener('click', function () {
      $('wahlDialog').hidden = true;
      oeffnePlanDialog(a);
    });
    ziel.append(b);
  });
}

function oeffnePlanDialog(auftrag) {
  if (!adminAn()) { toast('Nur im Administrator-Modus', 'fehler'); return; }
  planZiel = auftrag;
  $('planAuftrag').textContent = auftrag.nr + ' · ' + auftrag.teil + ' · ' + auftrag.stueck + ' Stück';
  $('planTermin').value = (auftrag.planung && auftrag.planung.termin) || heuteIso(3);
  $('planMaschine').value = (auftrag.planung && auftrag.planung.maschine) || 'Laser 1';
  $('planBemerkung').value = (auftrag.planung && auftrag.planung.bemerkung) || '';
  $('planTitel').textContent = auftrag.planung ? 'Auftrag umplanen' : 'Auftrag einplanen';
  $('planDialog').hidden = false;
  numpadZu();
}

function heuteIso(plusTage) {
  const d = new Date();
  d.setDate(d.getDate() + (plusTage || 0));
  return d.toISOString().slice(0, 10);
}

$('planAbbruch').addEventListener('click', function () { $('planDialog').hidden = true; });

$('planOk').addEventListener('click', function () {
  if (!planZiel) return;
  planZiel.planung = {
    termin: $('planTermin').value,
    maschine: $('planMaschine').value,
    bemerkung: $('planBemerkung').value.trim()
  };
  if (planZiel.status === 'angelegt') planZiel.status = 'planung';
  sichern();
  $('planDialog').hidden = true;
  zeichneListe();
  zeichnePlanliste();
  if (aktiveAnsicht === 'material' && aktuellerAuftrag === planZiel) {
    $('matStatus').textContent = statusText(planZiel.status);
    $('matStatus').className = 'status-pille status-' + planZiel.status;
  }
  toast(planZiel.nr + ' geplant auf ' + datumText(planZiel.planung.termin));
});

/* ----- Ansicht "Planen" ----- */

$('planSuche').addEventListener('input', function () { zeichnePlanliste(this.value); });

function zeichnePlanliste(text) {
  const ziel = $('planListe');
  if (!ziel) return;
  ziel.innerHTML = '';
  auftraege.filter(function (a) { return passt(a, text || $('planSuche').value || ''); }).forEach(function (a) {
    const karte = document.createElement('div');
    karte.className = 'karte';
    karte.innerHTML =
      '<div><h3>' + a.nr + '</h3><div class="zeile2">' + a.teil + ' · ' + a.kunde + '</div></div>' +
      '<span class="status-pille status-' + a.status + '">' + statusText(a.status) + '</span>' +
      '<div class="material">' + (a.planung
        ? 'Termin ' + datumText(a.planung.termin) + ' · ' + a.planung.maschine +
          (a.planung.bemerkung ? ' · ' + a.planung.bemerkung : '')
        : 'Noch nicht geplant') + '</div>';
    const knoepfe = document.createElement('div');
    knoepfe.className = 'knoepfe';
    const b = document.createElement('button');
    b.className = 'klein-btn blau';
    b.textContent = a.planung ? 'Umplanen' : 'Planen';
    b.addEventListener('click', function () { oeffnePlanDialog(a); });
    const bm = document.createElement('button');
    bm.className = 'klein-btn';
    bm.textContent = 'Material';
    bm.addEventListener('click', function () { oeffneMaterial(a); });
    knoepfe.append(b, bm);
    karte.append(knoepfe);
    ziel.append(karte);
  });
}

/* ---------------------------------------------------------
   Toast
   --------------------------------------------------------- */

let toastTimer = null;
function toast(text, art) {
  const t = $('toast');
  t.textContent = text;
  t.className = art || '';
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
}

/* ---------------------------------------------------------
   Kopfhöhe für die klebende Zeichnung
   --------------------------------------------------------- */

function messeKopf() {
  document.documentElement.style.setProperty('--kopf-h', $('kopf').offsetHeight + 'px');
}
window.addEventListener('resize', messeKopf);
messeKopf();

/* ---------------------------------------------------------
   Start
   --------------------------------------------------------- */

zeichneListe();
zeichnePlanliste('');
zeige('liste');
