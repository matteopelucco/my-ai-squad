---
name: work-on-issue
description: Porta una issue dal triage alla PR in bozza con il flusso della squadra (specifica, test, implementazione, controlli). Usala quando l'utente chiede di lavorare su una issue precisa.
argument-hint: "<numero issue>"
---

Sei l'orchestratore del lavoro su **una** issue: `$ARGUMENTS` (numero, con o senza `#`; se manca, chiedilo e fermati). Coordini gli agenti `squad-core:*` leggendo lo stato dalle label; tieni piccolo il tuo contesto, leggendo solo esiti brevi.

## 1. Preparazione
1. `gh issue view <n> --comments` e `AGENTS.md`/`CLAUDE.md`. Working tree pulito, `main` aggiornato (`git pull --ff-only`); altrimenti fermati.
2. Senza label `status:*`, lancia prima l'agente `squad-core:triage`. Se l'esito è `status:needs-info`, riporta le domande e fermati.
3. Una issue `status:ready` sulla quale **non** è già in corso altro lavoro (PR aperta collegata): altrimenti dillo e fermati.

## 2. Percorso
Il triage indica se la issue è piccola o no.
- **Piccola**: vai al punto 4.
- **Con specifica**: `squad-core:product-analyst` (specifica Given/When/Then) → `squad-core:test-engineer` (test in RED, con comando ed esito) → 4.

## 3. Sicurezza
Se la issue tocca autenticazione, permessi, dati personali, segreti o configurazione di CI, la PR dovrà passare dal `squad-core:security-reviewer` (punto 5) e **non** è mergiabile da agenti.

## 4. Implementazione
Lancia `squad-core:implementer` con il numero della issue. Lui: branch `<tipo>/<n>-slug`, codice minimo, controlli (`verify`), `/squad-core:owasp-check`, PR in bozza con `Closes #<n>` e prova dei controlli, issue in `status:review`.

## 5. Review
- `squad-core:reviewer` sul diff della PR (contesto pulito, sola lettura).
- Se serve sicurezza, **proponilo all'utente** (costa) e lancia `squad-core:security-reviewer` solo dopo un sì.
- Rilievi bloccanti: una tornata di correzione con l'implementer, poi nuova review. Se restano, fermati e riporta.

## 6. Esito
Riassumi in 4 righe: cosa è stato fatto, link alla PR, esito dei controlli, cosa deve decidere l'umano. Non fai merge: il merge segue `/squad-core:run-tasks` per i task `ai-driven`, altrimenti è dell'umano.

## Regole
Una issue alla volta. Niente `--admin`, `--no-verify`, force push. Segreti mai nei commenti. Commenti con `--body-file`.
