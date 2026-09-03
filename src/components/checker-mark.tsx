import mark from "@/assets/checker-mark.svg?raw"
import { cn } from "@/lib/utils"

/**
 * The checkerboard from `src/assets/checker-mark.svg`, inlined rather than an
 * `<img>` so `currentColor` resolves — the two callers want the brand green at
 * two strengths. Decorative, so `aria-hidden`. `public/favicon.svg` draws the
 * same shape from its own copy, because `public/` cannot import from `src/`.
 */
export function CheckerMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-[1em] shrink-0 [&>svg]:size-full",
        className
      )}
      dangerouslySetInnerHTML={{ __html: mark }}
    />
  )
}
