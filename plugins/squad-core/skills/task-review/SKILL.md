---
name: task-review
description: Review a richiesta di una PR (o della PR collegata a una issue) con l'agente reviewer, più security-reviewer se serve. Il report resta in chat.
argument-hint: "<issue|PR>"
---

Orchestratore della review a richiesta. `$ARGUMENTS`: numero di PR o issue (obbligatorio). Non scrivi nulla su GitHub da solo.

## 1. Risolvi l'argomento (solo letture, non cambiare branch)
- Prova come PR: `gh pr view <N> --json number,state,isDraft,title,headRefName,body` (anche se già mergiata: lo dici nel report).
- Altrimenti è una issue: cerca la PR aperta con branch `*/<N>-*`, poi `Closes #<N>` nel corpo. Nessuna: dillo e fermati. Più candidate: elencale e chiedi.

## 2. Contesto minimo
Issue collegata e checklist, solo la specifica pertinente, `gh pr diff`, file toccati, `gh pr checks` (non aspettare i check in corso: "in corso"). CI rossa: leggi solo `gh run view <run-id> --log-failed` e distingui regressione da infrastruttura.

## 3. `squad-core:reviewer`
Passagli PR, issue, specifica e di leggere il diff con `gh pr diff <PR>`. Chiedi i rilievi nel formato del punto 5.

## 4. `security-reviewer` (solo con conferma)
Se il diff tocca autenticazione, permessi, dati personali, segreti, workflow CI o migrazioni, **proponilo** all'utente con motivo e file (costa) e lancialo solo dopo un sì. Senza conferma scrivi "review di sicurezza NON eseguita": il verdetto non può essere OK.

## 5. Report in chat (italiano, breve)
**Verdetto**: `OK` · `OK con rilievi` (solo BASSO) · `da correggere` (almeno un BLOCCO o MEDIO), con PR, issue, stato e CI.
**Rilievi**: `- [BLOCCO|MEDIO|BASSO] file:riga — problema → correzione minima`.
**Controlli di processo** (una riga ciascuno): ogni punto della checklist coperto; test per gli scenari della specifica; `Closes #<n>` nel corpo; prova dei controlli nella PR; versione e README aggiornati se `AGENTS.md` li richiede; nessun segreto nel diff.
**Non verificato**: ciò che non hai potuto controllare.

## 6. Non pubblicare da solo
Niente commento, merge, `gh pr ready`, review GitHub o cambio di label. Offri di postare il report: solo dopo un sì, scrivilo in un file e usa `gh pr comment <PR> --body-file <file>`.
