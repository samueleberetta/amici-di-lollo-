// Dati per il bonifico e prezzo per viaggio: unica fonte, letta dalla pagina (come script) e da api/ordine.js (con require).
var BONIFICO = {
  intestatario: 'AMICI DI LOLLO ODV',
  iban: 'IT25 L084 5333 2700 0000 0178 864',
  banca: 'BCC di Milano',
  bic: '',
  causale_prefisso: 'Dono solidale Lollo 23',
  prezzo_viaggio: 5
};
if (typeof module === 'object' && module.exports) module.exports = BONIFICO;
