import { Home } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useActiveModule } from "@/hooks/useActiveModule";
import { BrandLogo } from "@/components/BrandLogo";

/*
 * The rail.
 *
 * Two things moved out of here and into the header: All Modules (the launcher
 * there opens the same picker AND names the module you are in, so the rail's
 * copy was a second button for one job, and the one that said less) and
 * Settings (one page belonging to no module, holding a permanent slot at the
 * bottom edge that the modules needed).
 */

// Overrides the shadcn SidebarMenuButton's default active styling
// (data-[active=true]:bg-sidebar-accent — a faint tint) with the intended active
// chip. Passed as `className` so tailwind-merge resolves the conflicting
// data-[active=true]:bg-*/text-* utilities in our favour.
//
// The icon is set separately from the label — one step brighter — because
// collapsed there is no label beside it, and a glyph at label weight
// disappears into the chip.
const ACTIVE_ITEM_OVERRIDE = [
  "data-[active=true]:bg-sidebar-primary",
  "data-[active=true]:text-sidebar-primary-foreground",
  "data-[active=true]:hover:bg-sidebar-primary",
  "data-[active=true]:hover:text-sidebar-primary-foreground",
  "data-[active=true]:[&>svg]:text-sidebar-primary-icon",
].join(" ");

// The icon colouring above, expressed for the NavLink's own activeClassName.
// Both paths style the same element (SidebarMenuButton renders the NavLink via
// asChild), so both have to agree or the winner depends on merge order.
const ACTIVE_LINK = [
  "bg-sidebar-primary",
  "text-sidebar-primary-foreground",
  "font-medium",
  "hover:bg-sidebar-primary",
  "[&>svg]:text-sidebar-primary-icon",
].join(" ");

// Full-strength ink at rest, not the foreground at 80%. On a pale rail the fade
// just read as low contrast.
const IDLE_LINK =
  "flex items-center gap-3 px-3 py-2.5 rounded-nav text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors";

/*
 * Collapsed, an item is a vertical stack: glyph on top, its name underneath.
 *
 * It used to be a 36x36 icon-only square. Icons alone are only legible once you
 * already know the app — Users, UserCog and Target are three people-and-goal
 * glyphs, and there was nothing to tell you which was which without expanding
 * the rail. Keeping the name means the collapsed rail is a narrow menu rather
 * than a memory test, which is how Zoho, Xero and QuickBooks all do it.
 *
 * Scoped entirely to `group-data-[collapsible=icon]:` so the expanded
 * appearance is untouched. The `!` prefixes drop the shadcn variant's collapsed
 * `!size-8`/`!p-2` deterministically — source order cannot be relied on for two
 * equal-specificity !important rules.
 */
const COLLAPSED_ICON_CELL = [
  "group-data-[collapsible=icon]:!w-full",
  "group-data-[collapsible=icon]:!h-auto",
  "group-data-[collapsible=icon]:!min-w-0",
  "group-data-[collapsible=icon]:!max-w-none",
  "group-data-[collapsible=icon]:!flex-col",
  "group-data-[collapsible=icon]:!items-center",
  "group-data-[collapsible=icon]:!justify-center",
  "group-data-[collapsible=icon]:!gap-0.5",
  "group-data-[collapsible=icon]:!px-1",
  "group-data-[collapsible=icon]:!py-1.5",
  "group-data-[collapsible=icon]:rounded-nav",
  "group-data-[collapsible=icon]:[&>svg]:!size-5",
  "group-data-[collapsible=icon]:[&>svg]:shrink-0",
].join(" ");

/**
 * The item's name under its glyph, collapsed.
 *
 * `!whitespace-normal` is the load-bearing part: the shadcn button forces
 * `[&>span:last-child]:truncate` on this span, and truncate includes
 * white-space: nowrap — so "Access Control" would be cut mid-word after
 * "Acce". Normal wrapping lets line-clamp break at the space instead.
 *
 * Two lines, because one truncated every name in this app to noise — "Sales
 * Dashboard" became "Sal...", "Access Control" became "Ac...", and three
 * people-shaped glyphs above three identical stubs is not a menu. Names are
 * shortened for the rail (see shortTitle) so two lines is genuinely enough,
 * and anything still too long ends in an ellipsis with the full name on the
 * tooltip.
 */
const COLLAPSED_LABEL =
  "w-full text-center text-[10px] font-medium leading-[1.15] line-clamp-2 !whitespace-normal";

