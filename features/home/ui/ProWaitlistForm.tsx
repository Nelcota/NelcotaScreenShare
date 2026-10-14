import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { proInterestResultSchema, proInterestSchema } from "@/features/home/domain/pro-interest";
import { readJson } from "@/lib/read-json";
import { logBrowserWarning } from "@/lib/telemetry.client";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

const NETWORK_ERROR = "Não foi possível enviar agora. Confira sua internet e tente de novo.";

async function send(email: string): Promise<State> {
  try {
    const response = await fetch("/api/pro/interesse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = proInterestResultSchema.safeParse(await readJson(response));
    const message = body.success ? body.data.message : NETWORK_ERROR;
    return response.ok ? { kind: "done", message } : { kind: "error", message };
  } catch (error) {
    logBrowserWarning("Pro waitlist request failed", error);
    return { kind: "error", message: NETWORK_ERROR };
  }
}

/** E-mail field for the Pro launch list (no billing exists yet). */
export function ProWaitlistForm() {
  const inputId = useId();
  const statusId = useId();
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;
    const parsed = proInterestSchema.safeParse({
      email: new FormData(event.currentTarget).get("email"),
    });
    if (!parsed.success) {
      setState({ kind: "error", message: parsed.error.issues[0]?.message ?? "Confira o e-mail." });
      return;
    }
    setState({ kind: "sending" });
    setState(await send(parsed.data.email));
  }

  if (state.kind === "done") {
    return (
      <output className="block rounded-2xl bg-brand/12 px-4 py-3 text-sm font-medium">
        {state.message}
      </output>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        Quer ser avisado quando o Pro abrir?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          className="h-10 flex-1 rounded-full px-4"
          aria-invalid={state.kind === "error" || undefined}
          aria-describedby={statusId}
        />
        <Button type="submit" variant="secondary" loading={state.kind === "sending"}>
          Quero ser avisado
        </Button>
      </div>
      <p id={statusId} aria-live="polite" className="min-h-5 text-sm text-danger">
        {state.kind === "error" ? state.message : ""}
      </p>
    </form>
  );
}
