---
name: prepare-pr
description: Prepara la PR della branch corrente - controlli, versione, documenti, corpo con prova - e la apre in bozza. Non fa merge.
argument-hint: "[numero issue]"
disable-model-invocation: true
---

Prepara la PR della branch corrente. `$ARGUMENTS`: numero della issue (altrimenti ricavalo dal nome del branch `<tipo>/<n>-slug`).

1. **Branch**: mai `main`. `git status` pulito o committa solo ciò che appartiene alla issue.
2. **Controlli**: esegui il comando `verify` di `.claude/squad.json` (o quelli di `AGENTS.md`) e tieni comando ed esito. Se falliscono, correggi o fermati: non si apre una PR rossa.
3. **Convenzioni del progetto** (`AGENTS.md`): versione, changelog, documenti, test aggiornati se richiesti.
4. **Sicurezza**: esegui `/squad-core:owasp-check`; con esito `DA CORREGGERE` non aprire la PR.
5. **Commit**: Conventional Commits in inglese, `Refs #<n>`. Mai `--no-verify`.
6. **Push** della branch (mai su `main`, mai `--force`) e `gh pr create --draft` con il corpo scritto in un file e passato con `--body-file`:
   - cosa cambia e perché (italiano semplice);
   - checklist della issue spuntata;
   - **Prova**: comando ed esito dei controlli;
   - **Non verificato**: ciò che non hai potuto provare;
   - `Closes #<n>`.
7. Riporta l'URL della PR.
