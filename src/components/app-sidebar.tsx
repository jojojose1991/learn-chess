import { Link, useNavigate, useRouter } from "@tanstack/react-router"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
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

  async function signOut() {
    await authClient.signOut()
    // Drop the guard's answer, so going back cannot reach a Coach screen.
    await router.invalidate()
    await navigate({ to: "/sign-in" })
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 font-heading text-lg font-medium">
        Learn Chess
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
                    className="data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
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
