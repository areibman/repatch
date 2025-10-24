"use client"

import React, { useCallback, useEffect } from "react"
import { motion, useMotionTemplate, useMotionValue } from "motion/react"

import { cn } from "@/lib/utils"

export interface MagicCardProps extends React.HTMLAttributes<HTMLDivElement> {
  gradientSize?: number
  gradientColor?: string
  gradientOpacity?: number
  gradientFrom?: string
  gradientTo?: string
}

export function MagicCard({
  children,
  className,
  gradientSize = 240,
  gradientColor = "#262626",
  gradientOpacity = 0.8,
  gradientFrom = "#9E7AFF",
  gradientTo = "#FE8BBB",
  ...props
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize)
  const mouseY = useMotionValue(-gradientSize)

  const reset = useCallback(() => {
    mouseX.set(-gradientSize)
    mouseY.set(-gradientSize)
  }, [gradientSize, mouseX, mouseY])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      mouseX.set(event.clientX - rect.left)
      mouseY.set(event.clientY - rect.top)
    },
    [mouseX, mouseY]
  )

  useEffect(() => {
    reset()
  }, [reset])

  useEffect(() => {
    const handleGlobalPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        reset()
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        reset()
      }
    }

    window.addEventListener("pointerout", handleGlobalPointerOut)
    window.addEventListener("blur", reset)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.removeEventListener("pointerout", handleGlobalPointerOut)
      window.removeEventListener("blur", reset)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [reset])

  return (
    <div
      className={cn("group relative rounded-[inherit]", className)}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      onPointerEnter={reset}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
              ${gradientFrom},
              ${gradientTo},
              var(--border) 100%
            )
          `,
        }}
      />
      <div className="absolute inset-px rounded-[inherit] bg-background" />
      <motion.div
        className="pointer-events-none absolute inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px, ${gradientColor}, transparent 100%)
          `,
          opacity: gradientOpacity,
        }}
      />
      <div className="relative h-full w-full">{children}</div>
    </div>
  )
}
