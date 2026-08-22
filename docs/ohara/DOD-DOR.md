# Ohara — Definition of Ready (DoR) & Definition of Done (DoD)

Acordos de qualidade. **Uma tarefa não começa sem cumprir o DoR; não fecha sem cumprir o DoD.**
Referenciado no `CLAUDE.md`.

## Definition of Ready (DoR) — pode COMEÇAR quando:

- [ ] Objetivo claro (**o quê + por quê**), ligado ao `00-brief.md` ou a um ADR.
- [ ] Escopo **público × local** definido — acervo/copyright **nunca** no público.
- [ ] Dados/fontes necessários identificados, com **procedência** (`citada` / `curada` / `inferida`).
- [ ] **Critérios de aceite** escritos (como saberemos que ficou pronto).
- [ ] Dependências conhecidas (app, Ollama, service, dados…).
- [ ] Cabe numa branch curta `feat/ohara-*`; se não, **quebrar** em tarefas menores.

## Definition of Done (DoD) — está PRONTA quando:

- [ ] `typecheck` + `lint` + **testes (Vitest)** verdes.
- [ ] **SAST** sem finding crítico novo — **CodeQL** no CI já; **Checkmarx** quando houver acesso.
- [ ] `yarn build` passa e o app/rota sobe.
- [ ] **Docs atualizados**: WORKLOG + ADR (se arquitetural) + brief/README (se mudou contrato/API).
- [ ] Sem segredo commitado; sem `--amend` em commit já pushado.
- [ ] Entregue via **PR na branch** → `main` sempre deployável.

## Notas

- **Precisão > velocidade** neste projeto — o DoR/DoD são o mecanismo, não burocracia.
- Estudo: cada tarefa fechada deve deixar o "porquê" documentado (aprender fazendo).
