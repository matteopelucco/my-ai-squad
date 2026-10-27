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

Le operazioni remote su database e deploy di produzione dipendono dallo stack: arrivano con il pacchetto di stack.

## File

- **File `.env*`**: regole `deny` di lettura in `.claude/settings.json` del template.
- **Perimetri di scrittura per agente** (hook `guard-paths.mjs <profilo>`, da usare nel frontmatter degli agenti): i percorsi consentiti a ciascun profilo si dichiarano in `writeScopes` di `.claude/squad.json`. Un profilo non dichiarato non scrive niente; `/tmp` è sempre consentito.

## Fine del lavoro (hook `Stop`)

`verify` in `.claude/squad.json` è il comando rapido del progetto (typecheck, lint, test veloci). Se fallisce, l'hook rimanda Claude al lavoro con la coda dell'output; una sola volta per arresto, per non andare in ciclo. Senza `verify` non fa nulla.

## Limiti

Le regole leggono la riga di comando: non vedono un comando dentro `bash -c "…"` o uno script. Sono un argine contro gli errori, non una barriera contro un agente ostile; il ruleset di `main` su GitHub resta la difesa vera.
