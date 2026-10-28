# Attività schedulate in cloud (ricetta opzionale)

> Stato: **opzionale e spenta di default** (ADR-0006). Le attività schedulate di Claude Code sono in *research preview*: comportamento e limiti possono cambiare. Il flusso principale resta locale (`/squad-core:run-tasks`).

Scopo: far partire l'implementazione di una issue `status:ready` anche a laptop chiuso, per esempio dal telefono, aprendo una PR in bozza su un branch `claude/…`.

## Prima di attivarla

1. **Ruleset di `main`** applicato (`scripts/apply-ruleset.sh`, generato dal template): PR obbligatoria, gate `verifica` obbligatorio, niente force push, niente cancellazione, nessun bypass. È la difesa vera: l'attività non può aggirarla, e senza di essa **non va attivata**.
2. **Push solo su `claude/`**: le attività pushano su branch con quel prefisso; non abilitare nell'ambiente il push su altri branch.
3. **Ambiente minimo**: nessun segreto oltre a quelli indispensabili per costruire e testare; niente credenziali di produzione né accesso al database di test (l'attività non raggiunge le risorse protette dai segreti dei workflow).
4. **Connettori minimi**: solo GitHub, sul solo repository.

## Configurazione dell'attività

- **Trigger**: evento GitHub «issue etichettata», con filtro sull'etichetta `status:ready` e sull'autore (solo collaboratori: ADR-0011). In alternativa, una chiamata API lanciata a mano.
- **Modello e limiti**: `sonnet` per implementare; durata e turni contenuti come nelle esecuzioni dei workflow (`--max-turns`).
- **Prompt** (da adattare):

```text
Lavora sulla issue {numero} di questo repository con il flusso della squadra.
1. Leggi AGENTS.md / CLAUDE.md e la sola specifica pertinente.
2. Esegui l'agente squad-core:implementer: branch claude/{numero}-slug dal trunk aggiornato,
   codice minimo, controlli del progetto (verify in .claude/squad.json), PR in bozza con
   "Closes #{numero}", comando ed esito dei controlli e ciò che non hai verificato.
3. Non fare merge, non toccare workflow, segreti, ruleset né impostazioni del repository.
4. Se la specifica è ambigua, riporta la issue a status:needs-info con al massimo 3 domande
   e non scrivere codice.
```

## Limiti noti

- Anteprima: l'interfaccia, i trigger disponibili e i consumi possono cambiare tra una release e l'altra.
- Nessun accesso al database di test: i controlli che ne hanno bisogno (e2e, RLS) girano solo nella CI della PR.
- Consuma gli stessi limiti del piano delle sessioni locali (vedi [budget](budget.md)).
- Il merge resta dell'umano o di `run-tasks` per i task `ai-driven`: l'attività apre la PR e si ferma.

## Verifica dal vivo

**Da fare e annotare qui a ogni release del framework**, perché la funzione è in anteprima:

| Data | Versione del framework | Esito | Note |
| --- | --- | --- | --- |
| — | — | non ancora provata | La ricetta è stata scritta dalla documentazione, non eseguita. |
