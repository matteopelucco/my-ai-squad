# my-ai-squad

Framework per progetti sviluppati con una squadra di agenti [Claude Code](https://code.claude.com/docs): in pochi minuti un nuovo progetto ha agenti, skill, guardrail deterministici, CI agentica e convenzioni già collaudati, e li riceve aggiornati quando il framework evolve.

> **Stato: fondazione.** Questo repository contiene per ora l'analisi, le decisioni e la roadmap. Plugin e template arrivano con la versione 0.1 ([roadmap](docs/roadmap.md)).

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
