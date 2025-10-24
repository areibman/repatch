import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ShinyVariant = "primary" | "soft" | "outline" | "ghost"

const variantStyles: Record<ShinyVariant, string> = {
  primary:
    "border border-transparent bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 text-white shadow-[0_18px_45px_-25px_rgba(59,130,246,0.75)] hover:shadow-[0_25px_55px_-25px_rgba(124,58,237,0.65)]",
  soft:
    "border border-primary/30 bg-primary/10 text-primary shadow-[0_15px_35px_-25px_rgba(56,189,248,0.45)] hover:bg-primary/15",
  outline:
    "border border-border bg-background/40 text-foreground shadow-[0_12px_28px_-24px_rgba(15,23,42,0.65)] hover:bg-background/55",
  ghost:
    "border border-transparent bg-transparent text-foreground/80 hover:bg-foreground/10",
}

export interface ShinyButtonProps extends ButtonProps {
  shimmer?: boolean
  shineVariant?: ShinyVariant
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  (
    {
      shimmer = true,
      shineVariant = "primary",
      className,
      children,
      variant,
      ...props
    },
    ref
  ) => {
    const mappedVariant = variant ?? (shineVariant === "primary" ? "default" : "outline")

    return (
      <Button
        ref={ref}
        variant={mappedVariant}
        className={cn(
          "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full px-6 py-2.5 text-sm font-semibold tracking-tight transition-all duration-300 focus-visible:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2",
          "hover:-translate-y-0.5",
          variantStyles[shineVariant],
          className
        )}
        {...props}
      >
        {shimmer ? (
          <span aria-hidden className="pointer-events-none absolute inset-0">
            <span className="absolute inset-y-0 left-[-80%] h-full w-[160%] origin-left -skew-x-12 rounded-[inherit] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.55),transparent)] opacity-0 transition duration-500 ease-out group-hover:left-[75%] group-hover:opacity-80" />
          </span>
        ) : null}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </Button>
    )
  }
)

ShinyButton.displayName = "ShinyButton"
