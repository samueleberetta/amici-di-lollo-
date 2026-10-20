// Genera public/coriandoli.json: l'animazione Lottie dei coriandoli mostrata nella schermata di ringraziamento.
// Stessa struttura del componente "confetti" (4 gruppi di colori × 8 coriandoli, 3 copie sfalsate),
// con i colori delle lucine del brand. Uso: node scripts/genera-coriandoli.js
const fs = require('fs');
const path = require('path');

const COLORI = {
  BlueConfetti: [0.310, 0.714, 0.949, 1],   // #4fb6f2
  GreenConfetti: [0.478, 0.757, 0.259, 1],  // #7ac142
  YellowConfetti: [1, 0.878, 0.106, 1],     // #ffe01b
  RedConfetti: [0.910, 0.149, 0.235, 1],    // #e8263c
};

// [x, inizio caduta, ip, op, st] per ogni coriandolo
const GRUPPI = {
  BlueConfetti: [[688, 175, 175, 1075, 175], [1088, 225, 225, 1125, 225], [1408, 81, 81, 981, 81], [1968, 145, 145, 1045, 145],
    [848, 98, 98, 369, 98], [368, 50, 50, 300, 50], [1728, 14, 14, 300, 14], [1248, -1, 0, 300, -1]],
  GreenConfetti: [[368, 62, 62, 962, 62], [1328, 190, 190, 1090, 190], [848, 125, 125, 1025, 125], [1328, 41, 41, 941, 41],
    [1088, 142, 142, 413, 142], [608, 212, 212, 462, 212], [1088, -9, -9, 277, -9], [1728, 37, 38, 338, 37]],
  YellowConfetti: [[288, -1, -1, 899, -1], [1424, 160, 160, 1060, 160], [528, 12, 12, 912, 12], [1168, 45, 45, 945, 45],
    [768, 220, 220, 491, 220], [2016, -1, -1, 249, -1], [1968, 178, 178, 464, 178], [1568, 94, 95, 395, 94]],
  RedConfetti: [[1568, 169, 169, 1069, 169], [1104, 67, 67, 967, 67], [928, 232, 232, 1132, 232], [1968, 112, 112, 1012, 112],
    [1248, 328, 328, 599, 328], [2016, 259, 259, 509, 259], [608, 0, 0, 286, 0], [1808, 55, 56, 356, 55]],
};

const E = { i: { x: 0.833, y: 0.833 }, o: { x: 0.167, y: 0.167 } };
const E2 = { i: { x: [0.833, 0.833], y: [0.833, 0.833] }, o: { x: [0.167, 0.167], y: [0.167, 0.167] } };
const st = (k) => ({ a: 0, k });

function coriandolo(ind, colore, [x, t, ip, op, start]) {
  const pos = [
    [0, [-256, -748], [0, 4.316], [0.521, -4.829]],
    [1, [-256.803, -794.275], [-6.566, 60.819], [0, -108.389]],
    [21, [-308, -464.77], [0, 131.094], [-6.457, -163.134]],
    [56, [-227.949, -12.545], [7.89, 199.325], [9.338, -174.954]],
    [101, [-297.153, 568.725], [-8.732, 163.591], [0, -75.105]],
    [130, [-256, 943], [0, 279.833], [0, -0.667]],
  ].map(([d, s, to, ti]) => ({ ...E, t: t + d, s, to, ti }));
  pos.push({ t: t + 174, s: [-168, 1299] });
  const scala = [[2, 100], [36, 1], [68, 100], [126, 1]].map(([d, y]) => ({ ...E2, t: t + d, s: [100, y] }));
  scala.push({ t: t + 174, s: [100, 100] });
  return {
    ddd: 0, ind, ty: 4, nm: 'Coriandolo ' + ind, sr: 1,
    ks: { o: st(100), r: st(0), p: st([x, 732, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]) },
    ao: 0,
    shapes: [{
      ty: 'gr', nm: 'Rettangolo',
      it: [
        { ty: 'rc', d: 1, s: st([32, 32]), p: st([0, 0]), r: st(0) },
        { ty: 'fl', c: st(colore), o: st(100), r: 1, bm: 0 },
        {
          ty: 'tr', a: st([0, 0]), o: st(100), sk: st(0), sa: st(0),
          p: { a: 1, k: pos },
          s: { a: 1, k: scala },
          r: { a: 1, k: [{ i: { x: [0.833], y: [0.833] }, o: { x: [0.167], y: [0.167] }, t, s: [0] }, { t: t + 174, s: [277.579] }] },
        },
      ],
      np: 2, cix: 2, bm: 0,
    }],
    ip, op, st: start, bm: 0,
  };
}

const precomp = (refId, ind, ip, op, start) => ({
  ddd: 0, ind, ty: 0, nm: refId, refId, sr: 1,
  ks: { o: st(100), r: st(0), p: st([1000, 1000, 0]), a: st([1000, 1000, 0]), s: st([100, 100, 100]) },
  ao: 0, w: 2000, h: 2000, ip, op, st: start, bm: 0,
});

const nomi = Object.keys(GRUPPI);
const assets = [{
  id: 'tutti',
  layers: [
    precomp(nomi[0], 1, 150, 450, 150), precomp(nomi[0], 2, 0, 300, -150),
    precomp(nomi[1], 3, 150, 450, 150), precomp(nomi[1], 4, 0, 299, -150),
    precomp(nomi[2], 5, 150, 516, 150), precomp(nomi[2], 6, 0, 300, -149),
    precomp(nomi[3], 7, 150, 750, 150), precomp(nomi[3], 8, 0, 450, -150),
  ],
}, ...nomi.map((n) => ({ id: n, layers: GRUPPI[n].map((c, i) => coriandolo(i + 1, COLORI[n], c)) }))];

const copia = (ind, p, s) => ({
  ddd: 0, ind, ty: 0, nm: 'Coriandoli', refId: 'tutti', sr: 1,
  ks: { o: st(100), r: st(0), p: st([...p, 0]), a: st([1000, 1000, 0]), s: st([...s, 100]) },
  ao: 0, w: 2000, h: 2000, ip: 0, op: 300, st: 0, bm: 0,
});

const anim = {
  v: '5.5.8', fr: 29.97, ip: 0, op: 300, w: 2000, h: 2000, nm: 'Coriandoli', ddd: 0, assets,
  layers: [copia(1, [1000, 1000], [100, 100]), copia(2, [592, 592], [146.4, 143.2]), copia(3, [1400, 1360], [153.6, 143.2])],
  markers: [],
};

const out = path.join(__dirname, '..', 'public', 'coriandoli.json');
fs.writeFileSync(out, JSON.stringify(anim));
console.log('Scritto', out, fs.statSync(out).size, 'byte');
