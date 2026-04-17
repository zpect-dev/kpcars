import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/85 active:scale-[0.98]",
        destructive:
          "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15 active:scale-[0.98] dark:bg-destructive/20 dark:hover:bg-destructive/30",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-accent hover:border-border/80 active:scale-[0.98]",
        secondary:
          "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground active:scale-[0.98]",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98]",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8 px-3 text-xs has-[>svg]:px-2.5",
        lg:      "h-10 px-5 has-[>svg]:px-4",
        icon:    "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
