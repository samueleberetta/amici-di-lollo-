// Riceve l'ordine dalla landing, gli assegna il numero progressivo (Lollo23-26001, 26002…) con il contatore
// su Upstash Redis e lo invia via email (Resend) all'associazione (ORDER_TO_EMAIL). Restituisce il codice alla
// pagina, che crea il PDF per il bonifico. Al cliente non parte nessuna email.
const BONIFICO = require('../public/bonifico.js');

const PREZZO = Number(BONIFICO.prezzo_viaggio) || 5;
const RESEND_URL = 'https://api.resend.com/emails';
const MAX_ORDINI = 999;

const C = {
  navy: '#13284a', rosso: '#c8102e', testo: '#2b3445', grigio: '#5b6577',
};
const FONT = "'Montserrat',Arial,Helvetica,sans-serif";
const FONT_H = "'Fredoka','Montserrat',Arial,sans-serif";

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
const br = (s) => esc(s).replace(/\r?\n/g, '<br>');
const euro = (n) => n.toLocaleString('it-IT') + ' €';

function testo(v, max, obbligatorio, nome, errori) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (obbligatorio && !s) errori.push(`${nome} mancante`);
  if (s.length > max) errori.push(`${nome} troppo lungo`);
  return s.slice(0, max);
}
function intero(v, min, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function valida(b) {
  const e = [];
  const tipo = b.tipo === 'azienda' || b.tipo === 'privato' ? b.tipo : '';
  if (!tipo) e.push('Tipo di cliente mancante (azienda o privato)');
  const o = {
    tipo,
    azienda: testo(tipo === 'azienda' ? b.azienda : '', 120, tipo === 'azienda', 'Ragione sociale', e),
    sede: testo(tipo === 'azienda' ? b.sede : '', 300, tipo === 'azienda', 'Sede legale', e),
    piva: tipo === 'azienda' && typeof b.piva === 'string' ? b.piva.replace(/\s+/g, '').replace(/^IT/i, '') : '',
    nome: testo(b.nome, 60, true, 'Nome', e),
    cognome: testo(b.cognome, 60, true, 'Cognome', e),
    email: testo(b.email, 160, true, 'Email', e),
    telefono: testo(b.telefono, 40, false, 'Telefono', e),
    consegna: b.consegna === 'spedizione' ? 'spedizione' : 'mano',
    indirizzo: testo(b.indirizzo, 300, false, 'Indirizzo', e),
    note: testo(b.note, 1000, false, 'Note', e),
  };
  if (tipo === 'azienda' && !/^\d{11}$/.test(o.piva)) e.push('Partita IVA non valida');
  // per i privati il nome dell'ordine (causale, oggetto dell'email) è "Nome Cognome"
  if (tipo === 'privato') o.azienda = `${o.nome} ${o.cognome}`.trim();
  if (o.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(o.email)) e.push('Email non valida');
  if (!o.indirizzo) e.push('Indirizzo di consegna mancante');
  if (b.privacy !== true) e.push('Consenso privacy mancante');

  o.q2 = intero(b.q2 || 0, 0, 1000);
  o.q5 = intero(b.q5 || 0, 0, 1000);
  o.q10 = intero(b.q10 || 0, 0, 1000);
  if (o.q2 === null) e.push('Quantità doni solidali da 2 non valida');
  if (o.q5 === null) e.push('Quantità doni solidali da 5 non valida');
  if (o.q10 === null) e.push('Quantità doni solidali da 10 non valida');

  // Il totale si ricalcola sempre qui, mai dal client
  o.pacchetti = (o.q2 || 0) + (o.q5 || 0) + (o.q10 || 0);
  o.viaggi = (o.q2 || 0) * 2 + (o.q5 || 0) * 5 + (o.q10 || 0) * 10;
  o.totale = o.viaggi * PREZZO;
  if (o.pacchetti < 1) e.push('Serve almeno un dono solidale');

  return { o, errori: e };
}

function causale(codice, azienda) {
  const c = `${BONIFICO.causale_prefisso} – ${codice} – ${azienda}`;
  return c.length > 140 ? c.slice(0, 139) + '…' : c;
}

// Contatore degli ordini su Upstash Redis (INCR è atomico: due ordini insieme non prendono mai lo stesso numero).
// Una chiave per anno: lollo23:ordini:26 → Lollo23-26001, 26002… fino a 26999.
async function prossimoCodice() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const anno = new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', year: '2-digit' });
  const r = await fetch(`${url.replace(/\/+$/, '')}/incr/lollo23:ordini:${anno}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !Number.isInteger(j.result)) {
    throw new Error(`Contatore non disponibile (${r.status}): ${JSON.stringify(j)}`);
  }
  if (j.result > MAX_ORDINI) return null;
  return `Lollo23-${anno}${String(j.result).padStart(3, '0')}`;
}

function righePacchetti(o) {
  const r = [];
  if (o.q2) r.push({ nome: 'Dono solidale da 2 viaggi magici', qta: o.q2, viaggi: o.q2 * 2 });
  if (o.q5) r.push({ nome: 'Dono solidale da 5 viaggi magici', qta: o.q5, viaggi: o.q5 * 5 });
  if (o.q10) r.push({ nome: 'Dono solidale da 10 viaggi magici', qta: o.q10, viaggi: o.q10 * 10 });
  return r;
}

function tabellaPacchetti(o) {
  const td = `style="padding:9px 10px;border-bottom:1px solid #e1e5eb;font-family:${FONT};font-size:14px;color:${C.testo};"`;
  const th = (a) => `style="padding:9px 10px;background:${C.navy};color:#ffffff;font-family:${FONT};font-size:12px;letter-spacing:1px;text-align:${a};"`;
  const righe = righePacchetti(o).map((r) => `<tr><td ${td}>${esc(r.nome)}</td><td ${td} align="center">${r.qta}</td><td ${td} align="center">${r.viaggi}</td><td ${td} align="right">${euro(r.viaggi * PREZZO)}</td></tr>`).join('');
  const tot = `style="padding:11px 10px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.navy};"`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr><th ${th('left')}>DONO SOLIDALE</th><th ${th('center')}>QTÀ</th><th ${th('center')}>VIAGGI</th><th ${th('right')}>IMPORTO</th></tr>
${righe}
<tr><td ${tot}>Totale</td><td ${tot} align="center">${o.pacchetti}</td><td ${tot} align="center">${o.viaggi}</td><td ${tot} align="right">${euro(o.totale)}</td></tr>
</table>`;
}

function dataOraItaliana() {
  return new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'full', timeStyle: 'short' });
}

