# Analisi del setup AI di girasole, communio e sitescanner

Analisi del 2026-10-27, punto di partenza di my-ai-squad. Confronta il setup AI costruito a mano in tre progetti con lo stato dell'arte documentato a ottobre 2026 e ne ricava le decisioni registrate in [docs/adr/](../adr/README.md).

## 1. Cosa è stato analizzato

| Progetto | Stato | Setup AI |
|---|---|---|
| [girasole](https://github.com/matteopelucco/girasole) | in produzione, ~50 issue lavorate da agenti | `CLAUDE.md` breve con rimandi, `AGENTS.md` generato da Next.js, 4 agenti (`triage` Haiku, `implementer` Sonnet, `reviewer` Sonnet, `rls-guardian` Opus), 5 comandi (`/next-task`, `/run-tasks`, `/task-review`, `/owasp-check`, `/rebase-pr`), `claude-board.yml` (triage su issue aperta, review su PR spenta di default, `status:done` alla chiusura), CI a tre job, hook git pre-push, 11 ADR, e soprattutto `docs/bootstrap-progetto.md`: un prompt da incollare per impostare un nuovo progetto dello stesso tipo. |
| [communio](https://github.com/matteopelucco/communio) | bootstrap documentale, senza codice | mandato da 492 righe (`docs/communio-master-prompt.md`), 4 agenti diversi (`product-analyst`, `architect-engineer`, `test-engineer`, `security-reviewer`), 4 skill (`work-on-issue`, `review-spec`, `tdd-cycle`, `prepare-pr`), **hook `PreToolUse` deterministici con test** (`guard-commands`, `guard-paths`), regole `deny` sui file `.env`. |
| sitescanner | in sviluppo | backlog in `tasks.md` lavorato da loop agentici, specifiche numerate con ID dei requisiti, ADR MADR, nessuna CI agentica, nessun hook, commit in italiano. |

## 2. Punti di forza

- **Specifiche prima del codice, test prima dell'implementazione.** Scenari Given/When/Then, corrispondenza 1:1 tra specifica e test e2e (girasole), tracciabilità requisito → issue → test → PR (communio), ADR MADR in tutti e tre. È l'approccio che [GitHub Spec Kit](https://github.github.com/spec-kit/history.html) ha reso diffuso (costituzione → specifica → piano → task → implementazione), applicato senza strumenti dedicati.
- **La board come contratto tra agenti.** Gli agenti non si parlano: leggono e scrivono label (`status:*`, `type:*`, `area:*`, `tier:*`). Il modello si sceglie per costo (Haiku per il triage, Sonnet per implementare, Opus solo dove un errore costa caro).
- **Gate umano esplicito.** Il merge è umano. L'unica eccezione, in girasole, è `ai-driven` contro `human-in-the-loop`: auto-merge solo dei task semplici con CI verde.
- **CI difensiva** (girasole):
  - un solo check obbligatorio (`verifica`, con `if: always()`), senza `paths-ignore` che lo lascerebbe «non eseguito»;
  - una coda globale per il DB di test condiviso;
  - i segreti non arrivano allo store di Dependabot;
  - permessi minimi;
  - nessun valore controllato dall'utente interpolato nei `run:`.
- **Guardrail deterministici** (communio): merge, push su `main`, force push, operazioni remote su Supabase e deploy in produzione bloccati da hook testati, con le regole valutate segmento per segmento della riga di comando.
- **Controllo dei costi:**
  - in CI: `--max-turns`, `--allowedTools` elencati, diff preparato prima di chiamare il modello, review spenta di default, riepilogo di token e cache nel job;
  - in locale: `/run-tasks` calcola quanti task permettersi dalle finestre del piano Pro.

## 3. Scostamenti dallo stato dell'arte

### 3.1 Distribuzione e aggiornamento

**Oggi.** Il «framework» è un prompt da copiare (`bootstrap-progetto.md`); ogni progetto lo reinterpreta. Tre repository hanno tre insiemi di agenti, due formati di branch (`feat/issue-<n>-slug` e `feat/<n>-slug`), due lingue dei commit e due posti per il backlog (issue e `tasks.md`). Un miglioramento fatto in un progetto non raggiunge gli altri.

**Stato dell'arte.** Claude Code distribuisce skill, agenti, hook, server MCP e LSP come **plugin** pubblicati in un **marketplace git** ([Create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces), [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace.md)):
- ogni plugin ha una versione; l'aggiornamento automatico si attiva per marketplace;
- un repository dichiara marketplace e plugin per tutti con `claude plugin marketplace add … --scope project`, che scrive `.claude/settings.json` (con `enabledPlugins`);
- le release si possono fissare con `ref`/`sha`, e i nomi cambiati si migrano con `renames`.

Un plugin **non** può contenere `CLAUDE.md` (non viene caricato come contesto di progetto), né regole di permesso, né workflow GitHub: dalle impostazioni di un plugin valgono solo `agent` e `subagentStatusLine` ([Add components to a plugin](https://code.claude.com/docs/en/plugins/components.md)). Per quei file serve un template che sappia aggiornare i progetti già generati: [Copier](https://copier.readthedocs.io/en/latest/comparisons/) ripropone le modifiche del template come diff, rispettando le personalizzazioni locali. Un repository template di GitHub copia invece una volta sola.

### 3.2 Regole senza eccezioni scritte in prosa

**Oggi.** In girasole «mai merge», «mai `--force`», «mai produzione» stanno nei prompt degli agenti. `settings.json` nega soltanto la lettura di due file.

**Stato dell'arte.** Le [best practice di Claude Code](https://code.claude.com/docs/en/best-practices) distinguono le istruzioni non deterministiche (prompt, `CLAUDE.md`, skill: il modello può giudicare che non si applichino) da quelle deterministiche (hook, regole `deny`, impostazioni gestite). Ciò che deve valere sempre va nelle seconde; il resto va lasciato al giudizio del modello, e un insieme di regole imposte troppo grande è un difetto. Communio applica già questo principio.

### 3.3 Definizione di «fatto» non imposta

**Oggi.** I controlli prima della consegna dipendono dal fatto che l'agente li esegua. L'hook git pre-push copre il push, non la fine del lavoro.

**Stato dell'arte.** Serve dare a Claude un controllo da eseguire che risponda passato/fallito:
- un **hook `Stop`** lo rimanda al lavoro finché typecheck e test non passano;
- `/goal` tiene aperto il lavoro sulle esecuzioni lunghe;
- `/code-review` fa revisionare il diff da un contesto che non ha visto scriverlo;
- va chiesta sempre la prova (comando ed esito), non la dichiarazione.

### 3.4 Agenti in CI su repository pubblici

**Oggi.** Il triage di girasole parte su ogni `issues: opened`, con i tool di scrittura di file e label.

**Stato dell'arte:**
- Ad aprile 2026 un attacco di prompt injection tramite commenti («Comment and Control») ha colpito gli agenti eseguiti in GitHub Actions, Claude Code compreso ([CSA](https://labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection/), [guida all'hardening](https://avinashsangle.com/blog/hardening-ai-agents-cicd-prompt-injection)).
- La [documentazione di sicurezza della action](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md) raccomanda token di breve durata, tool ristretti e attenzione alle istruzioni nascoste nei commenti HTML.
- `claude-code-action` richiede che chi scatena un evento su issue o PR abbia **permesso di scrittura** sul repository ([GitHub Actions](https://code.claude.com/docs/en/github-actions.md)): il triage delle issue aperte da esterni oggi non parte, e la cosa non è documentata nei progetti.
- Lo schema più robusto è quello delle *safe outputs* di [GitHub Agentic Workflows](https://github.github.com/gh-aw/reference/safe-outputs/): l'agente gira in sola lettura e le scritture le applica un job separato dopo controlli. È in technical preview da febbraio 2026.

### 3.5 Token e piano Pro

**Oggi.**
- `/run-tasks` legge il budget con `mcp__ccd_session_mgmt__get_usage`, uno strumento della sessione dell'app Desktop che non risulta nella documentazione pubblica.
- I workflow si autenticano con `ANTHROPIC_API_KEY` (spesa API separata dal piano).
- I modelli sono scritti per esteso nei workflow (`claude-haiku-4-5`, `claude-sonnet-5`) e sono già superati dalla famiglia 5.5.

**Stato dell'arte** ([Manage costs](https://code.claude.com/docs/en/costs.md)):
- `/usage` mostra i limiti del piano e attribuisce i consumi a skill, subagenti, plugin e server MCP, con raccomandazioni;
- `--max-turns` e `--max-budget-usd` limitano le esecuzioni senza nessuno davanti;
- `autoContinueAtUsageLimit` riprende il lavoro al reset della finestra;
- la cache dei prompt dura circa un'ora sugli abbonamenti, quindi conviene `/clear` tra task non correlati;
- le Actions possono usare l'abbonamento con `CLAUDE_CODE_OAUTH_TOKEN` (`claude setup-token`), con il compromesso di consumare gli stessi limiti delle sessioni interattive.

### 3.6 Formati in disuso

**Oggi.** Girasole usa `.claude/commands/`.

**Stato dell'arte.** Le skill sostituiscono i comandi ([Skills](https://code.claude.com/docs/en/skills)):
- caricano il testo completo solo quando servono;
- possono portare file di supporto;
- con `disable-model-invocation: true` partono solo quando le chiami tu.

Le regole che valgono per una parte del codice vanno in `.claude/rules/` con `paths:`; `CLAUDE.md` resta sotto le 200 righe e contiene solo ciò che non si ricava dal codice.

### 3.7 Lavoro da remoto e in parallelo

**Oggi.** `flusso-remoto.md` di girasole dice che il modo di far partire l'implementazione in cloud «non è documentato».

**Stato dell'arte.**
- Le **attività schedulate in cloud** ([Automate work with scheduled tasks](https://code.claude.com/docs/en/routines.md)) sono disponibili sui piani Pro, in research preview. Partono da un orario, da una chiamata API o da eventi GitHub (issue, PR, release, con filtri), consumano l'abbonamento e pushano su branch `claude/`. Una regola di protezione su `main` che il task non può aggirare è obbligatoria.
- In locale: worktree (`claude -w`), `/batch` per modifiche ripetitive su molti file.

### 3.8 Il framework non è testato

**Oggi.** Solo gli hook di communio hanno test.

**Stato dell'arte:**
- `claude plugin validate` controlla struttura e manifest;
- le eval dei plugin verificano che i componenti cambino il comportamento come previsto;
- gli hook, come logica pura, si testano con un test runner.

Un framework affidabile si verifica generando un progetto campione e facendolo passare per la pipeline completa a ogni release.

### 3.9 Accoppiamento allo stack

**Oggi.** Il bootstrap di girasole è Next.js + Supabase + Vercel, e non si applica a sitescanner.

**Proposta.** Organizzarlo a livelli:
- un **nucleo** indipendente dallo stack: ciclo di sviluppo, agenti, guardrail, CI agentica;
- **pacchetti di stack**, a partire da Next.js/Supabase/Vercel;
- **profili di rischio** dentro i pacchetti, ad esempio dati di minori o multi-tenant.

### 3.10 Istruzioni per altri agenti

[AGENTS.md](https://www.theregister.com/ai-and-ml/2026/09/18/anthropic-decides-to-support-openais-markdown-instructions-spec/5297588) è uno standard aperto (Agentic AI Foundation, Linux Foundation) letto da Codex, Copilot, Cursor e, da settembre 2026, da Claude Code quando manca `CLAUDE.md`. Lo schema diffuso: regole comuni in `AGENTS.md`, `CLAUDE.md` che lo importa (`@AGENTS.md`) e aggiunge solo le parti specifiche di Claude ([guida](https://www.morphllm.com/agents-md-guide)).

## 4. Conclusione

Il **metodo** è solido, in alcuni punti più maturo della pratica corrente: specifiche, test, gate umano, controllo dei costi. Il **meccanismo** è artigianale: prompt copiati, regole in prosa, nessuna versione né aggiornamento, nessuna verifica del setup stesso. Il miglioramento principale viene da tre interventi:
1. impacchettare l'esistente in plugin versionati più un template aggiornabile;
2. rendere deterministiche le poche regole senza eccezioni;
3. verificare il framework su un progetto campione a ogni release.

Le decisioni prese il 2026-10-27 sono negli ADR 0001–0012.

## 5. Fonti

- Claude Code: [Best practices](https://code.claude.com/docs/en/best-practices), [Create a marketplace](https://code.claude.com/docs/en/plugin-marketplaces), [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace.md), [Add components to a plugin](https://code.claude.com/docs/en/plugins/components.md), [Skills](https://code.claude.com/docs/en/skills), [GitHub Actions](https://code.claude.com/docs/en/github-actions.md), [Scheduled tasks](https://code.claude.com/docs/en/routines.md), [Manage costs](https://code.claude.com/docs/en/costs.md)
- Sicurezza: [claude-code-action security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md), [CSA research note](https://labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection/), [Hardening AI agents in CI/CD](https://avinashsangle.com/blog/hardening-ai-agents-cicd-prompt-injection), [Rule of Two](https://datawater.com/claude-code-github-action-prompt-injection/)
- GitHub: [Agentic Workflows](https://github.com/github/gh-aw), [Safe outputs](https://github.github.com/gh-aw/reference/safe-outputs/), [technical preview](https://github.blog/changelog/2026-02-13-github-agentic-workflows-are-now-in-technical-preview/), [Spec Kit history](https://github.github.com/spec-kit/history.html)
- AGENTS.md: [The Register](https://www.theregister.com/ai-and-ml/2026/09/18/anthropic-decides-to-support-openais-markdown-instructions-spec/5297588), [Morph guide](https://www.morphllm.com/agents-md-guide)
- Template: [Copier comparisons](https://copier.readthedocs.io/en/latest/comparisons/), [Copier generating](https://copier.readthedocs.io/en/latest/generating/), [PyCon DE 2026: template automation](https://2026.pycon.de/talks/AWFFUS/)
