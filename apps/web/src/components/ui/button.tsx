import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1.25rem] border-[2px] text-sm font-semibold tracking-[-0.01em] ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "border-border bg-primary text-primary-foreground shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:bg-primary/95 hover:shadow-[var(--shadow-lg)]",
        destructive:
          "border-border bg-destructive text-destructive-foreground shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:bg-destructive/92 hover:shadow-[var(--shadow-lg)]",
        outline:
          "border-border bg-card text-foreground shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-white hover:shadow-[var(--shadow-md)]",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-[var(--shadow-sm)] hover:-translate-y-0.5 hover:bg-secondary/90 hover:shadow-[var(--shadow-md)]",
        ghost: "border-transparent bg-transparent text-muted-foreground shadow-none hover:border-border/25 hover:bg-secondary/35 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-[1rem] px-3.5 text-xs",
        lg: "h-13 px-6 text-base md:h-14 md:px-7",
        icon: "size-11 rounded-[1rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
