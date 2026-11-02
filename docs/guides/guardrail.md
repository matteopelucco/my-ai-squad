# Guardrail imposti

Solo ciò che non ha eccezioni è imposto da hook e regole `deny` (principio 1 della [roadmap](../roadmap.md)); tutto il resto resta istruzione, perché il modello giudica meglio caso per caso. Gli hook sono in [`plugins/squad-core/hooks/`](../../plugins/squad-core/hooks/), i test in [`tests/hooks/`](../../tests/hooks/).

## Comandi (hook `PreToolUse` su Bash)

| Regola | Esito | Perché |
| --- | --- | --- |
| `gh pr merge` se la PR non chiude una issue `ai-driven` (o chiude una `human-in-the-loop`); sempre con `--admin` | nega | Il merge è dell'umano, salvo il flusso ai-driven ([ADR-0004](../adr/0004-auto-merge-solo-dei-task-ai-driven.md)). Se GitHub non risponde, nega. |
| `git push` verso `main`; `git commit` o `git push` senza refspec da `main` | nega | Tutto passa da branch e PR. |
| `git push --force` | nega | Riscrive la storia condivisa. |
| `git push --force-with-lease` | chiede | Lecito solo su un branch non condiviso. |
| `--no-verify` su commit e push | nega | Aggira i controlli. |
| `gh api` che modifica protezioni di branch o ruleset | nega | Le protezioni non le toglie un agente. |
| `gh repo delete`, `archive`, `rename` | nega | Distruttivo. |
| `gh repo edit`, `gh secret|variable set|delete` | chiede | Cambia impostazioni e segreti. |
| `git reset --hard`, `git clean -f` | chiede | Perde modifiche non salvate. |
| `rm -r` su `/`, `~`, `$HOME` | nega | Distruttivo. |

Le operazioni remote su database e deploy di produzione dipendono dallo stack: le guarda l'hook del pacchetto ([Next.js + Supabase + Vercel](nextjs-supabase.md#plugin-squad-nextjs-supabase)).

## File

- **File `.env*`**: regole `deny` di lettura in `.claude/settings.json` del template.
- **Perimetri di scrittura per agente** (hook `guard-paths.mjs`): gli agenti di un plugin non possono dichiarare hook propri, quindi il plugin ne registra uno per ogni scrittura e riconosce l'agente da `agent_type`. Limita `product-analyst` e `test-engineer` ai percorsi di `writeScopes` in `.claude/squad.json`. Se il file manca, o non dichiara il perimetro di uno dei due, vale quello predefinito, uguale al template: `docs/` e `specs/` per l'analista; `tests/`, `test/` ed `e2e/` per il test engineer. L'agente resta limitato invece di restare bloccato. Gli altri agenti e la sessione principale non sono toccati; la cartella temporanea del sistema è sempre consentita. I revisori sono in sola lettura perché non hanno i tool di scrittura.
- **Scritture dalla shell degli agenti limitati** (hook `guard-commands.mjs`): per `product-analyst` e `test-engineer` nega i comandi Bash o PowerShell che scrivono fuori dal perimetro, anche dentro `bash -c` e dopo un `cd`. Sono comandi come:
  - redirezioni `>` e `>>`, `tee`, `sed -i`;
  - `cp`, `mv`, `rm`, `touch`;
  - `git checkout -- …`, `git restore`;
  - `Set-Content`, `Out-File`, `Remove-Item`.

  Nega sempre i comandi di cui non si vede la destinazione: codice in linea (`node -e`, `python -c`, script da standard input), `git apply`, `git stash`, `git reset --hard`, `xargs`, destinazioni scritte con variabili. Eseguire i test e leggere resta consentito, e il testo di un heredoc non viene letto come comando.
- **Avviso di adozione incompleta** (hook `SessionStart`, `session-check.mjs`): se il plugin è attivo e `.claude/squad.json` manca, lo segnala all'avvio della sessione e dice quali default valgono finché il file non c'è.

- **Modalità di merge** (`mergeMode` in `.claude/squad.json`): con `human` l'hook nega ogni `gh pr merge` degli agenti; con `ai-driven` (o assente) vale la regola dell'ADR-0004.

## Fine del lavoro (hook `Stop`)

`verify` in `.claude/squad.json` è il comando rapido del progetto (typecheck, lint, test veloci). Se fallisce, l'hook rimanda Claude al lavoro con la coda dell'output; una sola volta per arresto, per non andare in ciclo. Senza `verify` non fa nulla.

**CI della PR** (`stop-ci.mjs`): se il branch corrente ha una PR aperta e i check dell'ultimo commit pushato sono in corso o falliti, l'hook rimanda Claude al lavoro una volta. Il messaggio chiede di attendere la CI con un solo `gh pr checks <pr> --watch --fail-fast` in background, o di leggere i job falliti; altrimenti Claude deve dire all'utente che la CI resta da guardare. Così una PR non resta senza nessuno che ne guardi la CI dopo un push. Non fa nulla su `main`, senza PR o senza check, con commit locali non ancora pushati, se `gh` non risponde, o con `"waitForCi": false` in `.claude/squad.json`. Il risveglio a fine CI funziona solo finché la sessione resta aperta.

## Limiti

Le regole leggono la riga di comando. Il controllo delle scritture segue anche `bash -c "…"` e `pwsh -Command`, ma non apre i file di script: `node build.mjs` o `npm test` possono scrivere ovunque senza che l'hook lo veda. Sono un argine contro gli errori, non una barriera contro un agente ostile; il ruleset di `main` su GitHub e la review della PR restano la difesa vera.
