# PalaPadel â€” Web app tornei e campionati

Fase 1 completata: struttura progetto, database (Firestore), autenticazione con ruoli, navigazione, Home pubblica.
Stack: Vite + React 19 + TypeScript + Tailwind + Firebase (Auth + Firestore, piano Spark/gratuito) + funzioni serverless Vercel (Firebase Admin SDK) per il salvataggio dei risultati.

## Flusso risultati: RISULTATO â†’ SALVATAGGIO PARTITA â†’ RICALCOLO CLASSIFICA â†’ AUDIT LOG

Il frontend **non scrive mai** direttamente su `matches` o `editionTeams` per
inserire/correggere un risultato o cambiare lo stato di una partita (rinviata/annullata/
riapertura). Ogni azione passa da `src/lib/matchApi.ts`, che chiama gli endpoint
backend:

- `POST /api/matches/save-result` â€” un singolo risultato o cambio di stato.
- `POST /api/matches/save-bulk` - tutti i risultati/stati di una giornata in un colpo solo.
- `POST /api/matches/update-match` - modifica squadre/giornata di una partita con validazioni atomiche.

Gli endpoint partita (Firebase Admin SDK, `api/matches/*.js`) eseguono **una singola transazione
Firestore**: leggono partita ed edizione, validano ruolo/stato/risultato, aggiornano la
partita, ricalcolano da zero la classifica di tutta l'edizione, aggiornano `editionTeams`
e scrivono l'audit log â€” tutto o niente. Le regole Firestore (`firestore.rules`) negano
al client qualunque scrittura diretta su `matches` (update) ed `editionTeams` per i ruoli
diversi da admin/superAdmin: l'unico modo per il resultManager di salvare un risultato Ã¨
passare dagli endpoint. Le transazioni gestiscono anche la concorrenza: due salvataggi
quasi simultanei sulla stessa edizione non si sovrascrivono, Firestore rilegge e riesegue
automaticamente in caso di conflitto.

### Ruoli e permessi (Fase 7)

`src/lib/permissions.ts` (`derivePermissions`) deriva dal ruolo permessi puntuali, usati
sia in UI sia (con verifica indipendente) nel backend:

| Permesso | superAdmin | admin | resultManager |
|---|---|---|---|
| Inserire/correggere risultati, rinviare/annullare | âœ… | âœ… | âœ… |
| Creare/eliminare partite e giornate | âœ… | âœ… | âŒ |
| Modificare direttamente `editionTeams` (import, penalitÃ ) | âœ… | âœ… | âŒ |
| Creare bozze di notizia Home | âœ… | âœ… | âŒ |
| Operare su edizioni non attive (concluse/bozza/nascoste) | âœ… | âœ… | âŒ (rifiutato dal backend) |

### Struttura baseline della classifica

