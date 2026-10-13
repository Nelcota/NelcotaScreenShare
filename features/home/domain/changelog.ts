export type ChangeKind = "new" | "fix" | "improvement";

interface Change {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  /** Day the changes went live, as `YYYY-MM-DD`. */
  date: string;
  title: string;
  changes: Change[];
}

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  new: "Novo",
  fix: "Corrigido",
  improvement: "Melhorado",
};

/**
 * What changed for people who use the app, newest first. Written by hand from the merged
 * PRs: internal work (refactors, tests, tooling) stays out.
 */
export const RELEASES: Release[] = [
  {
    date: "2026-10-08",
    title: "Convidados sem conta e mais recursos na sala",
    changes: [
      {
        kind: "new",
        text: "Quem recebe o link entra na sala só com o nome.",
      },
      {
        kind: "new",
        text: "Links do Nelcota aparecem com prévia no WhatsApp, no Slack e no Discord.",
      },
      {
        kind: "new",
        text: "Acompanhe a tela de alguém numa janela flutuante, por cima dos seus apps.",
      },
      { kind: "new", text: "Aponte na tela compartilhada usando só o teclado." },
      { kind: "new", text: "A sala avisa quando alguém para de compartilhar a tela." },
      {
        kind: "fix",
        text: "O som da própria chamada não volta mais pelo áudio do computador compartilhado.",
      },
      {
        kind: "fix",
        text: "A barra de controles fica acima da barra de compartilhamento do navegador.",
      },
      { kind: "fix", text: "A tecla S não interrompe mais um compartilhamento em andamento." },
      {
        kind: "fix",
        text: "Avisos e dicas continuam visíveis com a tela compartilhada em tela cheia.",
      },
      { kind: "fix", text: "A tela compartilhada mais recente é a que aparece em destaque." },
      { kind: "improvement", text: "Mais espaço para a tela compartilhada em telas baixas." },
      { kind: "improvement", text: "Transições mais suaves entre páginas, menus e painéis." },
      { kind: "improvement", text: "Página inicial nova, com preços e casos de uso." },
      { kind: "improvement", text: "Cadastro mais curto: a foto de perfil fica para depois." },
    ],
  },
  {
    date: "2026-10-07",
    title: "Conta, e-mails e segurança",
    changes: [
      { kind: "new", text: "Tema claro ou escuro e foto de perfil já na hora de criar a conta." },
      { kind: "new", text: "Antes de entrar, veja quem já está na sala." },
      { kind: "fix", text: "Contraste melhor no tema claro." },
      { kind: "fix", text: "E-mails de acesso com visual novo e entrega mais confiável." },
      { kind: "improvement", text: "Teste de microfone mais estável e mais leve." },
      { kind: "improvement", text: "Páginas mais leves e mais rápidas para abrir." },
      {
        kind: "improvement",
        text: "Proteções extras no login, nas fotos de perfil e na lista de quem está na sala.",
      },
    ],
  },
];

const releaseDate = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "8 de outubro de 2026" (the date is a calendar day, so it is read in UTC). */
export function formatReleaseDate(date: string): string {
  return releaseDate.format(new Date(`${date}T00:00:00Z`));
}
