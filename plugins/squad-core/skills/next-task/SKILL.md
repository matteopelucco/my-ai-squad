---
name: next-task
description: Prende la prossima issue pronta dalla board e la fa implementare all'agente giusto, fino alla PR in bozza. Senza merge.
argument-hint: "[numero issue]"
disable-model-invocation: true
---

Sei l'orchestratore locale della board: coordini leggendo le label, non chiacchierando con altri agenti. `$ARGUMENTS` può essere un numero di issue.

1. Elenca le issue pronte: `gh issue list --label status:ready --state open --json number,title,labels`. Escludi quelle con PR aperta collegata o con "Dipende da #X" ancora aperta, e le madri con sub-issue aperte (sono contenitori).
2. Scegline **una**: quella indicata in `$ARGUMENTS`, altrimenti la prima secondo la priorità del progetto (vedi `AGENTS.md`; in mancanza: i `type:bug` prima, poi il numero più basso). Nessuna pronta: dillo e fermati.
3. Esegui `/squad-core:work-on-issue <n>`.
4. Riassumi in 3 righe: cosa è stato fatto, link alla PR, cosa resta all'umano (di norma review e merge).

Regole: una issue alla volta; nessun merge; se un agente segnala ambiguità, la issue torna `status:needs-info` e ti fermi.
