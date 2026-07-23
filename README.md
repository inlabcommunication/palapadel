# PalaPadel — Web app tornei e campionati

Fase 1 completata: struttura progetto, database (Firestore), autenticazione con ruoli, navigazione, Home pubblica.
Stack: Vite + React 19 + TypeScript + Tailwind + Firebase (Auth + Firestore, piano Spark/gratuito).

## 1. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com → **Aggiungi progetto** → chiamalo `palapadel` (o come preferisci).
2. Nel progetto, **Build > Authentication** → Inizia → abilita il provider **Email/Password**.
3. **Build > Firestore Database** → Crea database → modalità **produzione** → scegli una region europea (es. `eur3` o `europe-west`).
4. **Impostazioni progetto (icona ingranaggio) > Generale** → in fondo, sezione "Le tue app" → **Aggiungi app > Web** (icona `</>`) → dai un nome, NON serve Firebase Hosting (usiamo Vercel).
5. Copia i valori di configurazione mostrati (apiKey, authDomain, ecc.) — ti serviranno subito dopo.

## 2. Configura il progetto in locale

```bash
npm install
cp .env.example .env.local
```

Apri `.env.local` e incolla i valori copiati dalla console Firebase.

```bash
npm run dev
```

L'app parte su `http://localhost:5173`. Vedrai la Home vuota (nessun dato ancora).

## 3. Pubblica le regole di sicurezza Firestore

