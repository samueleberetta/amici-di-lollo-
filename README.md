# Viaggi magici Lollo 23 – Landing di Natale 2026

Landing per le aziende che vogliono regalare i "pacchetti di viaggi magici" dell'Associazione Amici di Lollo ODV. Il pagamento avviene solo con bonifico.

## Come è fatta

```
public/
  index.html        la pagina (CSS e JS inline, PDF generato nel browser con jsPDF)
  bonifico.js       dati del bonifico e prezzo per viaggio (unica fonte, letta da pagina e funzione)
  img/              logo, lucine, auto col fiocco (auto-strada.webp con cielo e strada trasparenti), og.jpg, favicon
api/
  ordine.js         funzione Vercel: ricontrolla l'ordine e ve lo invia via email con Resend
scripts/
  estrai-immagini.js  estrae le immagini base64 dalla mail in public/img/
  prepara-auto.py     rigenera auto-strada.webp dalla foto auto-fiocco.jpg
vercel.json
```

Flusso: l'azienda compila il form, il browser genera il PDF `Lollo23_<codice>.pdf` con i dati per il bonifico e lo scarica, poi lo manda a `/api/ordine`. La funzione ricalcola il totale e invia **una sola email, a voi** (`ORDER_TO_EMAIL`): "Nuovo ordine … – Azienda X ha ordinato N viaggi – Z €", con tutti i dati e il PDF allegato. Rispondendo a quella email scrivete direttamente al referente dell'azienda.

All'azienda non arriva nessuna email automatica: i dati per il bonifico sono nel PDF, che può riscaricare dalla pagina.

## Provarla in locale

Serve la [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`). Dalla cartella del progetto:

```bash
vercel link
```

Crea un file `.env.local` (non va su git):

```
RESEND_API_KEY=re_xxxxxxxxx
ORDER_TO_EMAIL=la-tua-email@esempio.it
FROM_EMAIL=Amici di Lollo <onboarding@resend.dev>
```

Poi:

```bash
vercel dev
```

e aprite http://localhost:3000.

> **Importante:** con il mittente `onboarding@resend.dev` Resend consegna **solo all'indirizzo con cui avete creato l'account Resend**. Quindi `ORDER_TO_EMAIL` deve essere quell'indirizzo. Così non serve verificare nessun dominio.

## Variabili d'ambiente su Vercel

Vercel → progetto → **Settings → Environment Variables**, per l'ambiente *Production* (e *Preview* se vi serve):

| Nome | Valore |
|---|---|
| `RESEND_API_KEY` | la chiave API di Resend (resend.com → API Keys) |
| `ORDER_TO_EMAIL` | dove arrivano gli ordini: l'email del vostro account Resend |
| `FROM_EMAIL` | `Amici di Lollo <onboarding@resend.dev>` |

Dopo aver cambiato le variabili serve un nuovo deploy.

### Se volete ricevere gli ordini su più indirizzi

Solo in questo caso serve verificare il dominio: resend.com → **Domains → Add domain** → `amicidilollo.it`, aggiungete nel DNS i record che Resend indica, poi impostate `FROM_EMAIL` a `Amici di Lollo <natale@amicidilollo.it>` e mettete in `ORDER_TO_EMAIL` più indirizzi separati da virgola.

## Deploy

```bash
vercel --prod
```

Oppure collegate la cartella a un repository GitHub e importatelo su Vercel: ogni push fa il deploy da solo. Non c'è nessun build step.

Il bottone della mail di proposta (`mail_regali_aziendali_lollo23.html`) punta a `https://amici-di-lollo.vercel.app/#ordina`. Se il progetto Vercel ha un altro nome o usate un dominio vostro, aggiornate quel link e il meta `og:image` in `public/index.html`.

## Cambiare IBAN e prezzi

Tutto è in `public/bonifico.js`:

```js
var BONIFICO = {
  intestatario: 'AMICI DI LOLLO ODV',
  iban: 'IT25 L084 5333 2700 0000 0178 864',
  banca: 'BCC di Milano',
  bic: '',
  causale_prefisso: 'Dono solidale Lollo 23',
  prezzo_viaggio: 5
};
```

- **IBAN, banca, intestatario, BIC:** modificateli qui; se `bic` è vuoto non viene mostrato.
- **Prezzo:** `prezzo_viaggio` è il costo di un viaggio in euro. I prezzi dei pacchetti (5 e 10 viaggi) sulla pagina, nel PDF e nell'email d'ordine si calcolano da qui.
- **Causale:** `causale_prefisso` + codice ordine + nome azienda (massimo 140 caratteri).

Pagina e funzione leggono lo stesso file: dopo la modifica basta un nuovo deploy.

Le dimensioni dei pacchetti fissi (5 e 10 viaggi) sono nel codice: `public/index.html` (form, card, PDF) e `api/ordine.js` (funzione `valida`).
