import * as React from "react"

import { cn } from "@/lib/utils"

const glowBackgrounds = {
  sky: "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.45),transparent_65%)]",
  emerald: "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.45),transparent_65%)]",
  violet: "bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.5),transparent_65%)]",
  amber: "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.5),transparent_65%)]",
  rose: "bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.45),transparent_65%)]",
  slate: "bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.4),transparent_65%)]",
} as const

const accentSheen = {
  sky: "before:bg-gradient-to-br before:from-sky-500/30 before:via-indigo-500/20 before:to-purple-500/25",
  emerald: "before:bg-gradient-to-br before:from-emerald-500/30 before:via-teal-400/20 before:to-emerald-500/25",
  violet: "before:bg-gradient-to-br before:from-violet-500/30 before:via-indigo-400/20 before:to-purple-500/25",
  amber: "before:bg-gradient-to-br before:from-amber-400/40 before:via-orange-500/20 before:to-yellow-400/25",
  rose: "before:bg-gradient-to-br before:from-rose-500/35 before:via-pink-400/20 before:to-rose-500/30",
  slate: "before:bg-gradient-to-br before:from-slate-400/30 before:via-slate-500/20 before:to-zinc-400/20",
} as const

export type MagicCardAccent = keyof typeof glowBackgrounds

export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: MagicCardAccent
  contentClassName?: string
}

export const MagicCard = React.forwardRef<HTMLDivElement, MagicCardProps>(
  (
    {
      accent = "slate",
      className,
      contentClassName,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "group relative isolate transition-transform duration-300 ease-out will-change-transform hover:-translate-y-1",
          className
        )}
        {...props}
      >
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 -z-20 rounded-[26px] opacity-70 blur-3xl transition-opacity duration-500 group-hover:opacity-95",
            glowBackgrounds[accent]
          )}
        />
        <div className="absolute inset-0 -z-10 rounded-[24px] border border-white/10 bg-gradient-to-br from-background/65 via-background/50 to-background/60 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.75)] transition-shadow duration-500 group-hover:shadow-[0_30px_65px_-30px_rgba(59,130,246,0.55)]" />
        <div
          className={cn(
            "relative rounded-[22px] border border-border/60 bg-background/80 p-6 text-foreground backdrop-blur-xl",
            "before:absolute before:inset-0 before:-z-10 before:rounded-[22px] before:opacity-0 before:transition-opacity before:duration-500 before:content-[''] group-hover:before:opacity-100",
            accentSheen[accent],
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    )
  }
)

MagicCard.displayName = "MagicCard"
