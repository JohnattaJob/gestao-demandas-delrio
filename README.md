# Gestão de Demandas DelRio — integração Supabase (etapa 2)

Aplicação web desktop-first construída com Next.js, React e Supabase.

## O que esta versão implementa

- Login e logout com Supabase Authentication (e-mail e senha).
- Leitura do perfil autenticado na tabela `profiles` e identificação de `admin`, `gestor` ou `colaborador`.
- Leitura das áreas, solicitações e perfis permitidos pelas políticas RLS.
- Dashboard e listagens abastecidos com dados reais do Supabase (não há mais solicitações fictícias).
- Cadastro de solicitações na tabela `requests`.
- Atualização de status e, para gestores/admins, prioridade.
- Exibição de mensagens de erro retornadas pelo Supabase.

## Requisitos

- Node.js 20.9 ou superior.
- Projeto Supabase com o schema desta solução já executado.
- Arquivo `.env.local` na raiz do projeto.

## Configuração local

1. Extraia o ZIP e abra a pasta `gestao-demandas-delrio` no VS Code.
2. Preserve/crie `.env.local` na raiz, junto ao `package.json`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA_PUBLISHABLE_KEY
   ```

3. Instale dependências: `npm install`.
4. Inicie: `npm run dev`.
5. Abra `http://localhost:3000` e entre com o usuário criado em Supabase Authentication.

> Use a chave pública Publishable/anon. Nunca coloque `service_role` ou `secret` em variáveis `NEXT_PUBLIC_*` ou no navegador.

## Perfil administrador

O usuário inicial deve existir em `auth.users` e em `public.profiles`, com `role = 'admin'`. Nesta implantação, o perfil já foi promovido manualmente no SQL Editor. Os novos usuários criados no Supabase Auth recebem perfil `colaborador` automaticamente pelo gatilho definido no schema.

## Observações desta etapa

- O módulo de estoque ainda é uma tela preparatória; CRUD de materiais e movimentações será implementado depois.
- A tela de colaboradores lista os perfis que o usuário autenticado pode consultar pelas políticas RLS. O cadastro administrativo de usuários ainda não está implementado na interface.
- Upload de anexos, recuperação de senha, auditoria completa/histórico automático, filtros avançados e publicação cloud ainda não foram implementados.
- A política RLS é parte essencial da segurança. Teste com contas de cada perfil antes de liberar a aplicação para toda a equipe.

## Módulo de colaboradores (atualização)

O módulo permite ao administrador consultar os perfis ativos, editar nome, área, função (admin/gestor/colaborador) e ativar/desativar o acesso. A edição usa a função SQL `admin_update_profile`, protegida no banco para aceitar chamadas apenas de usuários ativos com perfil `admin`.

### Preparação obrigatória no Supabase

1. Abra **SQL Editor → New query**.
2. Abra `supabase/migration_collaborators.sql`, copie todo o conteúdo e execute uma vez.
3. Na aplicação, entre com o usuário administrador e abra **Colaboradores**.

### Como cadastrar uma nova pessoa

Por segurança, a aplicação não cria contas Auth diretamente no navegador. Para adicionar alguém:

1. No Supabase, abra **Authentication → Users → Add user → Create new user**.
2. Informe o e-mail corporativo e defina uma senha temporária segura; confirme o usuário se essa opção estiver disponível.
3. O gatilho `handle_new_user` cria automaticamente o registro em `public.profiles` com função inicial `colaborador`.
4. Volte à aplicação, abra **Colaboradores → Atualizar lista**, selecione a pessoa e defina nome, área e função.
5. Oriente a pessoa a entrar com o e-mail e a senha fornecidos e alterá-la conforme o procedimento interno da empresa.

A função `admin_update_profile` nunca deve ser exposta com uma chave `service_role` no navegador. O controle de autorização é feito no próprio banco.
