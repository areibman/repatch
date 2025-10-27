"use client";

import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";
import { TerminalIcon } from "lucide-react";

export function SidebarHeaderContent() {
  const { state } = useSidebar();

  return (
    <Link href="/" className="flex items-center gap-2 px-2 py-1.5">
      <TerminalIcon />
      {state === "expanded" && <span className="font-semibold">Repatch</span>}
    </Link>
  );
}
