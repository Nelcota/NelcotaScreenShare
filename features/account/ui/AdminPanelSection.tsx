import { LayoutDashboard } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { SettingsRow, SettingsSection } from "@/features/account/ui/settings/Settings";

/**
 * Only for someone active on the panel's team, with the same verified e-mail. A link inside
 * the app, so a call going on survives; the panel still asks for its own sign-in and the 2FA
 * code.
 */
export function AdminPanelSection() {
  return (
    <SettingsSection id="painel" title="Painel admin">
      <SettingsRow
        title="Painel da equipe"
        description="Pede o login do painel e o código de verificação."
      >
        <Button asChild variant="outline">
          <Link viewTransition to="/admin">
            <LayoutDashboard aria-hidden="true" />
            Abrir o painel
          </Link>
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
