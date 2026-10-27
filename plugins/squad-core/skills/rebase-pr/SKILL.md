---
name: rebase-pr
description: Aggiorna la branch di una PR rispetto a main (rebase) risolvendo solo i conflitti inequivocabili. Fa push con --force-with-lease sulla sola branch della PR.
argument-hint: "<numero PR>"
disable-model-invocation: true
---

Rebase della PR `$ARGUMENTS` (obbligatorio; se manca, chiedilo).

1. `gh pr view <n> --json headRefName,baseRefName,mergeable,state`. PR non aperta: fermati. Working tree sporco: fermati.
2. `git fetch origin` e checkout della branch della PR (mai `main`). Già aggiornata e non in conflitto: dillo e fermati.
3. `git rebase origin/<base>`.
   - Conflitti **inequivocabili** (stesso campo `version` in due PR, file generati, righe adiacenti): risolvi tenendo il contenuto della base e rifacendo la tua modifica (per la versione, riesegui l'incremento previsto da `AGENTS.md`, così risulta maggiore di quella della base).
   - Qualsiasi altro conflitto: `git rebase --abort`, lascia la PR com'è e segnala il conflitto all'umano.
4. Controlli del progetto (`verify`) dopo il rebase.
5. `git push --force-with-lease origin <branch>`: **solo** la branch della PR. Mai `--force` nudo, mai `main`: gli hook di guardia chiedono conferma sul force.
6. Riporta cosa è cambiato e che la CI riparte.
