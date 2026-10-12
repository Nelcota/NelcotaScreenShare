import { AppWindow, Globe, Monitor, Volume2, VolumeX } from "lucide-react";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  sharesAudio,
  type ShareChoice,
  type ShareSurface,
} from "@/features/room/domain/share-support";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { DockPopoverTitle } from "./DockPopover";
import { parseShareProfile, type ShareProfile } from "@/features/room/domain/share-profile";

const OPTIONS: {
  surface: ShareSurface;
  title: string;
  description: string;
  icon: typeof Monitor;
  /** The browser captures audio from this surface. */
  hasAudio: boolean;
}[] = [
  {
    surface: "monitor",
    title: "Tela inteira",
    description: "Tudo o que aparece no seu monitor",
    icon: Monitor,
    hasAudio: true,
  },
  {
    surface: "window",
    title: "Janela",
    description: "Um aplicativo específico, sem o resto da tela",
    icon: AppWindow,
    hasAudio: false,
  },
  {
    surface: "browser",
    title: "Aba do navegador",
    description: "Ideal para vídeos e slides",
    icon: Globe,
    hasAudio: true,
  },
];

interface SharePanelProps {
  audio: boolean;
  profile: ShareProfile;
  onAudioChange: (value: boolean) => void;
  onProfileChange: (value: ShareProfile) => void;
  onPick: (choice: ShareChoice) => void;
}

/**
 * Choices before the native picker. The audio switch comes first: picking an
 * option starts right away, so the sound has to be decided before. It only
 * shows where the browser actually sends the computer audio.
 */
export function SharePanel({
  audio,
  profile,
  onAudioChange,
  onProfileChange,
  onPick,
}: SharePanelProps) {
  const audioId = useId();
  const profileId = useId();
  const support = useShareSupport();
  const withAudio = support !== null && sharesAudio(support);

  return (
    <>
      <DockPopoverTitle hint={withAudio ? undefined : "Neste navegador, a tela vai sem o áudio."}>
        O que você quer compartilhar?
      </DockPopoverTitle>

      <div className="mb-2 flex flex-col gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5">
        <Label htmlFor={profileId} className="text-sm font-medium">
          Qualidade do compartilhamento
        </Label>
        <select
          id={profileId}
          value={profile}
          onChange={(event) => onProfileChange(parseShareProfile(event.currentTarget.value))}
          className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <option value="automatic">Automático</option>
          <option value="text">Texto · mais nitidez</option>
          <option value="video">Vídeo · mais movimento</option>
          <option value="data-saver">Economia de dados</option>
        </select>
        <p className="text-xs text-ink-subtle">Vale para o próximo compartilhamento.</p>
      </div>

      {withAudio ? (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/60 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Volume2 className="size-4 shrink-0 text-ink-subtle" aria-hidden="true" />
            <Label htmlFor={audioId} className="min-w-0 flex-col items-start gap-1">
              <span className="text-sm font-medium">Incluir áudio</span>
              <span className="text-xs font-normal text-ink-subtle">
                Da aba ou, no Windows, de todo o computador.
              </span>
            </Label>
          </div>
          <Switch id={audioId} checked={audio} onCheckedChange={onAudioChange} />
        </div>
      ) : null}

      <ul className="flex flex-col gap-1">
        {OPTIONS.map(({ surface, title, description, icon: Icon, hasAudio }, index) => {
          const silent = withAudio && audio && !hasAudio;
          return (
            <li key={surface}>
              <button
                type="button"
                autoFocus={index === 0}
                onClick={() => onPick({ surface, audio: withAudio && audio && hasAudio })}
                className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-none active:bg-surface-3/70"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand-soft transition-colors group-hover:bg-brand group-hover:text-brand-ink group-focus-visible:bg-brand group-focus-visible:text-brand-ink">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-ink-subtle">{description}</span>
                  {silent ? (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                      <VolumeX className="size-3" aria-hidden="true" />
                      Vai sem áudio: o navegador não captura som de janelas
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
