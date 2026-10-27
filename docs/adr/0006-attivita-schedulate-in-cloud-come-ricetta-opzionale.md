---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Attività schedulate in cloud come ricetta opzionale

## Contesto e problema

Le attività schedulate in cloud di Claude Code (research preview, incluse nel piano Pro) possono partire da eventi GitHub, ad esempio una issue etichettata `status:ready`, e lavorare a laptop chiuso ([analisi §3.7](../research/2026-10-analisi-setup-ai.md#37-lavoro-da-remoto-e-in-parallelo)). Girasole non aveva un modo documentato per avviare l'implementazione da remoto.

## Opzioni considerate

* **Ricetta opzionale, spenta di default**
* Flusso principale in cloud
* Nessun uso del cloud

## Esito della decisione

Opzione 1. Il framework fornisce prompt, trigger, permessi e il ruleset di `main` che il task non può aggirare, ma il flusso principale resta locale (`/run-tasks`). La ricetta si attiva per progetto.

### Conseguenze

* Positivo, perché abilita il flusso dal telefono senza vincolare chi non lo usa.
* Negativo, perché la funzione è in anteprima: comportamento e limiti possono cambiare, e la ricetta va riverificata a ogni release del framework.
