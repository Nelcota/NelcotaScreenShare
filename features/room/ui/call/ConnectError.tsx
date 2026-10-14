import { AlertTriangle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/features/room/ui/StatusScreen";
import { runAndReport } from "@/lib/telemetry.client";

/** The connection never opened: explains why and offers to retry (with a new token). */
export function ConnectError({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => Promise<void>;
  onBack: () => void;
}) {
  const [retrying, setRetrying] = useState(false);

  async function retry() {
    setRetrying(true);
    await runAndReport(onRetry);
    setRetrying(false);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <StatusScreen
        icon={AlertTriangle}
        tone="danger"
        title="Não deu para conectar"
        message={message}
        alert
      >
        <Button size="lg" loading={retrying} onClick={() => void retry()}>
          {retrying ? null : <RotateCcw aria-hidden="true" />}
          Tentar de novo
        </Button>
        <Button variant="outline" size="lg" onClick={onBack}>
          Voltar
        </Button>
      </StatusScreen>
    </main>
  );
}
