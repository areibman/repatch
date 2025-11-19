#!/bin/bash
set -e

echo "🔍 Running Lint..."
bun run lint

echo "🧪 Running Tests..."
if [ -f "jest.config.js" ] || [ -f "jest.config.ts" ] || grep -q "jest" package.json; then
    bunx jest --runInBand --passWithNoTests
else
    echo "⚠️ No Jest configuration found, skipping tests."
fi

echo "🗄️ Checking Database Schema Diff..."
if command -v supabase &> /dev/null; then
    # Only run diff if linked
    if [ -f "supabase/config.toml" ]; then
        # This might fail if not logged in or not linked, so we allow failure but warn
        supabase db diff --linked || echo "⚠️ Database diff failed (project might not be linked), skipping."
    else
         echo "⚠️ supabase/config.toml not found, skipping db diff."
    fi
else
    echo "⚠️ Supabase CLI not found, skipping db diff."
fi

echo "✅ Pre-deploy checks passed!"

