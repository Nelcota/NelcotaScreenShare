import { LayoutDashboard } from "lucide-react";
import { Link } from "react-router";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";
import { navItemClass } from "./nav-item-class";

/** The top bar's way to the panel, the same in the app and in the call. */
export function PanelShortcut({ hint, className }: { hint: string; className?: string }) {
  return (
    <Hint text={hint}>
      <Link
        viewTransition
        to="/admin"
        aria-label="Abrir o painel admin"
        className={cn(navItemClass, className)}
      >
        <LayoutDashboard className="size-5" aria-hidden="true" />
      </Link>
    </Hint>
  );
}
