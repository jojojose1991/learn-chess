import { cn } from "@/lib/utils"

/**
 * The favicon's checkerboard, light squares left transparent so it sits on
 * whatever surface it lands on. Decorative, so always `aria-hidden`; the caller
 * sizes and colours it.
 */
export function CheckerMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-[1em] shrink-0", className)}
    >
      <path
        fill="currentColor"
        d="M0 0h8v8H0zM16 0h8v8h-8zM8 8h8v8H8zM24 8h8v8h-8zM0 16h8v8H0zM16 16h8v8h-8zM8 24h8v8H8zM24 24h8v8h-8z"
      />
    </svg>
  )
}
