---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Adozione dal progetto campione, poi sitescanner, communio e girasole

## Contesto e problema

Tre progetti esistenti con livelli di rischio diversi: girasole è in produzione, communio quasi senza codice, sitescanner in sviluppo.

## Opzioni considerate

* **Prima un progetto campione**
* Prima girasole
* Solo progetti nuovi

## Esito della decisione

Opzione 1, in quest'ordine:
1. versione 0.1 del framework con un progetto campione generato e verificato in CI;
2. sitescanner (solo nucleo);
3. communio;
4. girasole, per ultimo.

Ogni migrazione è una PR rivedibile nel progetto.

### Conseguenze

* Positivo, perché il rischio cresce gradualmente e girasole riceve un framework già collaudato.
* Negativo, perché i miglioramenti arrivano a girasole per ultimi.
