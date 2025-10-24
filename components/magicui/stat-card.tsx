import * as React from "react"

import { cn } from "@/lib/utils"
import { MagicCard, type MagicCardAccent } from "@/components/magicui/magic-card"

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  accent?: MagicCardAccent
  icon?: React.ReactNode
  helperText?: React.ReactNode
  delta?: React.ReactNode
  deltaTone?: "positive" | "neutral" | "negative"
}

const deltaToneStyles: Record<NonNullable<StatCardProps["deltaTone"]>, string> = {
  positive: "text-emerald-500",
  neutral: "text-muted-foreground",
  negative: "text-rose-500",
}

export function StatCard({
  label,
  value,
  accent = "slate",
  icon,
  helperText,
  delta,
  deltaTone = "positive",
  className,
  ...props
}: StatCardProps) {
  return (
    <MagicCard accent={accent} className={className} contentClassName="p-6" {...props}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground/80">{label}</p>
          <div className="text-3xl font-semibold leading-tight tracking-tight">{value}</div>
          {helperText ? (
            <div className="text-sm text-muted-foreground/90">{helperText}</div>
          ) : null}
        </div>
        {icon ? (
          <div className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-background/60 text-foreground/80 shadow-[0_10px_35px_-20px_rgba(15,23,42,0.6)]">
            {icon}
          </div>
        ) : null}
      </div>
      {delta ? (
        <div className={cn("mt-4 text-xs font-medium", deltaToneStyles[deltaTone])}>{delta}</div>
      ) : null}
    </MagicCard>
  )
}
