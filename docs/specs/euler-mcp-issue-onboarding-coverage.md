# feat(catalog): enumeração de flows + progresso por parceiro no lado customer (destrava a skill `onboarding-coverage`)

> Issue proposta para o repositório **euler-mcp**. Identificadores técnicos (tools, campos,
> scopes) mantidos em inglês; prose em PT-BR. Quando implementado, as descriptions/docs
> públicas continuam em inglês (regra do euler-mcp + UI English-only).

## Contexto

O lado partner já tem visibilidade rica de onboarding (adicionado em 2026-05/06):

- `partner_flow_details` (`scope: partner`) — chamada sem drill-down lista os flows atribuídos ao parceiro.
- `partner_flow_progress` (`scope: partner`) — por flow: `percent_complete`, contagem de steps (done/failed/to_do/overdue), datas de vencimento, badge.

Já entregamos a skill partner-facing **`my-onboarding`** em cima dessas tools (EULER-skills PR #6).

O lado **customer-admin** não tem equivalente. A única leitura de flow no customer é `flow_details`
(`scope: customer`), cujos intents são `name` / `flow_id` / `flow_step_id` — e `flow_id` retorna
os assignments (roster + *modo* de conclusão), **não** a conclusão por parceiro.

## O gap (faltam 2 leituras no lado customer)

Um partner manager não consegue responder nenhuma das duas:

1. **"Quais flows de onboarding/certificação minha empresa tem?"** — `flow_details` **não tem
   intent de listagem** (você precisa já saber o nome ou o id de um flow). Não há como enumerar os flows.
2. **"Quais parceiros estão travados / quão longe cada um está no flow X?"** — a conclusão por
   parceiro (`percent_complete`, overdue) é **exclusiva do escopo partner**; o customer não tem nada disso.

As duas bloqueiam uma skill customer-side **`onboarding-coverage`** (gaps de atribuição + progresso).

## Tools propostas (ambas READ, `scope: customer`)

### 1. Listar todos os flows — novo intent sem drill-down no `flow_details` (espelha `partner_flow_details`)

`flow_details` **sem nenhum param de drill-down** → lista todos os flows da empresa
(`flow_id`, `flow_title`, `flow_type`, `total_steps`, `flow_status`, contagem de atribuídos).
Espelha o comportamento que `partner_flow_details` já tem sem param — mudança pequena e
consistente, provavelmente reaproveita a mesma busca no Bubble.

### 2. Progresso por flow (customer) — novo `flow_progress` (espelha `partner_flow_progress`)

```
flow_progress(flow_id)            # scope: customer, readOnlyHint: true
  → rollup por parceiro atribuído: [{ partner_name, percent_complete,
      done_count, total_steps, overdue_count, flow_due_date, status }]
  → mais totais do flow (atribuídos, concluídos, em andamento, não iniciados, overdue)
```

`partner_flow_progress` já calcula isso para um parceiro — esta é a agregação no escopo da
empresa sobre os assignments do flow.

## Privacidade / escopo

- Ambas `scope: customer`; filtram pelo `company_id` injetado (cross-tenant safe conforme o checklist padrão).
- Identidade vem das props do token, nunca dos args. Read-only — `readOnlyHint: true`, sem superfície destrutiva.
- Rodar o checklist de privacidade (4 pontos) antes de `enabled: true`.

## Critérios de aceite

- [ ] `flow_details` sem drill-down retorna a lista de flows da empresa (role customer)
- [ ] `flow_progress(flow_id)` retorna conclusão por parceiro + totais do flow
- [ ] Testes do catálogo + `MIN_EXPECTED_TOOLS` atualizados; `docs/api-mapping/*` atualizados
- [ ] Acoplamento EULER-skills: destrava a skill `onboarding-coverage` (ver `my-onboarding` como o irmão partner-side)

## Por que agora

A `my-onboarding` (partner) acabou de entrar; esta é a contraparte customer-admin. Com essas duas,
"quais parceiros estão travados no onboarding" vira uma skill de um prompt só — a visão de onboarding
mais forte do lado customer, hoje impossível.