/**
 * What an item is called on the collapsed rail.
 *
 * The expanded name says which dashboard ("Sales Dashboard"); on the rail the
 * module is already named above the group, so the qualifier is noise competing
 * for the few characters that fit.
 */
const SHORT_TITLES: Record<string, string> = {
  "Sales Dashboard": "Dashboard",
  "Sales Meetings": "Meetings",
  "Call History": "Calls",
  "Team Activity": "Activity",
  "Access Control": "Access",
  "Pitches & Marketing": "Pitches",
  "Bug Tracker": "Bugs",
};

const shortTitle = (title: string): string => SHORT_TITLES[title] ?? title;

// Trims the group padding collapsed so each stacked cell gets the rail's full
// width for its label, with a hair of space at the edges.
const COLLAPSED_GROUP_PAD = "group-data-[collapsible=icon]:px-1.5";

export function AppSidebar() {
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { companyName } = useAuth();
  // Route, then last-used, then CRM — the rule lives in the hook, because the
  // header names this same module and the two must not answer separately.
  const activeSection = useActiveModule();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r-sidebar-border group-data-[collapsible=icon]:overflow-hidden"
    >
      {/*
        h-14, matching the header beside it exactly. This was py-5 around a
        taller block, so the brand row stood ~20px above the header and the two
        never lined up. No bottom border: it ran the width of the rail and
        stopped dead at the header's own rule, so the two read as one line with
        a step in it.
      */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex h-14 w-full items-center gap-2.5 px-3 text-left transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:px-1"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          // The mark, not a letter in a box. "K" is a placeholder that survived
          // too long — the product has an icon, and this is where people look
          // to know which app they are in.
          // The wordmark, scaled to the rail rather than crushed into a
          // square. There is no compact Kynetropo mark to use — favicon.svg is
          // an ICO in disguise and icon-192 is this same wordmark padded onto a
          // white tile, so both came out as an illegible smudge at 32px. Drawn
          // at its own 4.7:1 ratio across the rail it is small but legible,
          // which is the whole job: say which app this is.
          <BrandLogo className="h-5 w-full max-w-[84px]" fallbackClassName="text-xs" />
        ) : (
          // The wordmark already says Kynetropo; the line underneath said it a
          // second time, in smaller type, directly below itself.
          <BrandLogo className="h-6 max-w-[148px]" fallbackClassName="text-sm" />
        )}
      </button>

      {/*
        The vendored SidebarContent sets overflow-hidden once collapsed, so a
        module with more areas than fit the rail had the rest clipped off the
        bottom with no way to reach them. overflow-y is forced back on with `!`
        because the shorthand it is fighting sets both axes. No scrollbar is
        drawn — on an 84px rail a gutter would take a tenth of the width.
      */}
      <SidebarContent className="eco-noscrollbar group-data-[collapsible=icon]:!overflow-y-auto group-data-[collapsible=icon]:overscroll-contain">
        <SidebarGroup className={COLLAPSED_GROUP_PAD}>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname === "/"}
                  className={`${ACTIVE_ITEM_OVERRIDE} ${COLLAPSED_ICON_CELL}`}
                >
                  <NavLink
                    to="/"
                    end
                    onClick={handleNavClick}
                    className={IDLE_LINK}
                    activeClassName={ACTIVE_LINK}
                  >
                    {/* Was an emoji, which rendered in a different family from
                        every other item and shifted with the platform's font. */}
                    <Home className="h-5 w-5 shrink-0" />
                    <span
                      className={collapsed ? COLLAPSED_LABEL : "flex-1"}
                      title={collapsed ? "Dashboard" : undefined}
                    >
                      Dashboard
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-3 my-2 h-px bg-sidebar-border" />

        {activeSection && activeSection.items.some((i) => i.url !== "/settings") && (
          <SidebarGroup className={COLLAPSED_GROUP_PAD}>
            {!collapsed && (
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {activeSection.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {activeSection.items.filter((i) => i.url !== "/settings").map((item) => {
                  const active = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        className={`${ACTIVE_ITEM_OVERRIDE} ${COLLAPSED_ICON_CELL}`}
                      >
                        <NavLink
                          to={item.url}
                          end
                          onClick={handleNavClick}
                          className={IDLE_LINK}
                          activeClassName={ACTIVE_LINK}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span
                            className={collapsed ? COLLAPSED_LABEL : "flex-1"}
                            title={collapsed ? item.title : undefined}
                          >
                            {collapsed ? shortTitle(item.title) : item.title}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
