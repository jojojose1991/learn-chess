import { cn } from "@/lib/utils"

/**
 * The favicon's checkerboard beside the product name, sized in `em` so the mark
 * tracks the caller's font-size.
 *
 * The light squares are left transparent rather than painted `#edeed1`: the
 * mark then sits on the page or the sidebar's own tint instead of carrying a
 * pale rectangle across both.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.45em] font-heading font-bold tracking-tight",
        className
      )}
    >
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="size-[1.05em] shrink-0 text-brand"
      >
        <path
          fill="currentColor"
          d="M0 0h8v8H0zM16 0h8v8h-8zM8 8h8v8H8zM24 8h8v8h-8zM0 16h8v8H0zM16 16h8v8h-8zM8 24h8v8H8zM24 24h8v8h-8z"
        />
      </svg>
      Learn Chess
    </span>
  )
}
