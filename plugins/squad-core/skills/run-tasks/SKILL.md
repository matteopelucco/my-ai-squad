---
name: run-tasks
description: Ciclo autonomo su n task della board - analizza, implementa, verifica la CI e mergia da solo solo i task ai-driven. Gli human-in-the-loop restano aperti per l'umano.
argument-hint: "[n] [--dry-run]"
disable-model-invocation: true
---

Orchestratore del ciclo autonomo (ADR-0004). Come `/squad-core:next-task` coordini leggendo le label, ma ripeti il ciclo su più task, **uno alla volta**. Gli agenti fanno il lavoro pesante: tu leggi solo esiti brevi.

Argomenti `$ARGUMENTS`: un intero = `n`, tetto di task (assente: 3); `--dry-run` = solo pre-flight e selezione, stampa il piano e fermati senza toccare label, branch o PR.

## Fase 0 — Pre-flight (se un punto fallisce, fermati e dillo)
1. Working tree pulito, branch `main`, `git pull --ff-only`.
2. `gh auth status` ok.
3. Esistono le label `ai-driven` e `human-in-the-loop` (altrimenti creale con `gh label create`).
4. PR `human-in-the-loop` aperte in attesa: se sono 3 o più, fermati.
5. Se `AGENTS.md` indica un limite di budget del piano, rispettalo: dopo ogni task rileggi i consumi e fermati se la soglia è raggiunta. Senza strumenti per leggerli, usa `n` e dillo.

## Fase 1 — Selezione
`gh issue list --label status:ready --state open`. Scarta: `status:needs-info`, `blocked`, `in-progress`, `review`; issue con PR aperta collegata; "Dipende da #X" ancora aperte; madri con sub-issue aperte. Ordine: la priorità indicata in `AGENTS.md` (o la board del progetto), altrimenti `type:bug` prima e poi numero crescente; un bug può scavalcare solo i vicini, non l'intera lista. Issue senza `status:ready`: prima `squad-core:triage`; se esce `needs-info`, salta alla successiva. Prendi i primi `n`. Con `--dry-run` stampa tabella (n°, titolo, bug sì/no, classificazione prevista) e fermati.

## Fase 2 — Ciclo per ogni task (strettamente sequenziale)

### 2.1 Classifica: una sola label tra `ai-driven` e `human-in-the-loop`
**`human-in-the-loop`** se vale almeno uno di questi:
- modifiche massive (indicativamente più di 15 file o 600 righe, o più aree insieme) o refactor architetturali;
- aggiornamenti **major** di dipendenze;
- dati di produzione: migrazioni, cambio di significato di dati esistenti, backfill;
- sicurezza, autenticazione, ruoli, permessi;
- workflow CI, ruleset, segreti, hook, `AGENTS.md`/`CLAUDE.md`;
- requisito ambiguo o decisione di prodotto da prendere.

**`ai-driven`** se è semplice e contenuto: modifiche visive, navigazione, testi, bug localizzati, test, documenti, chore piccole senza impatto sui dati.

**Nel dubbio `human-in-the-loop`**, con un commento che inizia per `**Dubbio di classificazione:**` e dice quale dubbio. La classificazione può passare da `ai-driven` a `human-in-the-loop` dopo l'implementazione, mai il contrario. I commenti si scrivono in un file e si pubblicano con `--body-file`.

### 2.2 Scomposizione
Se un ciclo non basta (più di ~15 file, più feature indipendenti, checklist di oltre ~6 punti non omogenei) crea sotto-issue piccole (obiettivo, criteri, label e classificazione) collegate alla madre come sub-issue, e lavora la prima: conta come un task.

### 2.3 Implementazione
Esegui `/squad-core:work-on-issue <n>` (specifica e test se il triage li chiede, implementazione, controlli, OWASP, PR in bozza con `Closes #<n>`). Specifica ambigua: `status:needs-info` e passa al successivo (non conta come fallito).

### 2.4 Sicurezza e riclassificazione
Guarda `gh pr diff <pr> --name-only`. Se tocca sicurezza, autenticazione, ruoli, migrazioni o la issue ha `type:security`: lancia `squad-core:security-reviewer`; `BLOCCO` → una sola tornata di correzione, poi nuova review; se resta, fermati su questo task come `human-in-the-loop`. Una PR che arriva qui **diventa sempre** `human-in-the-loop`. Riclassifica anche se il diff reale ha sforato i criteri di 2.1 (workflow, dipendenze major, dimensione).

### 2.5 Rebase e CI
Branch indietro o `CONFLICTING`: `/squad-core:rebase-pr <pr>`. Attendi la CI con un solo comando in background: `gh pr checks <pr> --watch --fail-fast`; niente cicli di `sleep`. Se è rossa leggi solo la parte utile (`gh run view <id> --log-failed`):
- **infrastruttura** o flaky noto: `gh run rerun <id> --failed` **una** volta; se resta rossa per lo stesso motivo lascia la PR aperta, **non mergiare**, segnala "CI bloccata da infrastruttura";
- **regressione vera**: rilancia `squad-core:implementer` con l'errore, push sulla stessa branch. **Massimo 2 giri**; poi fermati, PR in bozza con un commento sul fallimento, e segnala.

### 2.6 Esito
- **`ai-driven` e CI obbligatoria verde**: `gh pr ready <pr>`, poi `gh pr merge <pr> --squash --delete-branch`; poi `git checkout main && git pull --ff-only`. Verifica che la issue si sia chiusa. Il merge è consentito agli agenti **solo** per PR che chiudono una issue `ai-driven` (gli hook di guardia lo impongono e negano altrimenti).
- **`human-in-the-loop`**, anche con CI verde: **non mergiare**. PR aperta, issue `status:review`, commento con cosa è stato fatto, la regola di 2.1/2.4 che è scattata, cosa deve decidere l'umano, cosa è già verificato. Poi passa al task successivo.

### 2.7 Dopo ogni task
Fermati e riporta se: raggiunto `n` o finiti i task idonei; soglia di budget raggiunta; **2 task consecutivi** sono finiti in errore (problema sistemico); ci sono 3 o più PR `human-in-the-loop` in attesa.

## Fase 3 — Report finale
Tabella: n° issue · classificazione · esito (`mergiata` / `PR aperta: serve te` / `needs-info` / `fallita` / `saltata`) · link PR. Sotto, un paragrafo in prosa (4-8 righe) su cosa è cambiato, cosa è andato in porto da solo e cosa no, e cosa resta. Poi la lista esplicita di **cosa deve fare l'umano**: PR da rivedere, dubbi di classificazione commentati, domande su `needs-info`. Ogni issue o PR nominata ha il link ipertestuale al suo URL. Se ci sono PR `human-in-the-loop` o fallimenti e hai `PushNotification`, mandane una breve.

## Regole dure (valgono sopra ogni altra)
- Un task alla volta; mai agenti in parallelo.
- Mai merge di `human-in-the-loop`, mai merge con CI non verde, mai `--admin`, mai bypass del ruleset di `main`.
- Mai produzione: nessun comando remoto su database o deploy; nessun segreto nel codice o nei commenti.
- Nel dubbio su cosa è sicuro: `human-in-the-loop`, e dillo.
