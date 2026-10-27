---
name: supabase-migration
description: Procedura per scrivere una migration Supabase (tabella, RLS, policy, GRANT, test pgTAP) e per descrivere nella PR il passo manuale in produzione. Da usare quando un task richiede una modifica allo schema del database.
argument-hint: "<descrizione breve della modifica>"
---

Modifica dello schema descritta in `$ARGUMENTS`. Solo file in locale e, se serve, il progetto di **test**: la produzione la tocca solo l'umano.

## 1. Scrivi la migration
- File nuovo con `supabase migration new <nome_in_inglese>`: mai modificare una migration già presente su `main`, mai il dashboard o lo SQL Editor.
- Apri il file con un'intestazione che dica cosa fa e come si applica: in test con `--project-ref` del progetto di test, in produzione solo a mano dall'umano.
- Per ogni tabella nuova, **nella stessa migration**: `create table`, `enable row level security`, una policy per ogni operazione usata (SELECT/INSERT/UPDATE/DELETE, con `USING` e `WITH CHECK`), `grant` dei soli privilegi usati ai soli ruoli che li usano.
- Viste esposte: `with (security_invoker = true)`.

## 2. Scrivi i test
- `supabase/tests/database/<tabella>.test.sql` in `begin; … rollback;`, con pgTAP: impersona `authenticated` (con `request.jwt.claims` e `sub`) o `anon`, prova il caso permesso **e** quello negato con conteggi esatti.
- Se l'app legge o scrive la tabella, il `grant-check` della CI confronterà le query del codice con i GRANT: verifica di non averne dimenticati.

## 3. Verifica
- In locale: `supabase db reset` (DB locale) e `supabase test db`, se Docker è disponibile; altrimenti dichiaralo nella PR.
- Rileggi la migration con la skill `supabase-security`.
- Il DB di test condiviso lo resetta la CI: non lanciare e2e in locale sul DB di test mentre una CI e2e è in corso (`gh run list --status in_progress`).

## 4. Nella PR
Aggiungi una sezione **Passo manuale in produzione** con, per l'umano, subito dopo il merge:
1. `supabase db push --project-ref <ref-produzione> --dry-run`: deve elencare solo le migration di questa PR;
2. `supabase db push --project-ref <ref-produzione>`;
3. `supabase migration list --project-ref <ref-produzione>`: Local e Remote coincidono;
4. aprire la schermata coinvolta e verificarla.

Il deploy del codice non applica le migration: tra merge e passo manuale il codice nuovo può cercare colonne che non esistono ancora. Se la modifica non è retrocompatibile, scrivilo in evidenza.