function emailInterna(o) {
  const riga = (k, v) => `<tr><td style="padding:7px 12px 7px 0;font-family:${FONT};font-size:13px;color:${C.grigio};font-weight:700;vertical-align:top;white-space:nowrap;">${k}</td><td style="padding:7px 0;font-family:${FONT};font-size:14px;color:${C.testo};">${v}</td></tr>`;
  return `<!DOCTYPE html><html lang="it"><body style="margin:0;padding:20px;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
<tr><td style="font-family:${FONT_H};font-size:22px;color:${C.navy};font-weight:600;padding-bottom:4px;">Nuovo ordine ${esc(o.codice)}</td></tr>
<tr><td style="font-family:${FONT};font-size:13px;color:${C.grigio};padding-bottom:12px;">${esc(dataOraItaliana())}</td></tr>
<tr><td style="font-family:${FONT};font-size:16px;color:${C.testo};padding-bottom:16px;"><strong>${esc(o.azienda)}</strong> ha ordinato <strong>${o.pacchetti} ${o.pacchetti === 1 ? 'dono solidale' : 'doni solidali'}</strong> per un totale di <strong>${o.viaggi} viaggi</strong>, cioè <strong>${euro(o.totale)}</strong> da ricevere con bonifico.</td></tr>
<tr><td><table role="presentation" cellpadding="0" cellspacing="0">
${riga('Codice', `<strong style="color:${C.rosso};">${esc(o.codice)}</strong>`)}
${o.tipo === 'azienda'
    ? riga('Cliente', 'Azienda') + riga('Ragione sociale', esc(o.azienda)) + riga('Partita IVA', esc(o.piva)) + riga('Sede legale', br(o.sede)) + riga('Referente', esc(o.nome + ' ' + o.cognome))
    : riga('Cliente', 'Privato') + riga('Nome', esc(o.nome + ' ' + o.cognome))}
${riga('Email', `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`)}
${riga('Telefono', o.telefono ? esc(o.telefono) : '—')}
${riga('Doni solidali', String(o.pacchetti))}
${riga('Viaggi', String(o.viaggi))}
${riga('Totale', `<strong>${euro(o.totale)}</strong>`)}
${riga('Consegna', o.consegna === 'spedizione' ? 'Spedizione' : 'A mano')}
${riga('Indirizzo di consegna', br(o.indirizzo))}
${riga('Note', o.note ? br(o.note) : '—')}
${riga('Causale attesa', esc(o.causale))}
</table></td></tr>
<tr><td style="padding-top:18px;">${tabellaPacchetti(o)}</td></tr>
<tr><td style="padding-top:16px;font-family:${FONT};font-size:12px;color:${C.grigio};">Rispondendo a questa email scrivete direttamente al referente.</td></tr>
</table></body></html>`;
}

