# Cadê o Xis — Estrutura MVP

## Visão Geral
Versão simplificada da plataforma focada em 4 pilares: **resolver questões**, **entender erros**, **treinar novamente** e **ver progresso**.

---

## Área do Aluno — Funcionalidades ATIVAS

| Aba | Descrição |
|-----|-----------|
| **Painel** | Dashboard com estatísticas, tópicos fracos, erros recentes, gráfico de evolução e plano de estudo |
| **Treinar** | Seleção de disciplina/tópico, resolução de questões, correção e registro de tentativas |
| **Caderno de erros** | Questões erradas, revisão futura, histórico de revisões |
| **Aulas** | Biblioteca de aulas organizadas por disciplina e tópico |
| **Histórico** | Lista completa de tentativas com filtros por disciplina e resultado |

## Área do Aluno — Funcionalidades OCULTAS (código mantido)

| Funcionalidade | Arquivo | Motivo |
|----------------|---------|--------|
| Cronômetro (Treino cronometrado) | `TimedTraining.tsx` | Complexidade desnecessária no MVP |
| Trilhas de aprendizado | `LearningTrails.tsx` | Feature avançada |
| Mapa de tópicos | `KnowledgeMap.tsx` | Feature avançada |
| Ranking | `StudentRanking.tsx` | Gamificação — fora do escopo MVP |
| Missões diárias | `DailyMissions.tsx` | Gamificação — fora do escopo MVP |
| Conquistas | `Achievements.tsx` | Gamificação — fora do escopo MVP |
| Trilha de estudo (StudyTrail) | `StudyTrail.tsx` | Gamificação — fora do escopo MVP |

---

## Admin — Funcionalidades ATIVAS

| Painel | Descrição |
|--------|-----------|
| **Painel** | Visão geral de questões, tentativas e usuários |
| **Questões** | CRUD completo de questões |
| **Disciplinas** | Gestão de disciplinas |
| **Aulas** | Gestão de aulas |
| **Tópicos** | Gestão de tópicos |
| **Importar** | Importação em lote de questões |
| **Exportar** | Exportação de dados |
| **Usuários** | Gestão de usuários |
| **Estatísticas** | Estatísticas por tópico |
| **Configurações** | Configurações globais |

## Admin — Funcionalidades OCULTAS (código mantido)

| Funcionalidade | Motivo |
|----------------|--------|
| Pré-requisitos | Feature avançada |
| Ranking | Gamificação |
| Engajamento (Analytics avançado) | Complexidade desnecessária no MVP |
| Comentários | Feature social — fora do escopo MVP |
| Caderno (visão admin) | Não essencial |
| Erros/Denúncias | Feature social — fora do escopo MVP |

---

## Banco de Dados

Nenhuma tabela foi removida. Todas as tabelas permanecem intactas para reativação futura.

## Como Reativar Funcionalidades

1. **Área do aluno**: Descomentar o item em `NAV_ITEMS` no `StudentApp.tsx` e adicionar o render na `<main>`
2. **Dashboard**: Descomentar imports e componentes em `StudentDashboard.tsx`
3. **Admin**: Descomentar o item em `ADMIN_NAV` no `AdminApp.tsx`

---

*Última atualização: 2026-03-14*
