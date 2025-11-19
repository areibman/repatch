#!/usr/bin/env bun

/**
 * Test script for API v1 endpoints
 * Run with: bun run scripts/test-api-v1.ts
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

/**
 * Test helper
 */
async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      name,
      success: true,
      duration: Date.now() - start,
    });
    console.log(`✅ ${name} (${Date.now() - start}ms)`);
  } catch (error) {
    results.push({
      name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
    console.error(`❌ ${name}: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Test GitHub Metadata endpoint
 */
async function testGitHubMetadata() {
  await test('GitHub Metadata - All types', async () => {
    const response = await fetch(
      `${BASE_URL}/github/metadata?owner=facebook&repo=react`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.branches || !data.labels || !data.releases || !data.tags) {
      throw new Error('Missing expected metadata fields');
    }
    
    console.log(`   Branches: ${data.branches.length}`);
    console.log(`   Labels: ${data.labels.length}`);
    console.log(`   Releases: ${data.releases.length}`);
    console.log(`   Tags: ${data.tags.length}`);
  });

  await test('GitHub Metadata - Specific types', async () => {
    const response = await fetch(
      `${BASE_URL}/github/metadata?owner=facebook&repo=react&include=branches,releases`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.branches || !data.releases) {
      throw new Error('Missing expected metadata fields');
    }
    
    if (data.labels || data.tags) {
      throw new Error('Unexpected metadata fields present');
    }
  });

  await test('GitHub Metadata - Invalid params', async () => {
    const response = await fetch(
      `${BASE_URL}/github/metadata?owner=facebook`
    );
    
    if (response.status !== 400) {
      throw new Error(`Expected 400, got ${response.status}`);
    }
  });
}

/**
 * Test Jobs endpoints
 */
async function testJobs() {
  let jobId: string;

  await test('Create Job', async () => {
    const response = await fetch(`${BASE_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'generate-video-top-changes',
        params: {
          content: `# My Release\n\n## New Features\n- Added feature A\n- Added feature B\n\n## Bug Fixes\n- Fixed bug X\n- Fixed bug Y`,
          repoName: 'test-repo',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const job = await response.json();
    
    if (!job.id || !job.type || !job.status) {
      throw new Error('Invalid job response');
    }

    jobId = job.id;
    console.log(`   Job ID: ${jobId}`);
    console.log(`   Status: ${job.status}`);
  });

  await test('Get Job Status', async () => {
    // Wait a bit for job to process
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`${BASE_URL}/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const job = await response.json();
    
    console.log(`   Status: ${job.status}`);
    console.log(`   Progress: ${job.progress}%`);
    
    if (job.status === 'completed') {
      console.log(`   Result:`, job.result);
    }
  });

  await test('List Jobs', async () => {
    const response = await fetch(`${BASE_URL}/jobs`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const jobs = await response.json();
    
    if (!Array.isArray(jobs)) {
      throw new Error('Expected array of jobs');
    }

    console.log(`   Total jobs: ${jobs.length}`);
  });

  await test('List Jobs - Filter by type', async () => {
    const response = await fetch(`${BASE_URL}/jobs?type=generate-video-top-changes`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const jobs = await response.json();
    
    if (!Array.isArray(jobs)) {
      throw new Error('Expected array of jobs');
    }

    console.log(`   Filtered jobs: ${jobs.length}`);
  });

  await test('Get Nonexistent Job', async () => {
    const response = await fetch(`${BASE_URL}/jobs/nonexistent-job-id`);

    if (response.status !== 404) {
      throw new Error(`Expected 404, got ${response.status}`);
    }
  });

  // Note: We don't test job cancellation because our test job completes too quickly
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🧪 Testing Repatch API v1\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  console.log('=== GitHub Metadata Tests ===\n');
  await testGitHubMetadata();

  console.log('\n=== Jobs Tests ===\n');
  await testJobs();

  // Print summary
  console.log('\n=== Test Summary ===\n');
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log(`Total: ${total}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  // Exit with error code if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
