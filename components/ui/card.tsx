"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { MagicCard } from "@/components/ui/magic-card"

interface CardProps extends React.ComponentProps<"div"> {
  magic?: boolean
  containerClassName?: string
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({
    className,
    magic = true,
    containerClassName,
    ...props
  }, ref) => {
    const baseClasses = cn(
      "bg-card/90 text-card-foreground relative flex flex-col gap-6 rounded-[calc(var(--radius-lg))] border border-border/50 py-6 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.4)] backdrop-blur-sm transition-[transform,box-shadow] duration-300",
      "group-hover/magic-card:translate-y-[-2px] group-hover/magic-card:shadow-[0_25px_50px_-30px_rgba(15,23,42,0.55)]",
      className
    )

    if (!magic) {
      return (
        <div
          ref={ref}
          data-slot="card"
          className={cn(
            "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
            className
          )}
          {...props}
        />
      )
    }

    return (
      <MagicCard
        className={cn(
          "group/magic-card rounded-[calc(var(--radius-lg)+8px)] border border-border/40 bg-border/10 p-[1px]",
          containerClassName
        )}
      >
        <div ref={ref} data-slot="card" className={baseClasses} {...props} />
      </MagicCard>
    )
  }
)
Card.displayName = "Card"

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
