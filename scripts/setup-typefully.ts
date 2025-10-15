#!/usr/bin/env tsx
/**
 * Setup script for Typefully integration
 * Run this after applying the database migrations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupTypefully() {
  console.log('🚀 Setting up Typefully integration...\n');

  try {
    // Check if the tables exist
    console.log('📋 Checking database tables...');
    
    const { data: configs, error: configError } = await supabase
      .from('typefully_configs')
      .select('count')
      .limit(1);
    
    if (configError) {
      console.error('❌ typefully_configs table not found.');
      console.log('   Please run the migration: supabase/migrations/20251015_typefully_integration.sql');
      process.exit(1);
    }
    
    const { data: jobs, error: jobError } = await supabase
      .from('typefully_jobs')
      .select('count')
      .limit(1);
    
    if (jobError) {
      console.error('❌ typefully_jobs table not found.');
      console.log('   Please run the migration: supabase/migrations/20251015_typefully_integration.sql');
      process.exit(1);
    }
    
    console.log('✅ Database tables are set up correctly!\n');
    
    // Check for existing configuration
    const { data: existingConfig } = await supabase
      .from('typefully_configs')
      .select('*')
      .single();
    
    if (existingConfig) {
      console.log('ℹ️  Typefully is already configured.');
      console.log('   You can update the configuration at: /integrations/typefully/configure\n');
    } else {
      console.log('📝 Next steps:');
      console.log('   1. Go to https://typefully.com and create an account');
      console.log('   2. Connect your Twitter/X account to Typefully');
      console.log('   3. Generate an API key at: https://typefully.com/settings/api');
      console.log('   4. Configure Typefully in Repatch at: /integrations/typefully/configure\n');
    }
    
    // Check for any existing jobs
    const { data: jobCount } = await supabase
      .from('typefully_jobs')
      .select('*', { count: 'exact', head: true });
    
    if (jobCount && jobCount > 0) {
      console.log(`📊 Found ${jobCount} existing Typefully job(s) in the queue.\n`);
    }
    
    console.log('✅ Typefully integration setup complete!');
    console.log('\n🎉 You can now:');
    console.log('   • Queue Twitter threads from any patch note page');
    console.log('   • Include auto-generated videos in your threads');
    console.log('   • Schedule posts for optimal engagement times');
    console.log('   • Track publishing status and thread URLs\n');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupTypefully();