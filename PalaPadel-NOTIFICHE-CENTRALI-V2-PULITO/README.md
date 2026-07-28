# PalaPadel - Web app tornei e campionati

Web app per gestire campionati PalaPadel, squadre, giornate, risultati, classifiche, albo d'oro, news Home, notifiche push e analytics interni.

Stack: Vite, React 19, TypeScript, Tailwind, Firebase Auth, Firestore, Firebase Storage e funzioni serverless Vercel con Firebase Admin SDK.

## Stato attuale

Il progetto include già:

- Home pubblica con sezione PALA PADEL NEWS, campionati attivi e albo d'oro.
- Area Super Admin con gestione utenti, ruoli, notifiche, analytics e layout desktop dedicato.
- Gestione campionati, edizioni, squadre, giornate, partite e classifiche.
- Salvataggio risultati tramite backend con ricalcolo classifica e audit log.
- Import classifiche a squadre e Femminile con modalità atomiche e controlli sui nomi simili.
- Tabellone finale, storico e albo d'oro.
- Notifiche push reali via FCM quando VAPID key e service account sono configurati.
- Analytics interni anonimi, senza Google Analytics o script esterni.
- Condivisione classifica in PNG 1920x1080.
- Foto squadre caricate su Firebase Storage.
- Immagini facoltative per PalaPadel News caricate da dispositivo, con preview, sostituzione, eliminazione e testo alternativo.

## Flusso risultati

Il frontend non scrive mai direttamente su `matches` o `editionTeams` per inserire, correggere o cambiare lo stato di una partita. Ogni azione passa da `src/lib/matchApi.ts`, che chiama gli endpoint backend:

- `POST /api/matches/save-result`: un singolo risultato o cambio di stato.
- `POST /api/matches/save-bulk`: tutti i risultati/stati di una giornata in un colpo solo.
- `POST /api/matches/create-match`: creazione partita.
- `POST /api/matches/update-match`: modifica squadre/giornata di una partita.
- `POST /api/matches/delete-match`: eliminazione partita.

Gli endpoint partita usano Firebase Admin SDK e una transazione Firestore: leggono partita ed edizione, validano ruolo/stato/risultato, aggiornano la partita, ricalcolano da zero la classifica dell'edizione, aggiornano `editionTeams` e scrivono l'audit log.

Le regole Firestore negano al client qualunque scrittura diretta su `matches` ed `editionTeams`; l'unico percorso di scrittura è il backend.

## Ruoli e permessi

I ruoli vivono in `users/{uid}` su Firestore, non nei custom claims. `src/lib/permissions.ts` deriva i permessi lato UI, mentre backend e rules ricontrollano in modo indipendente.

| Permesso | superAdmin | admin | resultManager |
|---|---:|---:|---:|
| Inserire/correggere risultati, rinviare/annullare | sì | sì | sì |
| Creare/eliminare partite e giornate | sì | sì | no |
| Gestire campionati, squadre e albo d'oro | sì | sì | no |
| Gestire PalaPadel News | sì | sì | no |
| Caricare immagini news/squadre | sì | sì | no |
| Gestire notifiche, analytics, utenti e password | sì | no | no |

Gli account con `disabled: true` non ereditano più i permessi di ruolo nelle regole Firestore e Storage.

## Classifiche e import

`editionTeams` usa il modello:

`baselinePoints/baselinePlayed` + `matchPoints/matchPlayed` + `manualPointsAdjustment/manualPlayedAdjustment` = `points/played`

I valori `baseline*` rappresentano la situazione iniziale o importata e non vengono toccati dal ricalcolo partite. I valori `match*` derivano solo dalle partite concluse. Le correzioni manuali restano sempre preservate.

`POST /api/standings/import` gestisce import atomici per classifiche a squadre e Femminile. Se una riga richiede una scelta esplicita non ancora risolta, non viene importato nulla.

Modalità import:

1. Situazione iniziale: i valori diventano baseline.
2. Classifica attuale completa: i valori rappresentano già tutti i risultati fino ad oggi, con opzioni per evitare doppi conteggi.
3. Aggiornamento parziale: aggiorna solo le righe presenti nel testo.

Il matching nomi normalizza maiuscole/minuscole, spazi, trattini, apostrofi e accenti. Le corrispondenze simili vengono mostrate all'amministratore e non unite automaticamente.

## News e immagini

Le PalaPadel News sono salvate in `homeNews/{id}`. Campi principali:

- `title`
- `body`
- `date`
- `category`
- `status`
- `imageUrl`
- `imageStoragePath`
- `imageAlt`

L'immagine è facoltativa. Il Super Admin/Admin la carica da computer, smartphone o tablet tramite file picker o drag and drop. Il form mostra preview immediata, nome file, dimensione, stato caricamento, errori chiari, sostituzione, eliminazione e anteprima editoriale desktop/mobile.

I file vengono salvati in Firebase Storage:

```text
home-news/{newsId}/cover/{filename}
```

Prima dell'upload l'immagine viene validata, compressa/ridimensionata e mantenuta proporzionata. Formati accettati: JPG, JPEG, PNG, WebP. Limite iniziale: 5 MB prima della compressione.

