# Pacchetto Next.js + Supabase + Vercel

Si abilita con `stack=nextjs-supabase` nel template ([ADR-0002](../adr/0002-nucleo-indipendente-dallo-stack-e-pacchetto-nextjs-supabase-vercel.md)). Estratto dal bootstrap di girasole, senza dati né riferimenti del progetto di origine. Due parti: il plugin `squad-nextjs-supabase` e i file che il template genera solo con questo stack.

## Plugin `squad-nextjs-supabase`

| Componente | Cosa fa |
| --- | --- |
| Hook `guard-stack.mjs` (`PreToolUse` su Bash) | Operazioni Supabase remote (`db push`, `link`, `migration repair`, `--linked`, `--project-ref`, …) consentite solo con `--project-ref` uguale al progetto di **test**; `--db-url` negato; senza progetto di test configurato nega tutto. Nega `vercel --prod`, `promote`, `rollback`, `remove` e la creazione o cancellazione di progetti Supabase; chiede conferma per `vercel env add/rm/pull`. |
| Skill `supabase-security` | Checklist RLS, policy, GRANT, viste, `security definer`, `service_role`, migration, pgTAP: la usano reviewer, `security-reviewer` e `owasp-check` in aggiunta alla checklist del nucleo. |
| Skill `supabase-migration` | Procedura per scrivere una migration con RLS, policy, GRANT e test pgTAP, e per descrivere nella PR il passo manuale in produzione. |

Il progetto di test si indica in `supabase.testProjectRef` di `.claude/squad.json` o nella variabile d'ambiente `SUPABASE_TEST_PROJECT_REF`.

## File del template

| File | Contenuto |
| --- | --- |
| `.github/workflows/ci.yml` | Al posto della CI del nucleo: `statico` (tipi, lint, duplicati, unit, build) → `e2e` (reset del DB di test, pgTAP, `rls-check`, `grant-check`, Playwright) → `verifica`. `verifica` è il gate del ruleset: `if: always()`, mai rinominato. Mai `paths`/`paths-ignore`: le PR di soli documenti saltano build ed e2e con `if:`. La e2e è in un gruppo di concorrenza globale (`cancel-in-progress: false`, `queue: max`) perché il DB di test è uno solo. Non parte sulle PR di Dependabot. |
| `.github/workflows/release.yml` | Tag `vX.Y.Z` e GitHub Release con note generate quando cambia la `version` di `package.json` (`scripts/release-tag.sh`); recupero con `workflow_dispatch` e `force`. |
| `.github/dependabot.yml` | Settimanale per npm e GitHub Actions; gruppi `minor-and-patch` e `major`; major di Next, React, TypeScript, ESLint, Tailwind e Supabase bloccati finché non c'è una issue di aggiornamento. |
| `.githooks/pre-push` | Tipi, lint, duplicati, unit test, build (saltabile con `SKIP_BUILD_PRE_PUSH=1`; saltata se `.env.local` manca o è incompleta). |
| `scripts/rls-check.mjs` | Sul DB di test: tabelle esposte ad `anon`/`authenticated` con RLS spenta, viste senza `security_invoker`, viste materializzate e tabelle esterne esposte. |
| `scripts/grant-check.mjs` | Confronta le query `.from('tabella')` del codice, per ruolo, con i GRANT del DB di test. |
| `supabase/security-allowlist.json` | Eccezioni volute ai due controlli, ognuna con `reason`. |

## Contratto con il progetto

- Script npm: `typecheck` (`next typegen && tsc --noEmit`), `lint`, `check:dup`, `test:unit`, `build`, `test:e2e`; facoltativo `e2e:prepare`, che dopo il reset ricrea gli account di test (riceve `SUPABASE_SERVICE_ROLE_KEY` ed `E2E_ACCOUNTS`). `"prepare": "git config core.hooksPath .githooks"` attiva l'hook.
- Variabile di repository `SUPABASE_TEST_PROJECT_REF`. Repository secrets, tutti verso il **solo progetto di test**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `E2E_ACCOUNTS` (credenziali degli account di test, nel formato che il progetto sceglie).
- Store dei segreti «Dependabot» **senza** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` ed `E2E_ACCOUNTS`: uno script di installazione di una dipendenza aggiornata li leggerebbe prima di ogni revisione umana.
- Ruleset di `main` con il check obbligatorio `CI / verifica`.
- Migration in produzione solo a mano dall'umano, subito dopo il merge (procedura nella skill `supabase-migration`).

## Verifica

`tests/stack/*.test.mjs` (regole dell'hook, logica di `rls-check` e `grant-check`), `tests/stack.sh` (skill, struttura dei workflow, Dependabot, assenza dei file senza stack e dei riferimenti al progetto di origine) e `tests/sample.sh`, che sul progetto campione esegue il gate `verifica` su ogni combinazione di esiti, l'hook pre-push e il calcolo del tag di release.
