import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_WORKSPACE_NAME = 'Loja Exemplo BR';

async function linkDemoWorkspace() {
  console.log('🚀 Iniciando vinculação do Workspace de Demo...');

  // 1. Encontrar o ID correto do workspace
  const { data: workspaces, error: wsSearchError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', DEMO_WORKSPACE_NAME)
    .single();

  if (wsSearchError || !workspaces) {
    console.error(`❌ Workspace "${DEMO_WORKSPACE_NAME}" não encontrado. Execute o seed.js primeiro.`);
    process.exit(1);
  }

  const DEMO_WORKSPACE_ID = workspaces.id;
  console.log(`✅ Workspace encontrado: ${DEMO_WORKSPACE_ID}`);

  // Get the most recently created user or the first one from auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

  if (authError || !authData.users || authData.users.length === 0) {
    console.error('❌ Nenhum usuário encontrado no Supabase Auth:', authError);
    process.exit(1);
  }

  const authUser = authData.users[0];
  console.log(`👤 Usuário Auth encontrado: ${authUser.email} (ID: ${authUser.id})`);

  // Check if user exists in public.users
  let { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_uid', authUser.id);

  if (!users || users.length === 0) {
    console.log('Criando registro em public.users...');
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        auth_uid: authUser.id,
        email: authUser.email,
        workspace_id: DEMO_WORKSPACE_ID,
        role: 'owner'
      });
    if (insertError) {
      console.error('❌ Erro ao criar usuário:', insertError);
      process.exit(1);
    }
  } else {
    console.log('Atualizando registro existente em public.users...');
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        workspace_id: DEMO_WORKSPACE_ID,
        role: 'owner' 
      })
      .eq('auth_uid', authUser.id);

    if (updateError) {
      console.error('❌ Erro ao vincular workspace:', updateError);
      process.exit(1);
    }
  }

  console.log(`✅ Sucesso! Usuário vinculado ao Workspace: ${DEMO_WORKSPACE_ID}`);
}

linkDemoWorkspace().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
