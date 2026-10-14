import { Loader2, RotateCcw } from "lucide-react";
import { useOperation } from "@/lib/operations/use-operation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { saveMascotSettings } from "@/features/admin/settings/actions";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { MascotSettings } from "@/features/admin/settings/server/settings.server";
import { cn } from "@/lib/utils";
import { toastError } from "@/features/admin/shell/ui/toast-error";

interface Limits {
  min: number;
  max: number;
  step: number;
}

const THEMES = [
  {
    field: "saturationDark",
    title: "Tema escuro",
    // Same background color as each theme, so the preview matches the site.
    swatch: "bg-[#17181a] text-[#fafafa]",
  },
  {
    field: "saturationLight",
    title: "Tema claro",
    swatch: "bg-[#e7ebe6] text-[#1f2023]",
  },
] as const;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function MascotSettingsForm({
  initial,
  defaults,
  limits,
  canEdit,
}: {
  initial: MascotSettings;
  /** Original art, restored by the reset button. */
  defaults: MascotSettings;
  limits: Limits;
  /** Without `settings.update`, the screen shows the preview but does not save. */
  canEdit: boolean;
}) {
  const [values, setValues] = useState(initial);
  const baseId = useId();
  const save = useOperation(saveMascotSettings, {
    onSuccess: () => toast.success("Salvo. Vale para as próximas páginas."),
    onError: toastError("Confira os valores e tente de novo."),
  });
  const pending = save.isPending;

  const changed =
    values.saturationDark !== initial.saturationDark ||
    values.saturationLight !== initial.saturationLight;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.execute(values);
      }}
      className="panel w-full max-w-3xl rounded-2xl p-6 sm:p-8"
    >
      <h2 className="text-xl font-semibold tracking-tight">Saturação do mascote</h2>
      <p className="mt-1 text-sm text-ink-muted">
        0% deixa o mascote cinza, 100% mantém a arte original e 200% deixa as cores mais vivas. O
        site só muda depois de salvar.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {THEMES.map(({ field, title, swatch }) => {
          const id = `${baseId}-${field}`;
          const value = values[field];
          return (
            <fieldset
              key={field}
              className="flex flex-col gap-4 rounded-2xl border border-line p-4"
            >
              <legend className="sr-only">{title}</legend>
              <div
                className={cn("grid h-44 place-items-center rounded-xl", swatch)}
                style={{ "--mascot-saturation": value }}
              >
                <Mascot className="size-32" sizes="256px" canSleep={false} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span id={`${id}-label`} className="text-sm font-medium">
                  {title}
                </span>
                <output htmlFor={id} className="text-sm font-medium text-ink-muted tabular-nums">
                  {percent(value)}
                </output>
              </div>
              <Slider
                name={field}
                min={limits.min}
                max={limits.max}
                step={limits.step}
                value={[value]}
                onValueChange={([next]) =>
                  setValues((current) => ({ ...current, [field]: next ?? current[field] }))
                }
                thumbProps={{
                  id,
                  "aria-labelledby": `${id}-label`,
                  "aria-valuetext": percent(value),
                }}
                className="min-h-8"
              />
            </fieldset>
          );
        })}
      </div>

      {canEdit ? null : (
        <p className="mt-6 text-sm text-ink-muted">
          Só quem tem o papel Dono pode salvar esta configuração.
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={!canEdit}
          onClick={() => setValues(defaults)}
        >
          <RotateCcw aria-hidden="true" />
          Restaurar original
        </Button>
        <Button type="submit" disabled={!canEdit || pending || !changed}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
    </form>
  );
}
