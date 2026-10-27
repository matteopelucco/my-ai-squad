---
status: proposed
date: 2026-10-27
decision-makers: <!-- TODO: da decidere (Pelucco Matteo) -->
---

# Autenticazione degli agenti in CI: abbonamento o chiave API

## Contesto e problema

I workflow agentici possono autenticarsi con l'abbonamento (`CLAUDE_CODE_OAUTH_TOKEN`) o con una chiave API (`ANTHROPIC_API_KEY`) ([analisi §3.5](../research/2026-10-analisi-setup-ai.md#35-token-e-piano-pro)). La decisione è rinviata dall'utente il 2026-10-27 e tracciata come task.

## Opzioni considerate

* Abbonamento Pro: nessuna spesa separata, ma consuma gli stessi limiti di 5 ore e settimanali delle sessioni locali; token legato all'account personale
* Chiave API: costo a consumo con tetto nella Console, nessun impatto sui limiti del piano
* Entrambe, scelta per progetto

## Esito della decisione

Da decidere. Fino ad allora il template supporta entrambi i segreti e il workflow usa quello presente.

### Conseguenze

* Da valutare: costo mensile reale del triage e della review sui progetti esistenti, impatto sulle finestre del piano Pro durante il lavoro interattivo.
