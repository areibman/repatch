import { NextResponse } from "next/server";
import { listTypefullyConfigs } from "@/lib/typefully";

export async function GET() {
  const configs = await listTypefullyConfigs();
  return NextResponse.json(configs);
}
