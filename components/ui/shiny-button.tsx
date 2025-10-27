"use client"

import React from "react"
import { motion, type MotionProps } from "motion/react"

import { cn } from "@/lib/utils"

const animationProps: MotionProps = {
  initial: { "--x": "100%", scale: 0.92 },
  animate: { "--x": "-100%", scale: 1 },
  whileTap: { scale: 0.96 },
  transition: {
    repeat: Infinity,
    repeatType: "loop",
    repeatDelay: 1,
    type: "spring",
    stiffness: 24,
    damping: 16,
    mass: 1.8,
    scale: {
      type: "spring",
      stiffness: 210,
      damping: 18,
      mass: 0.8,
    },
  },
}

export interface ShinyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    MotionProps {
  asChild?: false
}

export const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  ({ children, className, disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(
          "relative inline-flex cursor-pointer items-center justify-center rounded-lg border px-6 py-2 text-sm font-semibold tracking-wide transition-shadow duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[radial-gradient(circle_at_50%_0%,var(--primary)/10%_0%,transparent_60%)]",
          className
        )}
        {...animationProps}
        {...props}
        disabled={disabled}
        data-disabled={disabled ? "true" : undefined}
      >
        <span
          className="relative inline-flex w-full items-center justify-center gap-2 text-[rgb(0,0,0,70%)] dark:font-light dark:text-[rgb(255,255,255,92%)]"
          style={{
            maskImage:
              "linear-gradient(-75deg,var(--primary) calc(var(--x) + 20%),transparent calc(var(--x) + 30%),var(--primary) calc(var(--x) + 100%))",
          }}
        >
          {children}
        </span>
        <span
          style={{
            mask: "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
            WebkitMask:
              "linear-gradient(rgb(0,0,0), rgb(0,0,0)) content-box exclude,linear-gradient(rgb(0,0,0), rgb(0,0,0))",
            backgroundImage:
              "linear-gradient(-75deg,var(--primary)/12% calc(var(--x)+20%),var(--primary)/40% calc(var(--x)+25%),var(--primary)/12% calc(var(--x)+100%))",
          }}
          className={cn(
            "absolute inset-0 z-10 block rounded-[inherit] p-px transition-opacity duration-300",
            disabled && "opacity-40"
          )}
        />
      </motion.button>
    )
  }
)

ShinyButton.displayName = "ShinyButton"
