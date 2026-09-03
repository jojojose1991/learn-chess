import { CheckerMark } from "@/components/checker-mark"
import { cn } from "@/lib/utils"

/**
 * The favicon's checkerboard beside the product name, sized in `em` so the mark
 * tracks the caller's font-size.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.45em] font-heading font-bold tracking-tight",
        className
      )}
    >
      <CheckerMark className="size-[1.05em] text-brand" />
      Learn Chess
    </span>
  )
}
