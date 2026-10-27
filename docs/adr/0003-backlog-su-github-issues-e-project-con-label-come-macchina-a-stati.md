---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Backlog su GitHub Issues e Project, con le label come macchina a stati

## Contesto e problema

Girasole e communio usano issue, label e Project; sitescanner usa un file `tasks.md`. Le issue permettono triage automatico, stato visibile da telefono e trigger su eventi (Actions, attività schedulate in cloud).

## Opzioni considerate

* **GitHub Issues + Project**
* Issue come standard, file ammesso
* File nel repository

## Esito della decisione

Opzione 1. Il backlog è fatto di issue aperte da template, con le label come contratto tra agenti (`status:*`, `type:*`, `area:*`, `tier:*`, `ai-driven` / `human-in-the-loop`) e il Project come ordine di priorità. Le label si creano con uno script idempotente fornito dal template. sitescanner migra da `tasks.md` alle issue.

### Conseguenze

* Positivo, perché agenti e persone vedono lo stesso stato, anche da mobile.
* Positivo, perché eventi GitHub possono far partire triage e implementazione.
* Negativo, perché il lavoro dipende da GitHub e da `gh` autenticato con lo scope `project`.
