---
status: accepted
date: 2026-10-28
decision-makers: Pelucco Matteo
---

# Versione unica del framework e release da `main`

## Contesto e problema

Il framework è distribuito da due meccanismi con versioni proprie (ADR-0001): i plugin, che leggono la versione da `plugin.json`, e il template Copier, che legge i tag git. Senza una regola le due versioni divergono e `copier update` non sa cosa proporre.

## Opzioni considerate

* **Una versione sola (`VERSION`), riflessa nei manifest e nei tag `vX.Y.Z`, con release a ogni merge che la incrementa**
* Versioni separate per plugin e template
* Release manuali a scadenza

## Esito della decisione

Opzione 1.

* `VERSION` è la fonte; `tests/bump-version.sh` la scrive in `marketplace.json` e in ogni `plugin.json`, e `tests/version.sh` ne verifica l'allineamento in CI. Ogni PR la incrementa (patch di default, `minor` per funzioni nuove, `major` per cambi incompatibili con i progetti generati).
* Il workflow `release` parte a ogni push su `main` che cambia `VERSION`. Prima esegue lo stesso job `validate` delle PR, progetto campione compreso: **con il campione rosso non c'è release**. Poi crea il tag `vX.Y.Z` (quello che Copier legge) e la release GitHub.
* Le note vengono dai Conventional Commits (`scripts/release-notes.mjs`), raggruppate per tipo, con i cambiamenti incompatibili in testa e le istruzioni di aggiornamento in coda. Le release GitHub sono il changelog.
* Prima della 1.0 un cambio incompatibile con i progetti generati incrementa la `minor` e va segnalato con `!` nel commit.

### Conseguenze

* Positivo, perché plugin, template e tag dicono sempre la stessa versione, e `copier update` ha un riferimento chiaro.
* Positivo, perché nessuna release esce da un framework che non genera più un progetto valido.
* Negativo, perché ogni PR produce una release: sono piccole, ma numerose. Se diventano rumore si passa a release a richiesta (`workflow_dispatch` già previsto).
* Negativo, perché la release pubblica contenuti dal repository: serve un controllo umano in review, che resta il merge.