Se il salvataggio Firestore fallisce dopo l'upload, il nuovo file inutilizzato viene eliminato. Quando una foto viene sostituita, la vecchia immagine viene eliminata solo dopo il salvataggio riuscito della news.

## Foto squadre

Le foto squadra sono opzionali e vengono caricate in Firebase Storage:

```text
teams/{teamId}/team-photo/{filename}
```

Nel documento `teams/{id}` vengono salvati:

- `teamPhotoUrl`
- `teamPhotoStoragePath`

Il modulo Super Admin/Admin mostra la foto già salvata, preview prima del salvataggio, sostituzione ed eliminazione con conferma. Anche qui il flusso mantiene Firestore e Storage coerenti in caso di errore.

## Firebase Storage

Le regole in `storage.rules` permettono:

- lettura pubblica delle foto squadra;
- lettura pubblica delle immagini delle news pubblicate;
- lettura immagini news in bozza solo ad admin/superAdmin;
- scrittura immagini solo ad admin/superAdmin abilitati;
- blocco per resultManager, anonimi e account disabled.

Pubblica le regole con:

```bash
firebase deploy --only storage
```

## Notifiche e analytics

La pagina `Notifiche` gestisce:

- preferenze globali;
- modalità per evento (`disabled`, `ask`, `automatic`, `draft`);
- override per edizione;
- bozze, invio immediato, programmazione, history, retry e cancel.

Gli eventi risultato, correzione, ricalcolo classifica, vincitore campionato e news passano da `enqueueNotificationEvent`, che mantiene idempotenza tramite `notificationDispatches`.

Gli analytics sono interni: `api/analytics/track` registra eventi anonimi per `installationId`, mentre `api/analytics/summary` restituisce aggregati solo al Super Admin.

## Configurazione locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apri `.env.local` e inserisci i valori Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY` per le notifiche push web

Senza chiavi Firebase valide l'app non monta correttamente in locale.

## Primo Super Amministratore

Il primissimo Super Admin va creato manualmente:

1. Firebase Console > Authentication > Users > Aggiungi utente.
2. Copia lo User UID generato.
3. Firestore > crea `users/{uid}` con:
   - `uid`
   - `username`
   - `role: "superadmin"`
   - `createdAt`
4. Crea `usernameEmails/{username-normalizzato}` con:
   - `email`

Da quel momento puoi accedere con nome utente e password e creare gli altri account dall'interfaccia.

## Firebase Admin SDK

Gli endpoint Vercel richiedono `FIREBASE_SERVICE_ACCOUNT`.

Su Firebase Console:

1. Impostazioni progetto > Account di servizio.
2. Genera nuova chiave privata.
3. Copia il JSON nella variabile d'ambiente `FIREBASE_SERVICE_ACCOUNT` su Vercel.

La chiave di servizio bypassa le regole Firebase: non va caricata su GitHub, non va condivisa e non va incollata in chat.

## Deploy Vercel

Il progetto include `vercel.json` e funzioni serverless in `api/`.

Per restare compatibile con il piano Hobby di Vercel, `api/` contiene solo router dinamici per area:

- `api/matches/[action].js`
- `api/standings/[action].js`
- `api/notifications/[action].js`
- `api/analytics/[action].js`
- `api/home-news/[action].js`
- `api/admin/[action].js`

La logica degli endpoint vive in `server/`. Le URL pubbliche non cambiano: per esempio `/api/matches/save-result` continua a funzionare, ma Vercel conta una sola Serverless Function per tutto il gruppo `matches`.

Su Vercel configura:

- tutte le variabili `VITE_FIREBASE_*`;
- `VITE_FIREBASE_VAPID_KEY`;
- `FIREBASE_SERVICE_ACCOUNT`.

Poi collega il repository. Gli endpoint sotto `api/matches/*`, `api/standings/*`, `api/notifications/*`, `api/analytics/*`, `api/home-news/*` e `api/admin/*` vengono deployati come funzioni serverless.

In Firebase Authentication aggiungi il dominio Vercel tra gli Authorized domains.

## Migrazioni

```bash
npm run migrate:standings:dry
npm run migrate:standings:apply
npm run migrate:teamphoto:dry
npm run migrate:teamphoto:apply
```

Le migrazioni usano Firebase Admin SDK. Richiedono `FIREBASE_SERVICE_ACCOUNT` oppure `GOOGLE_APPLICATION_CREDENTIALS`.

## Test e qualità

```bash
npm test              # unit test, attualmente 60
npm run lint          # ESLint
npm run build         # TypeScript + Vite production build
npm run test:emulator # Firestore/Auth/Storage rules, richiede Java nel PATH
```

Nota: `npm run test:emulator` usa Firebase Emulator Suite e fallisce se Java non è installato o non è nel PATH.

## Note tecniche

- Il progetto resta compatibile con il piano Firebase Spark usando Vercel Functions per il backend.
- Le regole Firestore e Storage leggono `users/{uid}` per ruolo e flag `disabled`.
- Il Super Admin crea utenti con una seconda istanza Firebase Auth, così non perde la propria sessione.
- Il client pubblico non legge token notifiche, history invii o analytics raw.
- Le immagini non vengono salvate dentro Firestore: Firestore contiene solo URL, Storage path e testo alternativo.
