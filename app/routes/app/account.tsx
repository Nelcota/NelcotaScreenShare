import { ownedTeams } from "@/features/account/server/workspace-privacy.server";
import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData } from "react-router";

import { Check, CircleCheck, Download, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { revokeMyOtherSessions, revokeMySession } from "@/features/account/actions";
import { AccountHealth } from "@/features/account/ui/AccountHealth";
import { ChangeEmailForm } from "@/features/account/ui/ChangeEmailForm";
import { ChangePasswordForm } from "@/features/account/ui/ChangePasswordForm";
import { DeleteAccountForm } from "@/features/account/ui/DeleteAccountForm";
import { ProfileForm } from "@/features/account/ui/ProfileForm";
import { ProfilePhotoForm } from "@/features/account/ui/ProfilePhotoForm";
import {
  CameraChoice,
  MicrophoneTest,
  OutputChoice,
  ProcessingChoice,
} from "@/features/room/ui/settings/MediaChoices";
import { ExpandableRow } from "@/features/account/ui/settings/ExpandableRow";
import {
  SettingsBlock,
  SettingsRow,
  SettingsSection,
} from "@/features/account/ui/settings/Settings";
import { NotificationSettings } from "@/features/account/ui/NotificationSettings";
import { PanelClose } from "@/features/friends/ui/PanelClose";
import { BackLink } from "@/components/shell/BackLink";
import { Button } from "@/components/ui/button";
import { SessionList } from "@/features/security/ui/SessionList";
import { TwoFactorSettings } from "@/features/security/ui/TwoFactorSettings";
import { safeReturnPath } from "@/features/auth/domain/return-path";
import { listActiveSessions } from "@/features/auth/server/sessions.server";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { getDb } from "@/server/db/index.server";
import { userSessions } from "@/server/db/schema";
import { getEnv } from "@/server/env.server";
import { cn } from "@/lib/utils";
import { noticeFor } from "@/lib/notice";
import { Notice } from "@/components/Notice";

export const meta = () => [{ title: "Minha conta · Nelcota" }];

const NOTICES: Record<string, string> = {
  email: "E-mail confirmado e atualizado.",
};

function StatusChip({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ok ? "bg-brand/12 text-brand-soft" : "bg-warning/12 text-warning",
      )}
    >
      {ok ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <ShieldAlert className="size-3.5" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

/** Who you are: the card with the photo, name, e-mail and the account status. */
function IdentityCard({
  user,
}: {
  user: {
    name: string;
    email: string;
    image: string | null;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
}) {
  return (
    <header className="panel rounded-2xl p-5 sm:p-7">
      <ProfilePhotoForm image={user.image}>
        <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{user.name}</h1>
        <p className="mt-1 text-sm [overflow-wrap:anywhere] text-ink-muted">{user.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusChip ok={user.emailVerified}>
            {user.emailVerified ? "E-mail confirmado" : "E-mail pendente"}
          </StatusChip>
          <StatusChip ok={user.twoFactorEnabled}>
            {user.twoFactorEnabled ? "Duas etapas ativa" : "Duas etapas desativada"}
          </StatusChip>
        </div>
      </ProfilePhotoForm>
    </header>
  );
}

function TwoFactorSummary({ enabled }: { enabled: boolean }) {
  if (enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-brand-soft">
        <Check className="size-4" aria-hidden="true" />
        Ativa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-warning">
      <ShieldAlert className="size-4" aria-hidden="true" />
      Desativada
    </span>
  );
}

function SecuritySection({ twoFactorEnabled }: { twoFactorEnabled: boolean }) {
  return (
    <SettingsSection id="seguranca" title="Segurança">
      <ExpandableRow
        id="senha"
        title="Senha"
        description="Ao trocar, as outras sessões são encerradas."
        summary="••••••••"
        actionLabel="Trocar senha"
      >
        <ChangePasswordForm />
      </ExpandableRow>
      <ExpandableRow
        id="duas-etapas"
        title="Verificação em duas etapas"
        description="Pede um código do app autenticador ao entrar."
        summary={<TwoFactorSummary enabled={twoFactorEnabled} />}
        actionLabel={twoFactorEnabled ? "Gerenciar" : "Ativar"}
      >
        <TwoFactorSettings
          scope="user"
          variant="plain"
          enabled={twoFactorEnabled}
          required={false}
          doneHref="/conta#seguranca"
        />
      </ExpandableRow>
    </SettingsSection>
  );
}

export const loader = routeLoader(async ({ searchParams }) => {
  const current = await requireUser("/conta", { requireVerified: false });
  const { voltar, aviso } = searchParams;
  const back = safeReturnPath(voltar, "");
  const sessions = await listActiveSessions(getDb(), userSessions, current.user.id);
  const notice = noticeFor(NOTICES, aviso);
  const { name, email, image, emailVerified, twoFactorEnabled } = current.user;
  return {
    ownedTeamCount: (await ownedTeams(getDb(), current.user.id)).length,
    currentId: current.session.id,
    back,
    sessions,
    notice,
    user: { name, email, image, emailVerified, twoFactorEnabled },
    requireEmailVerification: getEnv().REQUIRE_EMAIL_VERIFICATION,
  };
});

/**
 * Account home, in the middle of the app, in a single column: who you are (card with the photo), what is
 * left to secure the account (checklist with the action alongside) and the settings
 * in anchored sections (/conta#seguranca). Long forms open inline.
 */
export default function AccountPage() {
  const { currentId, back, sessions, notice, user, requireEmailVerification, ownedTeamCount } =
    useLoaderData<typeof loader>();
  return (
    <div className="relative">
      <PanelClose className="absolute top-3 right-3" />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:py-12">
        {back ? (
          <BackLink to={back} className="self-start">
            Voltar para a sala
          </BackLink>
        ) : null}
        {notice ? (
          <Notice as="output" tone="brand" icon={CircleCheck}>
            {notice}
          </Notice>
        ) : null}

        <IdentityCard user={user} />

        <AccountHealth
          emailVerified={user.emailVerified}
          emailRequired={requireEmailVerification}
          twoFactorEnabled={user.twoFactorEnabled}
        />

        <div className="mt-4 flex flex-col gap-12">
          <SettingsSection id="perfil" title="Perfil">
            <SettingsRow
              title="Nome na sala"
              description="Como você aparece para as outras pessoas. Vale a partir da próxima sala."
            >
              <ProfileForm name={user.name} />
            </SettingsRow>
            <ExpandableRow
              id="email"
              title="E-mail"
              description="A troca só vale depois de confirmada no novo endereço."
              summary={<span className="[overflow-wrap:anywhere] text-ink">{user.email}</span>}
              actionLabel="Trocar"
            >
              <ChangeEmailForm email={user.email} />
            </ExpandableRow>
          </SettingsSection>

          <SettingsSection
            id="audio-e-video"
            title="Áudio e vídeo"
            description="Vale neste navegador e na chamada aberta."
          >
            <SettingsRow title="Microfone">
              <MicrophoneTest />
            </SettingsRow>
            <SettingsRow title="Saída de som">
              <OutputChoice />
            </SettingsRow>
            <SettingsRow title="Câmera">
              <CameraChoice />
            </SettingsRow>
            <SettingsRow title="Limpeza do microfone">
              <ProcessingChoice />
            </SettingsRow>
          </SettingsSection>

          <SecuritySection twoFactorEnabled={user.twoFactorEnabled} />

          <NotificationSettings />

          <SettingsSection
            id="dispositivos"
            title="Dispositivos"
            description="Onde sua conta está conectada. Encerre as sessões que você não reconhece."
          >
            <SettingsBlock>
              <SessionList
                variant="plain"
                currentId={currentId}
                revokeSession={revokeMySession}
                revokeOtherSessions={revokeMyOtherSessions}
                sessions={sessions}
              />
            </SettingsBlock>
          </SettingsSection>

          <SettingsSection id="privacidade" title="Privacidade">
            <SettingsRow
              title="Seus dados"
              description="Um arquivo JSON com tudo o que guardamos ligado à sua conta."
            >
              <Button asChild variant="outline">
                <a href="/api/conta/dados" download>
                  <Download aria-hidden="true" />
                  Baixar meus dados
                </a>
              </Button>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection id="excluir" title="Encerrar conta" danger>
            <ExpandableRow
              title="Excluir conta"
              description="Apaga e-mail, nome, senha e sessões na hora e não pode ser desfeito. Registros de acesso exigidos por lei ficam guardados, sem seus dados de contato, até o fim do prazo legal."
              actionLabel="Excluir conta"
              danger
            >
              <DeleteAccountForm ownedTeamCount={ownedTeamCount} askCode={user.twoFactorEnabled} />
            </ExpandableRow>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}
