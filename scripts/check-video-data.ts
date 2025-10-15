import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVideoData() {
  console.log('🔍 Checking video_data in recent patch notes...\n');
  
  const { data, error } = await supabase
    .from('patch_notes')
    .select('id, repo_name, video_data, ai_summaries, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  for (const note of data) {
    console.log(`\n📝 ${note.repo_name} (${note.id.substring(0, 8)}...)`);
    console.log(`   Created: ${new Date(note.created_at).toLocaleString()}`);
    
    if (note.video_data) {
      const vd = note.video_data as any;
      console.log(`   ✅ Has video_data:`);
      console.log(`      - Top changes: ${vd.topChanges?.length || 0}`);
      console.log(`      - All changes: ${vd.allChanges?.length || 0}`);
      
      if (vd.topChanges && vd.topChanges[0]) {
        console.log(`      - First change title: "${vd.topChanges[0].title?.substring(0, 60)}"`);
        console.log(`      - First change desc: "${vd.topChanges[0].description?.substring(0, 80)}..."`);
      }
    } else {
      console.log(`   ⚠️  No video_data`);
    }
    
    if (note.ai_summaries && Array.isArray(note.ai_summaries)) {
      console.log(`   ✅ Has ${note.ai_summaries.length} AI summaries`);
      if (note.ai_summaries[0]) {
        const first = note.ai_summaries[0] as any;
        console.log(`      - First AI summary: "${first.aiSummary?.substring(0, 80)}..."`);
      }
    } else {
      console.log(`   ⚠️  No AI summaries`);
    }
  }
}

checkVideoData().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

