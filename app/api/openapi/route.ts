import { NextRequest, NextResponse } from 'next/server';
import { buildUserManagementSpec } from '@/lib/openapi/user-management';

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const spec = buildUserManagementSpec(origin);
  return NextResponse.json(spec);
}
