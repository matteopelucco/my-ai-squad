---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Agenti in CI solo su eventi di collaboratori e con permessi minimi

## Contesto e problema

Gli agenti in GitHub Actions su repository pubblici sono esposti a prompt injection tramite issue e commenti ([analisi §3.4](../research/2026-10-analisi-setup-ai.md#34-agenti-in-ci-su-repository-pubblici)).

## Opzioni considerate

* **Filtro sugli autori + permessi minimi**
* Agente in sola lettura + scritture in un job separato (safe outputs)
* Nessun agente su eventi esterni

## Esito della decisione

Opzione 1. I workflow agentici partono solo su eventi di autori `OWNER`, `MEMBER` o `COLLABORATOR` (`author_association`), con tool elencati (`--allowedTools`), `--max-turns` e `timeout-minutes`, permessi del job minimi, nessun segreto oltre quello del modello, nessun valore controllato dall'utente interpolato nei `run:`, nessun evento da fork. Lo schema safe outputs resta un'evoluzione da rivalutare quando GitHub Agentic Workflows esce dall'anteprima.

### Conseguenze

* Positivo, perché semplice e compatibile con `claude-code-action`.
* Negativo, perché le issue aperte da esterni non ricevono triage automatico: lo fa un collaboratore o il triage locale.
