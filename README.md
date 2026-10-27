# my-ai-squad

Framework per progetti sviluppati con una squadra di agenti [Claude Code](https://code.claude.com/docs): in pochi minuti un nuovo progetto ha agenti, skill, guardrail deterministici, CI agentica e convenzioni già collaudati, e li riceve aggiornati quando il framework evolve.

> **Stato: in sviluppo (versione in `VERSION`).** Esiste lo scheletro del repository (marketplace, due plugin, template Copier minimo, CI di validazione) gli hook di guardia, gli agenti e le skill di flusso e il template del nucleo; pacchetto di stack arrivano con le prossime issue ([roadmap](docs/roadmap.md)).

## Stato dello sviluppo

| Componente | Stato |
| --- | --- |
| Marketplace `my-ai-squad` e plugin `squad-core`, `squad-nextjs-supabase` | scheletro vuoto |
| Template Copier del nucleo (`template/`): `AGENTS.md`/`CLAUDE.md`, impostazioni con marketplace e plugin, template di issue e PR, script di label e Project, workflow di triage e chiusura issue, CI con gate `verifica`; `copier update` verificato | fatto ([guida](docs/guides/template.md)) |
| CI di validazione (`claude plugin validate`, `copier copy`, versione) | attiva |
| Hook di guardia in `squad-core` (comandi, perimetri di scrittura, `Stop`) con test; regole `deny` su `.env*` nel template | fatto ([guida](docs/guides/guardrail.md)) |
| Agenti della squadra in `squad-core` (`triage`, `product-analyst`, `test-engineer`, `implementer`, `reviewer`, `security-reviewer`) con controllo automatico | fatto |
| Skill di flusso in `squad-core` (`work-on-issue`, `next-task`, `run-tasks`, `task-review`, `prepare-pr`, `owasp-check`, `rebase-pr`) con controllo automatico | fatto |
| Progetto campione generato (con e senza stack) e verificato a ogni PR: stessi passi del gate `verifica`, su PR di codice e di soli documenti | fatto (`tests/sample.sh`) |
| Pacchetto di stack | da fare |

La versione è in [`VERSION`](VERSION) ed è incrementata a ogni PR con `tests/bump-version.sh`.

## Provarlo in locale

```bash
python3 -m venv ~/.venvs/copier && ~/.venvs/copier/bin/pip install copier
PATH=~/.venvs/copier/bin:$PATH tests/validate.sh   # serve anche Node 20+
```

## Da dove nasce

Dal setup costruito a mano in [girasole](https://github.com/matteopelucco/girasole) (registro elettronico in produzione) e [communio](https://github.com/matteopelucco/communio), confrontato con lo stato dell'arte a ottobre 2026: [analisi](docs/research/2026-10-analisi-setup-ai.md).

## Come sarà fatto

- **Marketplace di plugin Claude Code**: skill, agenti e hook versionati e aggiornabili.
  - `squad-core`: nucleo indipendente dallo stack;
  - `squad-nextjs-supabase`: pacchetto per Next.js + Supabase + Vercel.
- **Template [Copier](https://copier.readthedocs.io/)** per ciò che un plugin non può portare: `AGENTS.md`/`CLAUDE.md`, impostazioni e permessi, workflow GitHub, template di issue e PR, label. Si aggiorna con `copier update`.
- **Metodo**:
  - specifiche con scenari Given/When/Then prima del codice, test prima dell'implementazione;
  - issue e label come contratto tra agenti;
  - modello scelto per costo;
  - merge umano, con auto-merge solo dei task `ai-driven`.
- **Guardrail**: le regole senza eccezioni sono hook e regole `deny` testati, non frasi nei prompt.
- **Verificato**: a ogni release un progetto campione viene generato e passa la pipeline completa.

Le decisioni sono negli [ADR](docs/adr/README.md).

## Licenza

[MIT](LICENSE)
