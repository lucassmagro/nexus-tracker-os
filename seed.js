
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKSPACE_NAME = 'Loja Exemplo BR';
const DAYS = 30;

async function seed() {
  console.log('🚀 Iniciando seeding para Nexus Tracker OS...');

  // 1. Create or Get Workspace
  let { data: workspaces, error: wsSearchError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('name', WORKSPACE_NAME);

  let workspaceId;

  if (workspaces && workspaces.length > 0) {
    workspaceId = workspaces[0].id;
  } else {
    const { data: newWs, error: wsError } = await supabase
      .from('workspaces')
      .insert({ name: WORKSPACE_NAME })
      .select()
      .single();
    
    if (wsError) throw wsError;
    workspaceId = newWs.id;
  }

  console.log(`✅ Workspace: ${WORKSPACE_NAME} (${workspaceId})`);

  const campaigns = [
    { name: 'Black Friday 2024', source: 'facebook_ads', spendRange: [50, 200] },
    { name: 'Google Search - Branding', source: 'google_ads', spendRange: [30, 100] },
    { name: 'Instagram Bio - Influencers', source: 'instagram', spendRange: [0, 0] },
    { name: 'Youtube Remarketing', source: 'google_ads', spendRange: [20, 80] }
  ];

  const now = new Date();
  
  console.log('📊 Gerando ad_spend...');
  for (let i = 0; i < DAYS; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    for (const campaign of campaigns) {
      if (campaign.spendRange[1] > 0) {
        const spend = Math.floor(Math.random() * (campaign.spendRange[1] - campaign.spendRange[0]) + campaign.spendRange[0]);
        await supabase.from('ad_spend').insert({
          workspace_id: workspaceId,
          campaign_name: campaign.name,
          platform: campaign.source,
          spend_amount: spend,
          currency: 'BRL',
          date: dateStr
        });
      }
    }
  }

  console.log('👤 Gerando page_views e conversões...');
  const visitors = 100; // Reduced for faster execution
  
  for (let v = 0; v < visitors; v++) {
    const fingerprint = `visitor_${v}_${Math.random().toString(36).substr(2, 5)}`;
    const sessionId = `session_${v}`;
    const firstCampaign = campaigns[Math.floor(Math.random() * campaigns.length)];
    const pathType = Math.random();
    
    if (pathType < 0.3) { // 30% convert
      const convertDate = new Date(now);
      convertDate.setDate(convertDate.getDate() - Math.floor(Math.random() * DAYS));
      
      const firstVisitDate = new Date(convertDate);
      firstVisitDate.setHours(firstVisitDate.getHours() - 48);

      await supabase.from('page_views').insert({
        workspace_id: workspaceId,
        anonymous_fingerprint_id: fingerprint,
        session_id: sessionId,
        url: 'https://lojaexemplo.com.br/',
        utm_source: firstCampaign.source,
        utm_campaign: firstCampaign.name,
        utm_medium: 'ads',
        created_at: firstVisitDate.toISOString()
      });

      let lastCampaign = firstCampaign;
      if (Math.random() > 0.4) { // 60% chance of a different last click
        lastCampaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      }

      await supabase.from('page_views').insert({
        workspace_id: workspaceId,
        anonymous_fingerprint_id: fingerprint,
        session_id: sessionId + '_revisit',
        url: 'https://lojaexemplo.com.br/produto-especial',
        utm_source: lastCampaign.source,
        utm_campaign: lastCampaign.name,
        utm_medium: 'retargeting',
        created_at: convertDate.toISOString()
      });

      const value = Math.floor(Math.random() * (1200 - 150) + 150);
      await supabase.from('conversions').insert({
        workspace_id: workspaceId,
        order_id: `NX-${Math.floor(Math.random() * 100000)}`,
        value: value,
        currency: 'BRL',
        anonymous_fingerprint_id: fingerprint,
        status: 'paid',
        created_at: new Date(convertDate.getTime() + 1000 * 60 * 5).toISOString()
      });
    } else {
      await supabase.from('page_views').insert({
        workspace_id: workspaceId,
        anonymous_fingerprint_id: fingerprint,
        session_id: sessionId,
        url: 'https://lojaexemplo.com.br/',
        utm_source: firstCampaign.source,
        utm_campaign: firstCampaign.name,
        created_at: new Date(now.getTime() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * DAYS)).toISOString()
      });
    }
  }

  console.log('✨ Seeding finalizado com sucesso!');
}

seed().catch(err => {
  console.error('❌ Erro no seeding:', err);
  process.exit(1);
});
