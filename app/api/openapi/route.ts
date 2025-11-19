import { NextResponse } from 'next/server';

import { buildUserManagementOpenApiDocument } from '@/lib/openapi/user-management';

export async function GET() {
  const document = buildUserManagementOpenApiDocument();
  return NextResponse.json(document);
}

