# Nexus Tracker OS

Bem-vindo ao **Nexus Tracker OS**, uma solução completa de rastreamento de atribuição, monitoramento de tráfego em tempo real e análise de conversões para e-commerces.

## 🚀 Principais Funcionalidades

- **Multi-tenancy (Workspaces):** Gerencie múltiplas empresas (lojas) sob a mesma conta, com total isolamento de dados.
- **RBAC (Role-Based Access Control):** Hierarquia de acesso robusta com perfis de `super_admin` (visão global e irrestrita), `owner` (dono da loja) e `viewer` (apenas leitura).
- **Tráfego em Tempo Real:** Acompanhamento ao vivo de *Page Views* e *Conversões* com WebSockets (Supabase Realtime).
- **Integração Shopify via Webhooks:** Rastreamento autônomo de pedidos e receita, com geração dinâmica de chaves de segurança (HMAC).

## 🛠️ Tecnologias Utilizadas

- **Frontend / Backend:** [Next.js](https://nextjs.org/) (App Router, Server Actions)
- **Banco de Dados & Autenticação:** [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Filas & Cache (Opcional):** Redis / BullMQ

## 📦 Como rodar localmente

1. Clone o repositório.
2. Crie seu arquivo `.env.local` baseado no `.env.example`.
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## 🗄️ Executando Migrations no Supabase

O projeto utiliza o Supabase para a estrutura de dados. É essencial rodar as migrations na ordem correta para configurar as tabelas, funções e políticas de segurança (RLS).

No painel SQL Editor do Supabase, execute as migrations localizadas na pasta `supabase/migrations/` em ordem:

1. **`00001_initial_schema.sql`**: Cria o esquema básico (`users`, `workspaces`, `page_views`, `conversions`, `ad_spend`).
2. **`00002_attribution_engine.sql`**: Instala a função `fn_attribution_report` responsável pelos cálculos de ROAS.
3. **`00003_add_super_admin.sql`**: Adiciona o ENUM `user_role` e atualiza as RLS para permitir acesso total aos super administradores.
4. **`00004_fix_workspace_rls.sql`**: Ajusta permissões vitais de `INSERT` e `SELECT` no momento da criação de contas (Onboarding).

Para deploy em produção, consulte o guia [DEPLOY.md](./DEPLOY.md).
