---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Squadra di agenti standard: fusione di girasole e communio

## Contesto e problema

I due progetti hanno squadre diverse: girasole (`triage`, `implementer`, `reviewer`, `rls-guardian`) è snella e orientata alla board; communio (`product-analyst`, `architect-engineer`, `test-engineer`, `security-reviewer`) separa più rigorosamente specifiche, test e codice.

## Opzioni considerate

* **Fusione delle due**
* Squadra di girasole
* Squadra di communio

## Esito della decisione

Opzione 1. Nel nucleo:

* `triage` (Haiku): classifica le issue e decide `ready` o `needs-info`;
* `product-analyst`: scrive e raffina le specifiche con criteri Given/When/Then;
* `test-engineer`: scrive i test di accettazione e prova il RED;
* `implementer` (Sonnet): implementazione minima e PR in bozza;
* `reviewer`: review indipendente in sola lettura;
* `security-reviewer` (Opus): review di sicurezza generica, OWASP.

Il pacchetto Next.js/Supabase aggiunge le regole RLS/GRANT al `security-reviewer`. I perimetri di scrittura di `product-analyst`, `test-engineer` e dei revisori sono imposti da hook, come in communio. Modelli indicati per alias, non per versione.

### Conseguenze

* Positivo, perché unisce la praticità della board alla separazione dei ruoli.
* Negativo, perché più agenti per issue significa più token: le issue piccole possono saltare analista e test-engineer, deciso dal triage.
