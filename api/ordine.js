// Riceve l'ordine dalla landing e lo invia via email (Resend) all'associazione (ORDER_TO_EMAIL).
// Al cliente non parte nessuna email: i dati per il bonifico sono nel PDF che scarica dalla pagina.
const BONIFICO = require('../public/bonifico.js');

const PREZZO = Number(BONIFICO.prezzo_viaggio) || 5;
const MAX_PDF_BYTES = 2 * 1024 * 1024;
const RESEND_URL = 'https://api.resend.com/emails';

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
  const o = {
    codice: typeof b.codice === 'string' ? b.codice : '',
    azienda: testo(b.azienda, 120, true, 'Azienda', e),
    nome: testo(b.nome, 60, true, 'Nome', e),
    cognome: testo(b.cognome, 60, true, 'Cognome', e),
    email: testo(b.email, 160, true, 'Email', e),
    telefono: testo(b.telefono, 40, false, 'Telefono', e),
    consegna: b.consegna === 'spedizione' ? 'spedizione' : 'mano',
    indirizzo: testo(b.indirizzo, 300, false, 'Indirizzo', e),
    note: testo(b.note, 1000, false, 'Note', e),
  };
  if (!/^L23-\d{4}-[A-Z0-9]{4}$/.test(o.codice)) e.push('Codice ordine non valido');
  if (o.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(o.email)) e.push('Email non valida');
  if (o.consegna === 'spedizione' && !o.indirizzo) e.push('Indirizzo di spedizione mancante');
  if (o.consegna === 'mano') o.indirizzo = '';
  if (b.privacy !== true) e.push('Consenso privacy mancante');

  o.q5 = intero(b.q5 || 0, 0, 1000);
  o.q10 = intero(b.q10 || 0, 0, 1000);
  if (o.q5 === null) e.push('Quantità doni solidali da 5 non valida');
  if (o.q10 === null) e.push('Quantità doni solidali da 10 non valida');

  o.custom = [];
  const custom = Array.isArray(b.custom) ? b.custom : [];
  if (custom.length > 20) e.push('Troppi doni solidali su misura');
  custom.slice(0, 20).forEach((c) => {
    const p = intero(c && c.pacchetti, 1, 1000);
    const v = intero(c && c.viaggi, 1, 100);
    if (p === null || v === null) e.push('Dono solidale su misura non valido');
    else o.custom.push({ pacchetti: p, viaggi: v });
  });

  // Il totale si ricalcola sempre qui, mai dal client
  o.pacchetti = (o.q5 || 0) + (o.q10 || 0) + o.custom.reduce((s, c) => s + c.pacchetti, 0);
  o.viaggi = (o.q5 || 0) * 5 + (o.q10 || 0) * 10 + o.custom.reduce((s, c) => s + c.pacchetti * c.viaggi, 0);
  o.totale = o.viaggi * PREZZO;
  if (o.pacchetti < 1) e.push('Serve almeno un dono solidale');

  o.pdf = typeof b.pdf === 'string' ? b.pdf.replace(/\s/g, '') : '';
  if (!o.pdf || !/^[A-Za-z0-9+/]+=*$/.test(o.pdf)) e.push('PDF mancante');
  else if (Buffer.byteLength(o.pdf, 'base64') > MAX_PDF_BYTES) e.push('PDF troppo grande');

  let causale = `${BONIFICO.causale_prefisso} – ${o.codice} – ${o.azienda}`;
  if (causale.length > 140) causale = causale.slice(0, 139) + '…';
  o.causale = causale;
  return { o, errori: e };
}

function righePacchetti(o) {
  const r = [];
  if (o.q5) r.push({ nome: 'Dono solidale da 5 viaggi magici', qta: o.q5, viaggi: o.q5 * 5 });
  if (o.q10) r.push({ nome: 'Dono solidale da 10 viaggi magici', qta: o.q10, viaggi: o.q10 * 10 });
  o.custom.forEach((c) => r.push({ nome: `Dono solidale su misura da ${c.viaggi} viaggi`, qta: c.pacchetti, viaggi: c.pacchetti * c.viaggi }));
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
${riga('Azienda', esc(o.azienda))}
${riga('Referente', esc(o.nome + ' ' + o.cognome))}
${riga('Email', `<a href="mailto:${esc(o.email)}">${esc(o.email)}</a>`)}
${riga('Telefono', o.telefono ? esc(o.telefono) : '—')}
${riga('Doni solidali', String(o.pacchetti))}
${riga('Viaggi', String(o.viaggi))}
${riga('Totale', `<strong>${euro(o.totale)}</strong>`)}
${riga('Consegna', o.consegna === 'spedizione' ? 'Spedizione<br>' + br(o.indirizzo) : 'A mano')}
${riga('Note', o.note ? br(o.note) : '—')}
${riga('Causale attesa', esc(o.causale))}
</table></td></tr>
<tr><td style="padding-top:18px;">${tabellaPacchetti(o)}</td></tr>
<tr><td style="padding-top:16px;font-family:${FONT};font-size:12px;color:${C.grigio};">In allegato il PDF con i dati per il bonifico, lo stesso che ha scaricato il cliente. Rispondendo a questa email scrivete direttamente al referente.</td></tr>
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

  const { RESEND_API_KEY, ORDER_TO_EMAIL, FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !ORDER_TO_EMAIL || !FROM_EMAIL) {
    console.error('Variabili d\'ambiente mancanti: servono RESEND_API_KEY, ORDER_TO_EMAIL e FROM_EMAIL');
    return res.status(500).json({ ok: false, error: 'Configurazione del server incompleta' });
  }

  try {
    const inviata = await inviaEmail({
      from: FROM_EMAIL,
      to: ORDER_TO_EMAIL.split(',').map((s) => s.trim()).filter(Boolean),
      reply_to: o.email,
      subject: `Nuovo ordine ${o.codice} – ${o.azienda} ha ordinato ${o.viaggi} viaggi – ${o.totale} €`,
      html: emailInterna(o),
      attachments: [{ filename: `Lollo23_${o.codice}.pdf`, content: o.pdf }],
    });
    if (!inviata) {
      return res.status(502).json({ ok: false, error: 'Invio dell\'ordine non riuscito' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Errore di rete verso Resend:', err);
    return res.status(502).json({ ok: false, error: 'Invio dell\'ordine non riuscito' });
  }
};
