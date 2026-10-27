---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Nucleo indipendente dallo stack e pacchetto Next.js/Supabase/Vercel

## Contesto e problema

Il bootstrap di girasole vale solo per Next.js + Supabase + Vercel; sitescanner è un progetto Node senza framework ([analisi §3.9](../research/2026-10-analisi-setup-ai.md#39-accoppiamento-allo-stack)). Metodo, agenti e guardrail sono in gran parte indipendenti dallo stack; CI, controlli RLS ed e2e no.

## Opzioni considerate

* **Nucleo + pacchetto Next.js/Supabase/Vercel**
* Nucleo + pacchetti Next.js/Supabase e Node/CLI
* Solo nucleo

## Esito della decisione

Opzione 1. Il framework ha un **nucleo** indipendente dallo stack (ciclo di sviluppo, agenti, guardrail, CI agentica, convenzioni) e un **pacchetto** per lo stack di girasole e communio (CI con analisi statica, e2e e gate, hook pre-push, controlli RLS/GRANT, Dependabot, release). Altri pacchetti si aggiungono quando un progetto li richiede. sitescanner adotta il solo nucleo.

### Conseguenze

* Positivo, perché il nucleo vale per qualsiasi progetto.
* Positivo, perché il pacchetto riusa il lavoro collaudato in girasole.
* Negativo, perché un progetto Node senza framework parte con una CI da scrivere a mano finché non esiste un pacchetto dedicato.
