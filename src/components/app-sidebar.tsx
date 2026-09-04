import { Link, useNavigate, useRouter } from "@tanstack/react-router"

import { authClient } from "@/lib/auth-client"
import { chooseBoardTheme } from "@/lib/board-theme"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/wordmark"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import type { BoardTheme } from "@/db/schema"
import type { Coach } from "@/lib/auth"

const NAV = [
  { to: "/", label: "Library", adminOnly: false },
  { to: "/puzzles/new", label: "New Puzzle", adminOnly: false },
  { to: "/admin", label: "Accounts", adminOnly: true },
] as const

/** The Coach is a prop, not a session read — `_coach` already answered that. */
export function AppSidebar({ coach }: { coach: Coach }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const router = useRouter()
  const navigate = useNavigate()

  // Re-read the guard's answer, so the board repaints and a session that went
  // lands on sign-in.
  async function chooseTheme(theme: BoardTheme) {
    await chooseBoardTheme({ data: theme })
    await router.invalidate()
  }

  async function signOut() {
    await authClient.signOut()
    // Drop the guard's answer, so going back cannot reach a Coach screen.
    await router.invalidate()
    await navigate({ to: "/sign-in" })
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <Wordmark className="text-lg" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {NAV.filter((item) => !item.adminOnly || coach.isAdmin).map(
              (item) => (
                <SidebarMenuItem key={item.to}>
                  {/* `data-status` is the router's own answer to "is this the
                      page we are on", so nothing here recomputes it. */}
                  <SidebarMenuButton
                    className="data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-brand-ink"
                    render={
                      <Link
                        to={item.to}
                        // On a phone the sidebar is a modal drawer, and it
                        // covers the screen it just navigated to.
                        onClick={() => isMobile && setOpenMobile(false)}
                      />
                    }
                  >
                    {item.label}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-4 py-3">
        {/* Here rather than on a settings screen: there are seven screens and
            none of them is settings, and this is the one preference. */}
        <div role="group" aria-label="Board theme" className="flex gap-1 pb-1">
          {(["green", "brown"] as const).map((theme) => (
            <Button
              key={theme}
              variant={coach.boardTheme === theme ? "default" : "outline"}
              size="sm"
              aria-pressed={coach.boardTheme === theme}
              onClick={() => chooseTheme(theme)}
              className="flex-1 capitalize"
            >
              {theme}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Signed in as {coach.email}
        </p>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
        <Link
          to="/credits"
          className="text-xs text-muted-foreground underline"
          onClick={() => isMobile && setOpenMobile(false)}
        >
          Credits
        </Link>
      </SidebarFooter>
    </Sidebar>
  )
}
