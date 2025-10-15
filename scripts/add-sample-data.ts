/**
 * Script to add sample patch notes data to Supabase
 * Run with: npx tsx scripts/add-sample-data.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Make sure .env.local is configured correctly');
  process.exit(1);
}

import { samplePatchNotes } from "@/lib/__fixtures__/sample-data";

const sampleData = samplePatchNotes.map(({ id, video_data, video_url, ai_overall_summary, ai_summaries, created_at, updated_at, ...rest }) => ({
  ...rest,
}));

async function addSampleData() {
  console.log('Adding sample data to Supabase...\n');

  for (const data of sampleData) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/patch_notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY!}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Failed to add: ${data.title}`);
        console.error(`   Error: ${error}\n`);
      } else {
        const result = await response.json();
        console.log(`✅ Added: ${data.title}`);
        console.log(`   ID: ${result[0]?.id}\n`);
      }
    } catch (error) {
      console.error(`❌ Error adding ${data.title}:`, error, '\n');
    }
  }

  console.log('Done!');
}

addSampleData();

