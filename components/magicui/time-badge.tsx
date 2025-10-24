import * as React from "react"

import { cn } from "@/lib/utils"
import type { MagicCardAccent } from "@/components/magicui/magic-card"

const badgeBackgrounds: Record<MagicCardAccent, string> = {
  sky: "bg-sky-500/10 text-sky-200 border-sky-400/30",
  emerald: "bg-emerald-500/10 text-emerald-200 border-emerald-400/30",
  violet: "bg-violet-500/10 text-violet-200 border-violet-400/25",
  amber: "bg-amber-500/10 text-amber-100 border-amber-400/30",
  rose: "bg-rose-500/10 text-rose-200 border-rose-400/25",
  slate: "bg-slate-500/10 text-slate-200 border-slate-400/25",
}

export interface TimeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  accent?: MagicCardAccent
  icon?: React.ReactNode
}

export function TimeBadge({ accent = "slate", icon, className, children, ...props }: TimeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] transition-colors",
        badgeBackgrounds[accent],
        className
      )}
      {...props}
    >
      {icon ? <span className="inline-flex items-center text-[0.65rem]">{icon}</span> : null}
      <span className="tracking-[0.24em]">{children}</span>
    </span>
  )
}
