import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEMO_WORKSPACE_NAME = 'Loja Exemplo BR';

async function checkData() {
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('name', DEMO_WORKSPACE_NAME)
    .single();

  if (!ws) {
    console.log('Workspace not found');
    return;
  }

  const workspaceId = ws.id;
  console.log(`Workspace ID: ${workspaceId}`);

  const { count: spendCount } = await supabase
    .from('ad_spend')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  const { count: pvCount } = await supabase
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  const { count: convCount } = await supabase
    .from('conversions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  console.log(`Ad Spend: ${spendCount}`);
  console.log(`Page Views: ${pvCount}`);
  console.log(`Conversions: ${convCount}`);
}

checkData();
