#!/bin/bash
# Generate Stainless MCP Server from OpenAPI Spec

set -e

echo "🚀 Generating Stainless MCP Server..."

# Check if Stainless CLI is installed
if ! command -v stainless &> /dev/null; then
    echo "❌ Stainless CLI not found. Installing..."
    npm install -g stainless-cli
fi

# Check if API key is set
if [ -z "$STAINLESS_API_KEY" ]; then
    echo "⚠️  STAINLESS_API_KEY not set in environment"
    echo "   Please set it: export STAINLESS_API_KEY='your-key'"
    exit 1
fi

echo "✅ Stainless CLI found"

# Validate OpenAPI spec
echo ""
echo "📋 Validating OpenAPI specification..."
stainless validate openapi.yaml

echo ""
echo "✅ OpenAPI spec is valid"

# Generate TypeScript SDK
echo ""
echo "🔧 Generating TypeScript SDK..."
rm -rf ./sdk
stainless generate \
  --openapi openapi.yaml \
  --output ./sdk \
  --language typescript \
  --package-name @repatch/sdk

echo "✅ SDK generated at ./sdk"

# Generate MCP Server
echo ""
echo "🌐 Generating MCP Server..."
rm -rf ./mcp-server
stainless mcp generate \
  --openapi openapi.yaml \
  --output ./mcp-server \
  --server-name repatch

echo "✅ MCP server generated at ./mcp-server"

# Install dependencies
echo ""
echo "📦 Installing MCP server dependencies..."
cd mcp-server
npm install
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. cd mcp-server && npm run dev    # Start MCP server"
echo "  2. Open http://localhost:3001      # Test endpoints"
echo "  3. stainless mcp inspect           # Use MCP inspector"
echo ""
echo "See docs/STAINLESS_INTEGRATION.md for full guide"
