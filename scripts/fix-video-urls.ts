import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixVideoUrls() {
  console.log('🔍 Checking for generated videos...\n');
  
  // Get all patch notes
  const { data: patchNotes, error: fetchError } = await supabase
    .from('patch_notes')
    .select('id, repo_name, video_url, created_at')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Error fetching patch notes:', fetchError);
    return;
  }

  console.log(`Found ${patchNotes.length} patch notes\n`);

  // Check videos directory
  const videosDir = path.join(process.cwd(), 'public', 'videos');
  
  if (!fs.existsSync(videosDir)) {
    console.log('⚠️  No videos directory found');
    return;
  }

  const videoFiles = fs.readdirSync(videosDir);
  console.log(`Found ${videoFiles.length} video files:\n`);

  // Match videos to patch notes
  for (const patchNote of patchNotes) {
    const matchingVideo = videoFiles.find(file => file.includes(patchNote.id));
    
    if (matchingVideo && !patchNote.video_url) {
      const videoUrl = `/videos/${matchingVideo}`;
      console.log(`📝 Updating ${patchNote.repo_name}...`);
      console.log(`   ID: ${patchNote.id}`);
      console.log(`   Video: ${videoUrl}`);
      
      const { error: updateError } = await supabase
        .from('patch_notes')
        .update({ video_url: videoUrl })
        .eq('id', patchNote.id);

      if (updateError) {
        console.error(`   ❌ Update failed:`, updateError);
      } else {
        console.log(`   ✅ Updated successfully!\n`);
      }
    } else if (patchNote.video_url) {
      console.log(`✓ ${patchNote.repo_name} already has video URL\n`);
    } else {
      console.log(`⚠️  ${patchNote.repo_name} - no video found\n`);
    }
  }
}

fixVideoUrls().then(() => {
  console.log('\n✅ Done!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

