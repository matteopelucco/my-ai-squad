# AGENTS.md — my-ai-squad

Framework di setup AI per altri progetti: marketplace di plugin Claude Code e template Copier. Le decisioni sono in `docs/adr/`, la roadmap in `docs/roadmap.md`, il perché in `docs/research/`.

## Regole

- Backlog = GitHub Issues di questo repo; una issue alla volta, branch `<tipo>/<n>-slug`, PR verso `main`. Mai commit o push su `main`.
- Codice, identificatori e commit in inglese (Conventional Commits); documenti, issue e PR in italiano (ADR-0008).
- Repo pubblico: niente segreti, niente dati reali o riferimenti a infrastruttura privata dei progetti che adottano il framework.
- Ogni componente distribuito (skill, agente, hook, file del template) ha una verifica automatica: test degli hook, `claude plugin validate`, generazione del progetto campione.
- Una decisione architetturale nuova o cambiata → ADR in `docs/adr/` (MADR) e indice aggiornato.
- Modelli indicati per alias (`haiku`, `sonnet`, `opus`), mai per versione.
- Versione del repo in `VERSION`, allineata ai manifest: ogni PR la incrementa con `tests/bump-version.sh` (patch di default; `minor`/`major` per cambi maggiori); la CI lo verifica.
- `README.md` riflette sempre lo stato dello sviluppo: ogni PR lo aggiorna.
