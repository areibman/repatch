import { NextResponse } from 'next/server';

import { buildUserManagementOpenApiDocument } from '@/lib/openapi/user-management';
import { withApiAuth } from '@/lib/api/with-auth';

export async function GET() {
  return withApiAuth(async () => {
    const document = buildUserManagementOpenApiDocument();
    return NextResponse.json(document);
  });
}

