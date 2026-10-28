# Budget del piano e costo delle esecuzioni

Il piano Pro ha finestre di consumo (5 ore e settimanale) condivise tra le sessioni locali e, se si usa l'abbonamento, anche i workflow. `/squad-core:run-tasks` le rispetta senza strumenti non documentati.

## Cosa si legge e come

| Cosa | Strumento | Nota |
| --- | --- | --- |
| Percentuali di consumo del piano | `/usage` in Claude Code | È per le persone: la skill chiede all'utente le due percentuali. |
| Chi consuma (skill, agenti, plugin, MCP) | `/usage` | Mostra attribuzione e raccomandazioni. |
| Limite di una esecuzione senza persona | `--max-turns`, `--max-budget-usd` | Nei workflow del template c'è `--max-turns`; aggiungi `--max-budget-usd` dove usi una chiave API. |
| Ripresa dopo il tetto del piano | impostazione `autoContinueAtUsageLimit` | Riprende il lavoro al reset della finestra; attivala solo dove un ciclo lungo è voluto. |

Se le percentuali non sono disponibili, la skill usa un numero fisso di task (2, o quello chiesto) e lo dichiara: **i tetti non sono controllati**.

## Il calcolo

`skills/run-tasks/budget.mjs`, testato in `tests/budget/`:

- `n = min( ⌊(tetto5h − usato5h) / costo5h⌋ , ⌊(tettoSett − usatoSett) / costoSett⌋ )`, limitato al `n` richiesto (senza `n`: al massimo 5);
- costo iniziale prudente: 10 punti (5 ore) e 3 (settimana) per task; dopo ogni task `--learn` tiene la **differenza massima** osservata (granularità 1 %, altre sessioni consumano in parallelo);
- prima di ogni task si ricalcola; se non ci sta, ci si ferma e si riporta il reset.

I tetti sono in `budget` di `.claude/squad.json` (default: 80 % su 5 ore, 85 % sulla settimana, 60 % di contesto).

## Abitudini che costano meno

- **`/clear` tra task non correlati**: la cache dei prompt dura circa un'ora sugli abbonamenti; un contesto lungo si paga a ogni turno.
- **Modello per compito**: Haiku per il triage, Sonnet per implementare, Opus per la sicurezza (già negli agenti).
- **`AGENTS.md` breve** (sotto le 200 righe) e procedure in skill caricate su richiesta.
- **Un task alla volta**, `--max-turns` in ogni esecuzione senza persona.
- Non lasciare cicli lunghi su un abbonamento condiviso con il lavoro interattivo: scegli prima l'autenticazione dei workflow ([#12](https://github.com/matteopelucco/my-ai-squad/issues/12)).
