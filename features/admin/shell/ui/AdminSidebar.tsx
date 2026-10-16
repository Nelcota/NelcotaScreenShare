import { ArrowLeft, ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import { NavBrand } from "@/components/shell/NavBar";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { NavGroup } from "@/features/admin/shell/server/nav.server";
import { NAV_ICONS } from "./nav-icons";

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarBrand() {
  return (
    <SidebarHeader className="gap-0 pt-4 pb-3 group-data-[collapsible=icon]:pt-2">
      <div className="flex h-10 items-center group-data-[collapsible=icon]:justify-center">
        <NavBrand href="/admin" showName={false} />
        <span className="flex min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm font-medium">Nelcota</span>
          <span className="text-xs text-ink-subtle">Painel admin</span>
        </span>
      </div>
    </SidebarHeader>
  );
}

function SidebarNavigation({ groups }: { groups: NavGroup[] }) {
  const pathname = useLocation().pathname;
  return (
    <SidebarContent>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(pathname, item.href)}
                      tooltip={item.label}
                    >
                      <Link
                        viewTransition
                        to={item.href}
                        aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      >
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}

function SidebarUserMenu({ user, onSignOut }: { user: ShellUser; onSignOut: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton size="lg" tooltip={user.name}>
          <UserAvatar image={null} className="size-8" />
          <span className="flex min-w-0 flex-col text-left leading-tight">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-ink-subtle">{user.roleLabel}</span>
          </span>
          <ChevronsUpDown className="ml-auto" aria-hidden="true" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{user.name}</span>
          <span className="truncate text-xs font-normal text-ink-subtle">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link viewTransition to="/admin/conta/seguranca">
              <UserRound aria-hidden="true" />
              Minha conta
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onSignOut}>
            <LogOut aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarAccountFooter({ user, onSignOut }: { user: ShellUser; onSignOut: () => void }) {
  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="Voltar ao app">
            <Link viewTransition to="/">
              <ArrowLeft aria-hidden="true" />
              <span>Voltar ao app</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarSeparator className="mx-0" />
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarUserMenu user={user} onSignOut={onSignOut} />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

/** Admin side navigation: brand, navigation groups and the account menu. */
export function AdminSidebar({
  user,
  groups,
  onSignOut,
}: {
  user: ShellUser;
  groups: NavGroup[];
  onSignOut: () => void;
}) {
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarBrand />
      <SidebarNavigation groups={groups} />
      <SidebarAccountFooter user={user} onSignOut={onSignOut} />
      <SidebarRail />
    </Sidebar>
  );
}
