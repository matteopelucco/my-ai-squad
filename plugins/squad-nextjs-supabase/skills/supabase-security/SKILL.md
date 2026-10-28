---
name: supabase-security
description: Regole di sicurezza Supabase (RLS, GRANT, viste, service_role, migration) da applicare in review e prima di aprire una PR che tocca supabase/, autenticazione, ruoli o accesso ai dati. Le usano reviewer, security-reviewer e owasp-check in aggiunta alla checklist del nucleo.
argument-hint: "[PR | base]  (default: diff della branch contro main)"
---

Regole del pacchetto Next.js + Supabase + Vercel, **in aggiunta** alla checklist OWASP del nucleo. **Sola lettura**: segnali, non correggi. `$ARGUMENTS`: numero di PR (`gh pr diff <n>`) o branch base (default `main`, `git diff origin/main...HEAD`).

## Modello di minaccia
La `anon key` è pubblica per design: l'unica difesa dei dati è la **Row Level Security**. Chiunque può chiamare l'API REST di Supabase con quella chiave, senza passare dall'app. La `service_role key` **bypassa la RLS**: è un segreto vero.

## Checklist (una riga per voce: `ok`, `n/a` con motivo, o rilievo con `file:riga`)
1. **RLS su ogni tabella nuova** di `public`: `enable row level security` nella **stessa migration** che crea la tabella.
2. **Policy distinte** per SELECT, INSERT, UPDATE e DELETE dove servono; `USING` e `WITH CHECK` coerenti (un UPDATE senza `WITH CHECK` lascia spostare righe fuori dal proprio perimetro); nessun `USING (true)` involontario; ruoli separati come nelle specifiche.
3. **GRANT espliciti** nella stessa migration, solo per i ruoli e i privilegi che il codice usa (le tabelle nuove non ricevono più i privilegi di default). **Primo UPDATE o DELETE** su una tabella: servono sia la policy sia il GRANT di quel tipo. Mai togliere un GRANT solo per far passare il `grant-check`.
4. **Viste** esposte ad `anon`/`authenticated` con `security_invoker = true`; viste materializzate e tabelle esterne mai esposte (non hanno RLS).
5. **Funzioni `security definer`**: controllano il ruolo dentro la funzione, hanno `set search_path = ''` (o esplicito), e non sono eseguibili da `anon` se non serve.
6. **service_role** solo lato server, nei pochi file ammessi dal progetto; mai in un componente client, mai in una variabile `NEXT_PUBLIC_*`, mai negli e2e. Un'azione avviata da un utente usa la sua sessione (o una RPC con il controllo del ruolo), non la service_role.
7. **Migration**: file nuovo e numerato in `supabase/migrations/`; una migration già applicata non si modifica; nessuna migration allenta una policy senza motivo scritto nella PR.
8. **pgTAP**: ogni tabella con RLS ha `supabase/tests/database/<tabella>.test.sql` che prova anche il **negativo** (conteggi esatti: una RLS che nega dà zero righe, non errore).
9. **Allow-list** (`supabase/security-allowlist.json`): ogni voce nuova ha una motivazione e richiede la review del `security-reviewer`.
10. **Dati**: nessun dato reale di persone in seed, fixture o test; niente dati personali nei log.

## Esito
**`OK`** o **`DA CORREGGERE`**, con i rilievi nel formato `- [ALTO|MEDIO|BASSO] file:riga — problema → correzione minima`. Una PR che tocca RLS, GRANT, ruoli o autenticazione non si approva senza il `security-reviewer`. Dichiara ciò che non hai potuto verificare: le policy reali si vedono solo sul DB di test, in CI (`rls-check`, `grant-check`, pgTAP).
