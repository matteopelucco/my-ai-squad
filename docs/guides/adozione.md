# Adozione e aggiornamento

Tre percorsi: [progetto nuovo](#progetto-nuovo), [progetto esistente](#progetto-esistente), [aggiornamento](#aggiornare-un-progetto). Prerequisiti: `git`, `gh` autenticato (`gh auth login`, poi `gh auth refresh -s project` per il Project), Node 20+ e [Copier](https://copier.readthedocs.io/) (`pipx install copier`).

## Progetto nuovo

1. **Genera** il progetto e rispondi alle domande ([elenco](template.md)):
   ```bash
   copier copy gh:matteopelucco/my-ai-squad nome-progetto
   cd nome-progetto && git init -b main && git add -A && git commit -m "chore: initial project from my-ai-squad"
   ```
   Se vuoi un riferimento fissato a una release, aggiungi `--vcs-ref vX.Y.Z`.
2. **Crea il repository** su GitHub e pubblica: `gh repo create <owner>/nome-progetto --source . --push` (`--public` o `--private`).
3. **Label e Project** (una volta sola, sono idempotenti):
   ```bash
   scripts/setup-labels.sh
   scripts/setup-project.sh
   ```
   Poi, nel Project, aggiungi a mano la colonna `Need Info` e ordina la colonna `Todo` per priorità (più in alto = prima). Le label `area:*` dipendono dal progetto: creale tu.
4. **Ruleset di `main`**, con un account amministratore:
   ```bash
   scripts/apply-ruleset.sh
   ```
   Richiede PR e il gate `verifica`, vieta force push e cancellazione, senza bypass. Il gate esiste solo dopo il primo run della CI: fai girare una PR prima, oppure applica il ruleset subito (la prima PR resterà in attesa del check).
5. **Segreti dei workflow agentici**: imposta **uno** tra `CLAUDE_CODE_OAUTH_TOKEN` (abbonamento: `claude setup-token`) e `ANTHROPIC_API_KEY` (chiave API) in *Settings → Secrets and variables → Actions*. Quale scegliere è ancora aperto ([#12](https://github.com/matteopelucco/my-ai-squad/issues/12)); senza nessuno dei due il triage automatico non parte, il resto funziona. Con lo stack Next.js/Supabase servono anche i segreti elencati nella [guida dello stack](nextjs-supabase.md). Nessun segreto va mai nel repository.
6. **Primo avvio in Claude Code**: apri il progetto, accetta il marketplace `my-ai-squad` e i plugin proposti da `.claude/settings.json`, poi prova `/squad-core:next-task`.
7. **Comandi di verifica**: se hai lasciato vuoti `verify_fast`/`verify_full`, scrivili in `.claude/squad.json` e in `AGENTS.md` prima di far lavorare gli agenti.

## Progetto esistente

Si adotta in **una PR**, rivedibile, mai direttamente su `main` (ADR-0010). Ordine consigliato dei progetti: sitescanner (solo nucleo), communio, girasole.

1. **Genera in una cartella a parte** con le stesse risposte che darebbe il progetto, e confronta:
   ```bash
   copier copy gh:matteopelucco/my-ai-squad /tmp/confronto
   diff -ru . /tmp/confronto --exclude=.git --exclude=node_modules | less
   ```
2. **Branch** `chore/<n>-adozione-squad` e copia i file che non esistono ancora: `.claude/settings.json`, `.claude/squad.json`, template di issue e PR, script, workflow, `.copier-answers.yml` (serve a `copier update`: copialo dalla cartella di confronto, generata dal template pubblicato, così `_src_path` punta al template giusto).
3. **Unisci a mano** i file che esistono già:
   - `AGENTS.md` / `CLAUDE.md`: tieni le regole del progetto, aggiungi quelle del template; `CLAUDE.md` deve iniziare con `@AGENTS.md` (ADR-0007);
   - `.claude/settings.json`: aggiungi `extraKnownMarketplaces`, `enabledPlugins` e le regole `deny` mancanti, senza togliere i permessi esistenti;
   - workflow di CI: il gate si chiama `verifica`. Se ne hai già uno, rinominalo o mantieni il tuo e adegua il ruleset (`.github/rulesets/main.json`);
   - label: `scripts/setup-labels.sh` non tocca quelle che non conosce.
4. **Agenti e comandi vecchi**: elimina da `.claude/agents/` e `.claude/commands/` ciò che il nucleo ora fornisce (`triage`, `implementer`, `reviewer`, `/next-task`, …), tenendo ciò che è specifico del progetto. Gli agenti e le skill del plugin hanno il prefisso `squad-core:`, quindi una copia locale con lo stesso nome convive con quella del plugin senza sostituirla: lasciarla significa mantenerla a mano e non ricevere gli aggiornamenti.
5. **Prova** il progetto in locale (`verify`), apri la PR con prova ed esito, e solo dopo il merge applica ruleset e segreti (passi 4 e 5 del progetto nuovo).
6. **Annota** nella PR cosa è stato lasciato com'è e perché.

## Aggiornare un progetto

Due canali indipendenti.

**Plugin** (agenti, skill, hook): Se l'aggiornamento automatico del marketplace è attivo, Claude Code lo aggiorna all'avvio; altrimenti `/plugin marketplace update my-ai-squad`. Non c'è nulla da unire: cambia il comportamento al prossimo avvio. Leggi le [release](https://github.com/matteopelucco/my-ai-squad/releases): un cambio incompatibile è in cima alle note.

**File di progetto** (template):
```bash
git switch -c chore/aggiorna-squad
copier update                # oppure: copier update --vcs-ref vX.Y.Z
git diff                     # rivedi come una PR qualsiasi
```
- Copier riapplica le tue risposte (`.copier-answers.yml`) e propone solo le differenze del template; le tue modifiche locali restano.
- **Conflitti**: dove template e progetto hanno cambiato la stessa riga, Copier lascia marcatori `<<<<<<<` (o file `.rej` con `--conflict rej`). Risolvili come un merge normale, tenendo la versione del progetto per le scelte tue e quella del template per le correzioni.
- Una domanda nuova nel template viene posta al primo `copier update`; con `--defaults` si accetta il valore predefinito.
- Esegui `verify`, apri la PR (`Closes`/`Refs` come d'abitudine) e fai il merge dopo la review. Mai `copier update` direttamente su `main`.

Aggiornare spesso rende i diff piccoli: una release alla volta è più facile da rivedere di dieci insieme.
