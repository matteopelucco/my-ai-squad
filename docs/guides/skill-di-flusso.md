# Skill di flusso

Le skill di `squad-core` si invocano con il prefisso del plugin, ad esempio `/squad-core:work-on-issue 12`.

| Skill | A cosa serve | Effetti esterni |
| --- | --- | --- |
| `work-on-issue <n>` | Una issue dal triage alla PR in bozza, con gli agenti giusti | PR, label |
| `next-task [n]` | Prende la prossima issue `status:ready` e la lavora | PR, label |
| `run-tasks [n] [--dry-run]` | Ciclo autonomo su più issue; mergia solo le `ai-driven` a CI verde | **merge** |
| `task-review <issue\|PR>` | Review a richiesta; il report resta in chat | nessuno |
| `prepare-pr [n]` | Controlli, corpo con prova e PR in bozza della branch corrente | push, PR |
| `owasp-check [base]` | Controllo di sicurezza del diff, sola lettura, esito `OK` / `DA CORREGGERE` | nessuno |
| `rebase-pr <PR>` | Rebase della branch della PR, `--force-with-lease` solo su quella | push |

`next-task`, `run-tasks`, `prepare-pr` e `rebase-pr` hanno `disable-model-invocation: true`: le avvia solo l'utente, perché producono effetti fuori dal repository locale.

## Auto-merge (ADR-0004)

`run-tasks` classifica ogni issue come `ai-driven` o `human-in-the-loop` (nel dubbio la seconda). Mergia solo le `ai-driven` con la CI obbligatoria verde; le altre restano aperte per l'umano con un commento che spiega perché. L'hook di guardia nega comunque `gh pr merge` per una PR che non chiude una issue `ai-driven`, e il ruleset di `main` impone la CI: la skill non è l'ultima difesa.

## Cosa lasciano al progetto

Priorità delle issue, comandi di verifica (`verify` in `.claude/squad.json`), versione e documenti da aggiornare: le skill rimandano ad `AGENTS.md`. I limiti di budget del piano arrivano con la issue dedicata.
