---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Auto-merge solo dei task ai-driven

## Contesto e problema

Girasole permette agli agenti di mergiare i task semplici (`ai-driven`) a CI verde; communio vieta ogni merge da agenti. Serve una regola unica.

## Opzioni considerate

* **Auto-merge solo `ai-driven`**
* Mai merge da agenti
* Scelta per progetto con default «mai»

## Esito della decisione

Opzione 1, come `/run-tasks` di girasole. Un agente mergia solo se la issue è `ai-driven`, la CI obbligatoria è verde e il ruleset di `main` è rispettato (mai `--admin`). Restano all'umano, come `human-in-the-loop`: dati di produzione e migrazioni, sicurezza, autenticazione e ruoli, workflow CI, dipendenze major, modifiche ampie, decisioni di prodotto; nel dubbio vale `human-in-the-loop`. Gli hook di guardia negano `gh pr merge` fuori da questo flusso.

### Conseguenze

* Positivo, perché il lavoro piccolo arriva in produzione senza attese.
* Negativo, perché la classificazione è un giudizio del modello: va verificata nei report e corretta quando sbaglia.
