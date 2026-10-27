# Template del progetto

Genera un progetto con `copier copy gh:matteopelucco/my-ai-squad nome-progetto` (in locale: `copier copy ./template nome-progetto`) e aggiornalo con `copier update`, che propone le novità come diff da rivedere in una PR.

## Domande

| Domanda | Effetto |
| --- | --- |
| `project_name`, `project_description` | intestazione di `AGENTS.md` |
| `docs_language` | lingua di documenti, issue e PR (codice e commit restano in inglese, ADR-0008) |
| `visibility` | regole su segreti e dati nelle istruzioni |
| `verify_fast`, `verify_full` | `verify` di `.claude/squad.json` (hook `Stop`) e sezione Controlli di `AGENTS.md` |
| `stack` | abilita anche il pacchetto di stack in `enabledPlugins` |
| `merge_mode` | `human`: nessun merge degli agenti; `ai-driven`: ADR-0004 |

## Cosa genera

- `AGENTS.md` breve e `CLAUDE.md` con `@AGENTS.md` (ADR-0007).
- `.claude/settings.json`: marketplace `my-ai-squad`, plugin abilitati e regole `deny` sui file `.env*`; `.claude/squad.json`: verifica, modalità di merge, perimetri di scrittura degli agenti.
- Template di issue (`feature`, `bug`, `chore`) e di PR (con prova e «non verificato»).
- `scripts/setup-labels.sh` (idempotente) e `scripts/setup-project.sh`: da eseguire una volta con `gh` autenticato.
- Workflow `squad-triage` e `squad-close-issue`, e `ci.yml` con il job `verifica`: lo richiede il ruleset di `main`; esegue `verifyFull` (o `verify`) di `.claude/squad.json` e salta i controlli se la PR tocca solo documenti (`scripts/classify-changes.sh`).

## Workflow agentici (ADR-0011, ADR-0012)

Il triage parte solo su issue di `OWNER`, `MEMBER` o `COLLABORATOR`, con tool elencati, `--max-turns`, `timeout-minutes`, permessi minimi e nessun testo dell'utente interpolato nei comandi. Imposta **uno** dei segreti `CLAUDE_CODE_OAUTH_TOKEN` o `ANTHROPIC_API_KEY`: la scelta è ancora aperta ([#12](https://github.com/matteopelucco/my-ai-squad/issues/12)).

## Progetto campione

`tests/sample.sh` (parte di `tests/validate.sh`, quindi della CI del framework) genera un progetto con e senza pacchetto di stack, esegue i passi del gate `verifica` e controlla la classificazione su una PR di codice, una di soli documenti e una mista.