Le regole in `firestore.rules` sono già scritte per i tre ruoli (Super Amministratore, Amministratore, Gestore risultati). Per pubblicarle:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # scegli il progetto palapadel appena creato
firebase deploy --only firestore:rules
```

## 4. Crea il primo Super Amministratore (a mano, solo la prima volta)

Il Super Amministratore normale si crea da dentro l'app con solo nome utente e password (senza email, vedi sezione 8 più sotto), ma il *primissimo* va creato manualmente perché nessuno è ancora loggato:

1. Firebase Console → **Authentication > Users > Aggiungi utente** → inserisci un'email qualsiasi (anche una vera tua, va bene) e una password.
2. Copia lo **User UID** generato.
3. Firebase Console → **Firestore Database > Dati** → crea manualmente una collezione `users` → documento con ID = lo UID copiato, campi:
   - `uid`: lo stesso UID
   - `username`: il nome utente che vuoi usare per accedere (es. `nico`)
   - `role`: `superadmin`
   - `createdAt`: una data ISO qualsiasi, es. `2026-01-01T00:00:00.000Z`
4. Crea anche una collezione `usernameEmails` → documento con ID = il nome utente in minuscolo senza spazi (es. `nico`), campo:
   - `email`: l'email che hai usato al punto 1

Il passaggio 4 serve perché l'app permette il login con solo nome utente: internamente cerca l'email corrispondente in questa mappatura. Gli account creati dopo, dall'interfaccia, la generano da soli automaticamente.

Da qui in poi, accedendo con quel nome utente e password nell'app, avrai i permessi da Super Amministratore e potrai creare Amministratori e Gestori risultati direttamente dall'interfaccia, indicando solo nome utente e password.

## 5. Popola i dati demo (opzionale)

```bash
node scripts/seed.mjs
```

Nota: usa l'SDK client, quindi se le regole Firestore sono già quelle definitive (`isAdminOrAbove()`), lo script fallirà per permessi. Per il primo seed, o allenta temporaneamente le regole (`allow write: if true;`) e ripubblicale subito dopo, oppure autentica lo script — per semplicità, in Fase 1 la via più rapida è allentare temporaneamente le regole di scrittura, lanciare il seed, ripubblicare quelle vere.

## 6. GitHub

```bash
git init
git add .
git commit -m "Fase 1: struttura, Firebase, ruoli, Home pubblica"
gh repo create palapadel --private --source=. --remote=origin
git push -u origin main
```

(`gh` è la CLI di GitHub; se non ce l'hai, crea il repo vuoto da github.com e collega con `git remote add origin <url>`.)

## 7. Deploy su Vercel

1. Vai su https://vercel.com → **Add New > Project** → importa il repo GitHub appena creato.
2. Framework Preset: Vercel lo riconosce come **Vite** automaticamente.
3. Prima del deploy, aggiungi le **Environment Variables** (stessi valori di `.env.local`):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
4. Deploy. Ogni push su `main` farà un nuovo deploy automatico.
5. Torna su Firebase Console → **Authentication > Settings > Authorized domains** → aggiungi il dominio `*.vercel.app` (o il tuo dominio custom), altrimenti il login darà errore da produzione.

## 8. Abilita il cambio password (Super Amministratore) e il login con solo nome utente

Da questa versione, gli account non usano più email visibili: si accede con nome utente e password, e il Super Amministratore può cambiare la password di qualsiasi account. Per far funzionare il cambio password serve una piccola funzione server (già inclusa in `api/admin/set-password.js`), perché Firebase lato client permette a un utente di cambiare solo la propria password.

**Genera la chiave di servizio Firebase:**
1. Firebase Console → icona ingranaggio → **Impostazioni progetto**
2. Scheda **Account di servizio**
3. Clicca **Genera nuova chiave privata** → conferma → si scarica un file `.json`

**Aggiungilo come variabile d'ambiente su Vercel:**
1. Apri il file `.json` scaricato con un editor di testo, seleziona tutto il contenuto e copialo
2. Vercel → il tuo progetto → **Settings > Environment Variables**
3. Key: `FIREBASE_SERVICE_ACCOUNT`
4. Value: incolla l'intero contenuto del file JSON (tutto su una riga va bene, Vercel lo accetta come stringa)
5. Spunta Production (e Preview/Development se vuoi testare anche lì)
6. Salva, poi fai un **Redeploy** dall'ultima voce in Deployments

Da questo momento, nella sezione Gestione, il Super Amministratore vedrà "Cambia password di un account esistente": seleziona l'utente, inserisce la nuova password (con l'occhio per mostrarla o nasconderla) e conferma.

**Attenzione alla sicurezza:** il file `.json` della chiave di servizio dà accesso completo al progetto Firebase (bypassa tutte le regole). Non condividerlo, non caricarlo su GitHub, non incollarlo in chat: va solo nella variabile d'ambiente di Vercel.

## Cosa manca (fasi successive, come da specifica)

- **Fase 2**: creazione squadre/campionati/stagioni da interfaccia (ora solo via seed o console Firebase)
- **Fase 3**: giornate, partite, calcolo automatico dei punti, interfaccia completa Gestore risultati
- **Fase 4**: import Excel/Word, ritiro/squalifica con le 4 opzioni, storico dettagliato, Albo d'oro popolato automaticamente
- **Fase 5**: tabellone finale, notifiche push reali (richiede piano Blaze per le Cloud Functions, oppure un piccolo backend separato es. su Vercel Functions), audit log completo, rifinitura mobile, icone PWA reali (sostituire i placeholder in `public/`)

## Note tecniche importanti

- **Ruoli senza Cloud Functions**: il ruolo vive in `users/{uid}` su Firestore, non nei custom claims di Firebase Auth (che richiederebbero Cloud Functions e quindi il piano Blaze). Le regole Firestore leggono quel documento per decidere i permessi — funziona interamente sul piano Spark gratuito.
- **Creazione di nuovi amministratori** senza perdere la sessione del Super Amministratore: si usa una istanza Firebase secondaria "usa e getta" (vedi `getSecondaryAuth()` in `src/firebase.ts`), un pattern comune per questo esatto problema sul piano Spark.
- **Notifiche push reali** richiedono un service worker + VAPID keys + un modo per inviare (Cloud Function o backend esterno) — il piano Spark non supporta le Cloud Functions in uscita verso servizi esterni, quindi per la Fase 5 valuteremo un piccolo endpoint su Vercel (gratuito) che invia le notifiche invece di usare Cloud Functions.