async function inviaEmail(dati) {
  const r = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(dati),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => '');
    console.error(`Errore Resend (${r.status}) verso ${dati.to}:`, corpo);
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Metodo non consentito' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, error: 'Richiesta non valida' });
  }

  // Honeypot pieno: probabilmente un bot. Rispondiamo ok senza inviare nulla.
  if (typeof body.sito_web === 'string' && body.sito_web.trim() !== '') {
    return res.status(200).json({ ok: true });
  }

  const { o, errori } = valida(body);
  if (errori.length) {
    return res.status(400).json({ ok: false, error: errori.join('; ') });
  }

  const { RESEND_API_KEY, ORDER_TO_EMAIL } = process.env;
  // mittente di prova di Resend finché non si verifica il dominio amicidilollo.it
  const FROM_EMAIL = process.env.FROM_EMAIL || 'Amici di Lollo <onboarding@resend.dev>';
  // solo i nomi delle variabili mancanti, mai i valori
  const mancanti = [];
  if (!RESEND_API_KEY) mancanti.push('RESEND_API_KEY');
  if (!ORDER_TO_EMAIL) mancanti.push('ORDER_TO_EMAIL');
  if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) mancanti.push('KV_REST_API_URL');
  if (!process.env.KV_REST_API_TOKEN && !process.env.UPSTASH_REDIS_REST_TOKEN) mancanti.push('KV_REST_API_TOKEN');
  if (mancanti.length) {
    console.error('Variabili d\'ambiente mancanti:', mancanti.join(', '));
    return res.status(500).json({ ok: false, error: 'Configurazione del server incompleta: manca ' + mancanti.join(', ') });
  }

  try {
    o.codice = await prossimoCodice();
  } catch (err) {
    console.error('Errore del contatore ordini:', err);
    return res.status(502).json({ ok: false, error: 'Numerazione degli ordini non disponibile' });
  }
  if (!o.codice) {
    console.error(`Numerazione esaurita: superati i ${MAX_ORDINI} ordini dell'anno`);
    return res.status(409).json({ ok: false, error: 'Numerazione degli ordini esaurita' });
  }
  o.causale = causale(o.codice, o.azienda);

  try {
    const inviata = await inviaEmail({
      from: FROM_EMAIL,
      to: ORDER_TO_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: o.email,
      subject: `Nuovo ordine ${o.codice} – ${o.azienda} ha ordinato ${o.viaggi} viaggi – ${o.totale} €`,
      html: emailInterna(o),
    });
    if (!inviata) {
      return res.status(502).json({ ok: false, error: 'Invio dell\'ordine non riuscito' });
    }
    return res.status(200).json({ ok: true, codice: o.codice });
  } catch (err) {
    console.error('Errore di rete verso Resend:', err);
    return res.status(502).json({ ok: false, error: 'Invio dell\'ordine non riuscito' });
  }
};
