# Roadmap

## Struttura prevista del repository

```
my-ai-squad/
├── .claude-plugin/marketplace.json     # catalogo dei plugin (marketplace "my-ai-squad")
├── plugins/
│   ├── squad-core/                     # nucleo: agenti, skill di flusso, hook di guardia
│   └── squad-nextjs-supabase/          # pacchetto di stack
├── template/                           # template Copier (copier.yml + file di progetto)
├── tests/                              # test di hook e skill, generazione del progetto campione
├── docs/{research,adr,guides}/
└── .github/workflows/                  # validazione, test, progetto campione, release
```

## Principi di progetto

Ricavati dall'[analisi](research/2026-10-analisi-setup-ai.md); ognuno diventa requisito dei task della versione 0.1.

1. **Deterministico solo ciò che non ha eccezioni.** Merge fuori dal flusso `ai-driven`, push su `main`, force push, `--no-verify`, operazioni remote su DB e deploy di produzione, lettura dei file `.env`: hook e regole `deny` con test. Tutto il resto resta istruzione, perché il modello giudica meglio caso per caso.
2. **La definizione di «fatto» è un controllo, non una promessa.** Hook `Stop` sui controlli rapidi del progetto, review indipendente in contesto pulito, prova (comando ed esito) nel corpo della PR.
3. **Contesto minimo.** `AGENTS.md`/`CLAUDE.md` sotto le 200 righe; procedure in skill caricate su richiesta; regole di una parte del codice in `.claude/rules/` con `paths:`.
4. **Costo esplicito.** Modello per compito (Haiku per triage, Sonnet per implementare, Opus per la sicurezza), `--max-turns` e limiti di tempo in ogni esecuzione senza persona, budget del piano letto con strumenti documentati.
5. **Il framework si verifica da solo.** Nessuna release senza progetto campione verde.

## Versione 0.1 — il nucleo funzionante

- [x] Struttura di marketplace, plugin e template Copier
- [x] Agenti della squadra standard (ADR-0005)
- [ ] Skill di flusso migrate dai comandi di girasole e communio
- [x] Hook di guardia deterministici con test, regole `deny`, hook `Stop`
- [ ] Template Copier del nucleo
- [ ] Pacchetto Next.js/Supabase/Vercel
- [ ] Budget del piano Pro con strumenti documentati
- [ ] Ricetta opzionale per le attività schedulate in cloud (ADR-0006)
- [ ] Progetto campione generato e verificato in CI
- [ ] Versionamento, release e changelog
- [ ] Guida all'adozione e all'aggiornamento

## Adozione (ADR-0010)

1. sitescanner (solo nucleo)
2. communio
3. girasole

## In sospeso

- Autenticazione degli agenti in CI: abbonamento o chiave API (ADR-0012).
