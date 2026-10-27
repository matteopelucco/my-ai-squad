---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# AGENTS.md come base e CLAUDE.md che lo importa

## Contesto e problema

AGENTS.md è lo standard aperto letto dagli agenti di coding più diffusi, e da Claude Code quando manca `CLAUDE.md` ([analisi §3.10](../research/2026-10-analisi-setup-ai.md#310-istruzioni-per-altri-agenti)).

## Opzioni considerate

* **AGENTS.md come base**
* Solo Claude Code

## Esito della decisione

Opzione 1. Le regole comuni stanno in `AGENTS.md`; `CLAUDE.md` inizia con `@AGENTS.md` e aggiunge solo ciò che è specifico di Claude Code (skill, agenti, hook). Entrambi brevi: solo ciò che non si ricava dal codice.

### Conseguenze

* Positivo, perché lascia aperta la porta ad altri strumenti a costo quasi nullo.
* Negativo, perché le istruzioni stanno in due file da tenere coerenti.
