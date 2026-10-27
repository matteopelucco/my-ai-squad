---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Repository pubblico con licenza MIT

## Contesto e problema

Il framework va installato da più progetti, anche nelle Actions e nelle sessioni in cloud.

## Opzioni considerate

* **Pubblico, MIT**
* Privato

## Esito della decisione

Opzione 1. `matteopelucco/my-ai-squad` è pubblico con licenza MIT: marketplace e template si installano e si aggiornano senza credenziali git. Non contiene segreti né dati di progetti.

### Conseguenze

* Positivo, perché nessun attrito di accesso.
* Negativo, perché tutto ciò che vi si scrive è pubblico: niente riferimenti a dati reali, infrastruttura privata o segreti.
