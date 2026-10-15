import {
  Gauge,
  History,
  KeyRound,
  MonitorSmartphone,
  MonitorUp,
  Radio,
  Settings2,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { NavIcon } from "@/features/admin/shell/server/nav.server";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  home: Gauge,
  live: Radio,
  rooms: Video,
  users: Users,
  shares: MonitorUp,
  audit: History,
  settings: Settings2,
  security: KeyRound,
  sessions: MonitorSmartphone,
};
