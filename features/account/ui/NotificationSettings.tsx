import { useId } from "react";
import { SettingsRow, SettingsSection } from "./settings/Settings";
import { Switch } from "@/components/ui/switch";
import {
  useNotificationPreferences,
  updateNotificationPreferences,
} from "@/features/notifications/client/preferences-store";
import {
  requestBrowserPermission,
  useBrowserPermission,
} from "@/features/notifications/client/notify";
import type { PermissionState } from "@/features/notifications/domain/notifier";

const PERMISSION_NOTE: Partial<Record<PermissionState, string>> = {
  denied: "Bloqueadas nas permissões do site.",
  unsupported: "Este navegador não mostra notificações.",
};

function LabeledSwitch({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-end gap-3">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function BrowserNotificationsControl() {
  const preferences = useNotificationPreferences();
  const permission = useBrowserPermission();

  async function change(enabled: boolean) {
    if (!enabled) {
      updateNotificationPreferences({ browserNotifications: false });
      return;
    }
    if (permission === "granted") {
      updateNotificationPreferences({ browserNotifications: true });
      return;
    }
    await requestBrowserPermission();
  }

  const note = PERMISSION_NOTE[permission];
  const blocked = permission === "denied" || permission === "unsupported";
  return (
    <div className="flex flex-col items-end gap-1.5">
      <LabeledSwitch
        label="Notificações do navegador"
        checked={!blocked && permission === "granted" && preferences.browserNotifications}
        disabled={blocked}
        onCheckedChange={(enabled) => void change(enabled)}
      />
      {note ? <p className="text-right text-sm text-ink-muted">{note}</p> : null}
    </div>
  );
}

/** /conta#notificacoes: valid for this browser, like the permission itself. */
export function NotificationSettings() {
  const preferences = useNotificationPreferences();
  return (
    <SettingsSection
      id="notificacoes"
      title="Notificações"
      description="Valem para este navegador."
    >
      <SettingsRow
        title="Som de toque"
        description="Toca quando alguém te chama e, baixinho, quando uma chamada acaba."
      >
        <LabeledSwitch
          label="Som de toque"
          checked={preferences.ringSound}
          onCheckedChange={(ringSound) => updateNotificationPreferences({ ringSound })}
        />
      </SettingsRow>
      <SettingsRow
        title="Som de mensagem"
        description="Um aviso curto quando chega mensagem fora da conversa aberta."
      >
        <LabeledSwitch
          label="Som de mensagem"
          checked={preferences.messageSound}
          onCheckedChange={(messageSound) => updateNotificationPreferences({ messageSound })}
        />
      </SettingsRow>
      <SettingsRow title="Sons da chamada" description="Ao ligar e desligar o microfone e o som.">
        <LabeledSwitch
          label="Sons da chamada"
          checked={preferences.callSounds}
          onCheckedChange={(callSounds) => updateNotificationPreferences({ callSounds })}
        />
      </SettingsRow>
      <SettingsRow
        title="Notificações do navegador"
        description="Chamadas e mensagens com o Nelcota em outra aba."
      >
        <BrowserNotificationsControl />
      </SettingsRow>
    </SettingsSection>
  );
}