`editionTeams`: `baselinePoints`/`baselinePlayed` (situazione importata/iniziale, mai
toccata dalle partite) + `matchPoints`/`matchPlayed` (solo dalle partite "conclusa",
ricalcolati da zero ad ogni salvataggio) + `manualPointsAdjustment`/
`manualPlayedAdjustment` (correzioni manuali, sempre preservate) = `points`/`played`
(campi finali mostrati ovunque nell'app).

### Importazione classifica (3 modalitÃ , atomica)

`POST /api/standings/import` (admin/superAdmin, Firebase Admin SDK, scrittura atomica in
un unico batch â€” se anche una sola riga richiede una scelta esplicita non ancora fatta,
non viene importato nulla). Il frontend (`src/lib/standingsApi.ts`) fa scegliere
all'amministratore una modalitÃ  prima di incollare il testo:

1. **Situazione iniziale** â€” i valori diventano `baselinePoints`/`baselinePlayed`; i
   punti prodotti dalle partite giÃ  presenti si sommano sopra.
2. **Classifica attuale completa** â€” i valori rappresentano giÃ  tutti i risultati fino
   ad oggi. Due scelte: **A** azzera il contributo delle partite esistenti nella baseline
   (il totale visibile non cambia, non raddoppia in futuro); **B** conserva solo le
   partite successive a una giornata scelta (l'importato vale fino a lÃ¬ compreso).
3. **Aggiornamento parziale** â€” aggiorna solo le squadre presenti nel testo, mostra
   quelle assenti, non le tocca.

L'ordine originale delle righe viene salvato in `importedOrder` (oltre a `order`, letto
dalla classifica per i pari punti tramite `compareStandingRows`, condiviso tra classifica
a squadre e Femminile). `src/lib/teamNameMatch.ts` normalizza i nomi
(maiuscole/minuscole, spazi, trattini, apostrofi, accenti) per rilevare corrispondenze
"simili" a squadre esistenti: non le unisce mai automaticamente, mostra invece una
schermata di conferma (collega / crea comunque / ignora la riga). Righe duplicate nello
stesso file vengono bloccate prima dell'importazione.

L'import a 3 modalita/endpoint atomico riguarda sia le classifiche a squadre sia il campionato Femminile.
Per il Femminile l'endpoint aggiorna femaleParticipants in batch all-or-nothing: modalita 1 iniziale, modalita 2 sostituzione completa con policy esplicita per le assenti (keep in fondo, retire, remove), modalita 3 aggiornamento parziale. Valida duplicati, accenti/spazi/maiuscole, punti/tappe, stati importati e nomi molto simili con preview da risolvere.

### Operazioni strutturali sulle partite (Fase 9)

`POST /api/matches/create-match`, `POST /api/matches/update-match` e `POST /api/matches/delete-match` (admin/superAdmin,
Firebase Admin SDK). La creazione valida lato backend: squadre diverse, entrambe iscritte
all'edizione, nessuna delle due giÃ  impegnata nella stessa giornata, partita non
duplicata (anche con squadre invertite). Modifica/spostamento ed eliminazione ricalcolano la classifica
nella stessa transazione. Le regole Firestore negano al client qualunque scrittura
diretta su `matches` (`allow write: if false`): l'unico percorso Ã¨ questi endpoint.

### Notifiche push, preferenze e analytics interni

La pagina `Notifiche` non e piu un placeholder: salva preferenze per installationId,
richiede esplicitamente il permesso browser, registra il service worker
`public/firebase-messaging-sw.js` e usa FCM quando sono configurati
`VITE_FIREBASE_VAPID_KEY` e `FIREBASE_SERVICE_ACCOUNT`.

Il pannello Super Amministratore gestisce switch globale, modalita per evento
(`disabled`, `ask`, `automatic`, `draft`), override per edizione, bozze, invio immediato,
programmazione, history e retry/cancel via endpoint `api/notifications/*`. Gli eventi
risultato, correzione, ricalcolo classifica, vincitore campionato e PalaPadel News
passano da `enqueueNotificationEvent`, che rispetta le impostazioni correnti e mantiene
idempotenza tramite `notificationDispatches`.

Gli analytics sono interni: `api/analytics/track` registra eventi anonimi per
installationId, `api/analytics/summary` restituisce aggregati solo al Super
Amministratore nella pagina `/analytics`. Non vengono usati Google Analytics, GTM o
script esterni.

Le regole Firestore negano scritture dirette client su installazioni/token, history,
dispatch e analytics raw; le scritture operative passano dagli endpoint con Admin SDK.

### Condivisione classifica e popup squadra

Gli admin trovano `CONDIVIDI CLASSIFICA` nelle classifiche a squadre e Femminile: genera
PNG veri 1920x1080 via canvas, con paginazione automatica se le righe non entrano in una
sola immagine, preview, download e Web Share API quando supportata.

Il popup squadra mostra statistiche dell'edizione corrente calcolate da partite reali
concluse e risultati validi: PG, vittorie e sconfitte derivano da
`src/lib/teamStats.ts`, non dai contatori di classifica importati.

Nota storica: le versioni precedenti salvavano solo bozze Home e non inviavano push reali.


### Migrazione dati

`scripts/migrateStandingsBaseline.mjs` usa **Firebase Admin SDK** (non l'SDK client: non
serve allentare le regole Firestore). Idempotente tramite `dataModelVersion`/`migratedAt`
sui documenti `editionTeams`: rieseguirlo Ã¨ sicuro, salta i documenti giÃ  migrati.

```bash
npm run migrate:standings:dry     # anteprima, nessuna scrittura (default)
npm run migrate:standings:apply   # applica davvero
```

Richiede `FIREBASE_SERVICE_ACCOUNT` in ambiente (stessa chiave di servizio degli
endpoint) oppure `GOOGLE_APPLICATION_CREDENTIALS` puntata a un file locale.

### Configurazione Firebase Admin SDK (obbligatoria per salvare risultati)

Su Vercel, imposta la variabile d'ambiente `FIREBASE_SERVICE_ACCOUNT` con il JSON
completo di una chiave di servizio (Console Firebase â†’ Impostazioni progetto â†’ Account
di servizio â†’ Genera nuova chiave privata). Senza questa variabile, `save-result` e
`save-bulk` rispondono con errore 500 e **nessun risultato puÃ² essere salvato**: non Ã¨
una funzionalitÃ  opzionale, Ã¨ il solo percorso di scrittura disponibile.

### Test e lint

```bash
npm test         # Node test runner nativo (nessuna dipendenza aggiuntiva), 55 test
npm run lint     # ESLint (TypeScript + React), configurato in eslint.config.js
npm run build    # tsc -b && vite build
npm run test:emulator # Firestore/Auth/Storage rules; richiede Java nel PATH
```

### Deploy (Vercel)

Il progetto include giÃ  `vercel.json` (rewrite SPA, esclude `/api/*`) e le funzioni
serverless in `api/`. Imposta su Vercel le variabili `VITE_FIREBASE_*` (vedi
`.env.example`), `VITE_FIREBASE_VAPID_KEY` per FCM Web Push e `FIREBASE_SERVICE_ACCOUNT`,
poi collega il repository: `api/matches/*`, `api/standings/*`, `api/notifications/*`,
`api/analytics/*` e `api/admin/*` vengono deployate automaticamente come funzioni serverless.

## 1. Crea il progetto Firebase

1. Vai su https://console.firebase.google.com â†’ **Aggiungi progetto** â†’ chiamalo `palapadel` (o come preferisci).
2. Nel progetto, **Build > Authentication** â†’ Inizia â†’ abilita il provider **Email/Password**.
3. **Build > Firestore Database** â†’ Crea database â†’ modalitÃ  **produzione** â†’ scegli una region europea (es. `eur3` o `europe-west`).
4. **Impostazioni progetto (icona ingranaggio) > Generale** â†’ in fondo, sezione "Le tue app" â†’ **Aggiungi app > Web** (icona `</>`) â†’ dai un nome, NON serve Firebase Hosting (usiamo Vercel).
5. Copia i valori di configurazione mostrati (apiKey, authDomain, ecc.) â€” ti serviranno subito dopo.

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

Le regole in `firestore.rules` sono giÃ  scritte per i tre ruoli (Super Amministratore, Amministratore, Gestore risultati). Per pubblicarle:

```bash
npm install -g firebase-tools
firebase login
firebase use --add        # scegli il progetto palapadel appena creato
firebase deploy --only firestore:rules
```

## 4. Crea il primo Super Amministratore (a mano, solo la prima volta)

Il Super Amministratore normale si crea da dentro l'app con solo nome utente e password (senza email, vedi sezione 8 piÃ¹ sotto), ma il *primissimo* va creato manualmente perchÃ© nessuno Ã¨ ancora loggato:

1. Firebase Console â†’ **Authentication > Users > Aggiungi utente** â†’ inserisci un'email qualsiasi (anche una vera tua, va bene) e una password.
2. Copia lo **User UID** generato.
3. Firebase Console â†’ **Firestore Database > Dati** â†’ crea manualmente una collezione `users` â†’ documento con ID = lo UID copiato, campi:
   - `uid`: lo stesso UID
   - `username`: il nome utente che vuoi usare per accedere (es. `nico`)
   - `role`: `superadmin`
   - `createdAt`: una data ISO qualsiasi, es. `2026-01-01T00:00:00.000Z`
4. Crea anche una collezione `usernameEmails` â†’ documento con ID = il nome utente in minuscolo senza spazi (es. `nico`), campo:
   - `email`: l'email che hai usato al punto 1

Il passaggio 4 serve perchÃ© l'app permette il login con solo nome utente: internamente cerca l'email corrispondente in questa mappatura. Gli account creati dopo, dall'interfaccia, la generano da soli automaticamente.

Da qui in poi, accedendo con quel nome utente e password nell'app, avrai i permessi da Super Amministratore e potrai creare Amministratori e Gestori risultati direttamente dall'interfaccia, indicando solo nome utente e password.

## 5. Popola i dati demo (opzionale)

```bash
node scripts/seed.mjs
```

Nota: usa l'SDK client, quindi se le regole Firestore sono giÃ  quelle definitive (`isAdminOrAbove()`), lo script fallirÃ  per permessi. Per il primo seed, o allenta temporaneamente le regole (`allow write: if true;`) e ripubblicale subito dopo, oppure autentica lo script â€” per semplicitÃ , in Fase 1 la via piÃ¹ rapida Ã¨ allentare temporaneamente le regole di scrittura, lanciare il seed, ripubblicare quelle vere.

## 6. GitHub

```bash
git init
git add .
git commit -m "Fase 1: struttura, Firebase, ruoli, Home pubblica"
gh repo create palapadel --private --source=. --remote=origin
git push -u origin main
```

(`gh` Ã¨ la CLI di GitHub; se non ce l'hai, crea il repo vuoto da github.com e collega con `git remote add origin <url>`.)

## 7. Deploy su Vercel

1. Vai su https://vercel.com â†’ **Add New > Project** â†’ importa il repo GitHub appena creato.
2. Framework Preset: Vercel lo riconosce come **Vite** automaticamente.
3. Prima del deploy, aggiungi le **Environment Variables** (stessi valori di `.env.local`):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
4. Deploy. Ogni push su `main` farÃ  un nuovo deploy automatico.
5. Torna su Firebase Console â†’ **Authentication > Settings > Authorized domains** â†’ aggiungi il dominio `*.vercel.app` (o il tuo dominio custom), altrimenti il login darÃ  errore da produzione.

## 8. Abilita il cambio password (Super Amministratore) e il login con solo nome utente

Da questa versione, gli account non usano piÃ¹ email visibili: si accede con nome utente e password, e il Super Amministratore puÃ² cambiare la password di qualsiasi account. Per far funzionare il cambio password serve una piccola funzione server (giÃ  inclusa in `api/admin/set-password.js`), perchÃ© Firebase lato client permette a un utente di cambiare solo la propria password.

**Genera la chiave di servizio Firebase:**
1. Firebase Console â†’ icona ingranaggio â†’ **Impostazioni progetto**
2. Scheda **Account di servizio**
3. Clicca **Genera nuova chiave privata** â†’ conferma â†’ si scarica un file `.json`

**Aggiungilo come variabile d'ambiente su Vercel:**
1. Apri il file `.json` scaricato con un editor di testo, seleziona tutto il contenuto e copialo
2. Vercel â†’ il tuo progetto â†’ **Settings > Environment Variables**
3. Key: `FIREBASE_SERVICE_ACCOUNT`
4. Value: incolla l'intero contenuto del file JSON (tutto su una riga va bene, Vercel lo accetta come stringa)
5. Spunta Production (e Preview/Development se vuoi testare anche lÃ¬)
6. Salva, poi fai un **Redeploy** dall'ultima voce in Deployments

Da questo momento, nella sezione Gestione, il Super Amministratore vedrÃ  "Cambia password di un account esistente": seleziona l'utente, inserisce la nuova password (con l'occhio per mostrarla o nasconderla) e conferma.

**Attenzione alla sicurezza:** il file `.json` della chiave di servizio dÃ  accesso completo al progetto Firebase (bypassa tutte le regole). Non condividerlo, non caricarlo su GitHub, non incollarlo in chat: va solo nella variabile d'ambiente di Vercel.

## Cosa manca (fasi successive, come da specifica)

- **Fase 2**: creazione squadre/campionati/stagioni da interfaccia (ora solo via seed o console Firebase)
- **Fase 3**: giornate, partite, calcolo automatico dei punti, interfaccia completa Gestore risultati
- **Fase 4**: import Excel/Word, ritiro/squalifica con le 4 opzioni, storico dettagliato, Albo d'oro popolato automaticamente
- **Fase 5**: tabellone finale, notifiche push reali (richiede piano Blaze per le Cloud Functions, oppure un piccolo backend separato es. su Vercel Functions), audit log completo, rifinitura mobile, icone PWA reali (sostituire i placeholder in `public/`)

## Note tecniche importanti

- **Ruoli senza Cloud Functions**: il ruolo vive in `users/{uid}` su Firestore, non nei custom claims di Firebase Auth (che richiederebbero Cloud Functions e quindi il piano Blaze). Le regole Firestore leggono quel documento per decidere i permessi â€” funziona interamente sul piano Spark gratuito.
- **Creazione di nuovi amministratori** senza perdere la sessione del Super Amministratore: si usa una istanza Firebase secondaria "usa e getta" (vedi `getSecondaryAuth()` in `src/firebase.ts`), un pattern comune per questo esatto problema sul piano Spark.
- **Notifiche push reali** richiedono un service worker + VAPID keys + un modo per inviare (Cloud Function o backend esterno) â€” il piano Spark non supporta le Cloud Functions in uscita verso servizi esterni, quindi per la Fase 5 valuteremo un piccolo endpoint su Vercel (gratuito) che invia le notifiche invece di usare Cloud Functions.
