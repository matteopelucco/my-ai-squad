---
status: accepted
date: 2026-10-27
decision-makers: Pelucco Matteo
---

# Distribuzione con plugin Claude Code e template Copier

## Contesto e problema

Il setup AI di girasole, communio e sitescanner è stato copiato e reinterpretato a mano in ogni progetto: tre insiemi di agenti, convenzioni diverse, nessun modo di propagare un miglioramento ([analisi §3.1](../research/2026-10-analisi-setup-ai.md#31-distribuzione-e-aggiornamento)). Serve un unico punto da cui partire per un nuovo progetto e da cui aggiornare quelli esistenti.

## Opzioni considerate

* **Plugin Claude Code in un marketplace + template Copier** per i file che un plugin non può contenere
* Solo template Copier, con agenti e skill copiati nei progetti
* Solo plugin, con il resto copiato a mano da una guida
* Repository template di GitHub (copia una tantum)

## Esito della decisione

Opzione 1. Il repository my-ai-squad è insieme:

* un **marketplace** (`.claude-plugin/marketplace.json`) da cui i progetti installano skill, agenti e hook come plugin versionati, dichiarati in `.claude/settings.json` del progetto (`extraKnownMarketplaces`, `enabledPlugins`);
* un **template Copier** per ciò che un plugin non porta: `AGENTS.md`/`CLAUDE.md`, `.claude/settings.json` (permessi, hook di progetto), workflow GitHub, template di issue e PR, script delle label, configurazioni di CI. `copier update` propone gli aggiornamenti come diff, da rivedere in una PR.

### Conseguenze

* Positivo, perché skill, agenti e hook si aggiornano senza toccare i repository.
* Positivo, perché i file di progetto restano nel progetto, personalizzabili, e ricevono comunque le novità.
* Negativo, perché i meccanismi sono due, ciascuno con la sua versione da tenere allineata.
* Negativo, perché Copier è uno strumento Python in più sulla macchina di sviluppo e nella CI che apre le PR di aggiornamento.
