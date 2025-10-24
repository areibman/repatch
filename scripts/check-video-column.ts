import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumn() {
  console.log('🔍 Checking if video_url column exists...\n');
  
  // Try to query the column
  const { data, error } = await supabase
    .from('patch_notes')
    .select('id, video_url')
    .limit(1);

  if (error) {
    console.error('❌ Error querying video_url column:', error);
    console.error('\n🚨 The video_url column probably does NOT exist!');
    console.error('\n📝 Run this SQL in Supabase Dashboard:');
    console.error('   ALTER TABLE patch_notes ADD COLUMN video_url TEXT DEFAULT NULL;\n');
    return;
  }

  console.log('✅ video_url column exists!');
  console.log('Sample data:', data);
  
  // Check if we can update
  console.log('\n🔍 Testing update permissions...\n');
  
  if (data && data.length > 0) {
    const testId = data[0].id;
    const testUrl = 'https://example.com/videos/test.mp4';
    
    const { data: updateData, error: updateError } = await supabase
      .from('patch_notes')
      .update({ video_url: testUrl })
      .eq('id', testId)
      .select();

    if (updateError) {
      console.error('❌ Cannot update video_url:', updateError);
      console.error('\n🚨 There might be a permissions issue!');
    } else {
      console.log('✅ Successfully updated video_url!');
      console.log('Updated data:', updateData);
      
      // Revert the test
      await supabase
        .from('patch_notes')
        .update({ video_url: data[0].video_url })
        .eq('id', testId);
      console.log('✅ Test reverted\n');
    }
  }
}

checkColumn().then(() => {
  console.log('✅ Check complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

