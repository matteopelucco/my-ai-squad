---
name: owasp-check
description: Controllo di sicurezza OWASP del diff della branch corrente contro la base, in sola lettura, con esito OK o DA CORREGGERE. Da eseguire prima di aprire una PR.
argument-hint: "[base]  (default main)"
---

Controllo di sicurezza sul diff. `$ARGUMENTS`: branch base (default `main`). **Sola lettura**: nessun commit, nessuna modifica. Non stampare mai valori di segreti trovati: cita file e riga. Un problema preesistente fuori dal diff è una nota, non pesa sull'esito.

## 1. Raccogli il diff
`git fetch origin <base> --quiet` (se fallisce, base locale, e dillo), poi `git diff origin/<base>...HEAD`, più modifiche non committate (`git diff HEAD`) e file nuovi non tracciati (`git ls-files --others --exclude-standard`, da leggere per intero). Diff vuoto: "nessuna modifica da controllare", esito `OK`. Leggi `AGENTS.md` (convenzioni, regole di sicurezza del progetto).

## 2. Checklist: una riga per categoria (`ok`, `n/a` con motivo, o rilievo con `file:riga`)
1. **A01 Controllo degli accessi**: ogni operazione nuova verifica chi la chiede lato server, senza fidarsi di id o ruoli dal client; nessun dato altrui nelle risposte.
2. **A03 Iniezione**: input non fidato mai concatenato in query, comandi, HTML, percorsi di file.
3. **A07 Autenticazione e sessioni**: flussi di login, token, cookie e route pubbliche non indeboliti.
4. **A02/A05 Segreti**: nessuna chiave, token o credenziale nel codice, nei commenti, nei test, nei workflow, nelle fixture; nessun dato reale di persone.
5. **A05 Configurazione ed errori**: errori generici verso il client, default sicuri, header/CORS/workflow (`permissions`, segreti passati a step non fidati) non allentati.
6. **A06 Dipendenze**: aggiunte o aggiornamenti autorizzati, script di installazione, audit del gestore di pacchetti se disponibile.
7. **A09 Log**: niente dati personali o segreti nei log.
8. **Automazioni**: workflow e script con permessi minimi e nessun comando costruito da testo non fidato (titoli di issue, commenti).
Se `AGENTS.md` o un pacchetto di stack aggiunge regole proprie (database, hosting), applicale in più.

## 3. Esito
Un'ultima riga: **`OK`** (nessun rilievo) o **`DA CORREGGERE`** (almeno un rilievo), poi i rilievi nel formato `- [ALTO|MEDIO|BASSO] file:riga — problema → correzione minima`, e cosa non hai potuto verificare. Se il diff tocca autenticazione, permessi o dati personali, segnala che serve anche il `security-reviewer`.
