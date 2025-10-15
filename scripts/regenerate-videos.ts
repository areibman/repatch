import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const supabase = createClient(supabaseUrl, supabaseKey);

async function regenerateVideos() {
  console.log('🎬 Regenerating videos with AI summaries...\n');
  
  // Get all patch notes that have AI summaries but whose videos might use old data
  const { data: patchNotes, error: fetchError } = await supabase
    .from('patch_notes')
    .select('id, repo_name, ai_summaries, video_url')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching patch notes:', fetchError);
    return;
  }

  console.log(`Found ${patchNotes.length} patch notes\n`);

  for (const note of patchNotes) {
    if (!note.ai_summaries || !Array.isArray(note.ai_summaries) || note.ai_summaries.length === 0) {
      console.log(`⏭️  Skipping ${note.repo_name} - no AI summaries`);
      continue;
    }

    console.log(`\n🎬 Regenerating video for: ${note.repo_name}`);
    console.log(`   ID: ${note.id}`);
    console.log(`   AI Summaries: ${note.ai_summaries.length}`);
    
    try {
      const response = await fetch(`${appUrl}/api/videos/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patchNoteId: note.id,
          videoData: null, // Will be generated from AI summaries
          repoName: note.repo_name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`   ❌ Failed:`, error.error);
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Success! Video URL: ${result.videoUrl}`);
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
    
    // Wait a bit between renders to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

regenerateVideos().then(() => {
  console.log('\n✅ Done regenerating videos!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

