import { NextResponse } from "next/server";

import { withApiAuth } from "@/lib/api/with-auth";
import { TOOL_DEFINITIONS } from "./definitions";

export async function GET() {
  return withApiAuth(async () => {
    return NextResponse.json({
      tools: TOOL_DEFINITIONS,
    });
  });
}


