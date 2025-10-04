"use client";

import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

export function SidebarHeaderContent() {
  const { state } = useSidebar();

  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
      <img src="/globe.svg" alt="Repatch" width={18} height={18} />
      {state === "expanded" && <span className="font-semibold">Repatch</span>}
    </Link>
  );
}
