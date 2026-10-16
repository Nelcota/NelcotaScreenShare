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
    date: "2026-10-12",
    title: "Amigos, mensagens e o app depois do login",
    changes: [
      {
        kind: "new",
        text: "Amigos: adicione por e-mail, pelo código NELC ou por link de convite.",
      },
      { kind: "new", text: "Escolha seu status: Online, Ausente, Ocupado ou Invisível." },
      {
        kind: "new",
        text: "Chame um amigo para a chamada. O toque aparece em qualquer página do Nelcota.",
      },
      { kind: "new", text: "Mensagens diretas e em grupo, com GIFs." },
      { kind: "new", text: "Chame o grupo inteiro de dentro da conversa." },
      {
        kind: "new",
        text: "O app ganhou uma coluna com amigos e mensagens, que acompanha você até na sala.",
      },
      { kind: "new", text: "Dono e moderadores da sala, que podem expulsar e banir da chamada." },
      { kind: "new", text: "Transfira a sala para outra pessoa." },
      { kind: "new", text: "Salas com entrada por aprovação." },
      { kind: "new", text: "Câmera na chamada." },
      { kind: "new", text: "Assista à tela de alguém só quando quiser." },
      {
        kind: "new",
        text: "Desenhe na tela compartilhada: setas, círculos e traços que somem sozinhos.",
      },
      { kind: "new", text: "Volume da voz e da tela separado para cada pessoa." },
      {
        kind: "new",
        text: "A chamada continua num cartão pequeno quando você sai da página da sala.",
      },
      { kind: "new", text: "Escolha microfone, saída de som e câmera em Minha conta." },
      {
        kind: "new",
        text: "Teste o microfone na chamada ouvindo a própria voz, sem que ninguém escute.",
      },
      { kind: "new", text: "Troque as teclas dos atalhos da sala." },
      { kind: "new", text: "Notificações de mensagem e de chamada com a aba em segundo plano." },
      { kind: "new", text: "Denuncie uma pessoa, uma mensagem ou um grupo." },
      { kind: "fix", text: "Um link de sala inventado não cria mais uma sala." },
      { kind: "fix", text: "Trocar de sala pede confirmação e encerra a chamada da outra aba." },
      { kind: "improvement", text: "Tema claro menos branco, com mais contraste entre as partes." },
      { kind: "improvement", text: "Cartão de cada pessoa na sala mais simples." },
    ],
  },
  {
    date: "2026-10-11",
    title: "Modo streamer e mais controle na chamada",
    changes: [
      {
        kind: "new",
        text: "Modo streamer: esconde o código, o link e o QR code da sala, inclusive na barra de endereço.",
      },
      { kind: "new", text: "Botão para parar de ouvir a sala sem sair da chamada." },
      { kind: "new", text: "Troque seu nome durante a chamada." },
      { kind: "new", text: "Escolha o som de aviso de mensagem nova no chat, ou desligue." },
      {
        kind: "new",
        text: "Veja o FPS e o ping da tela compartilhada, inclusive de quem compartilha.",
      },
      { kind: "new", text: "Desligue os atalhos da sala enquanto joga." },
      { kind: "fix", text: "Mãos levantadas aparecem com mais destaque na chamada." },
      { kind: "fix", text: "Os avisos de quem entrou não se repetem mais ao reconectar." },
      { kind: "fix", text: "A sala avisa quando todo mundo saiu e você ficou sozinho." },
      { kind: "fix", text: "Dá para voltar a uma sala cheia em que você já estava." },
      { kind: "fix", text: "O tema claro ou escuro pode ser trocado durante a chamada." },
      { kind: "fix", text: "A foto de perfil aparece na barra do topo assim que a página abre." },
      {
        kind: "fix",
        text: "O mascote fica no canto, sem trocar de pose sozinho durante a chamada.",
      },
      { kind: "improvement", text: "Tema claro com cores mais equilibradas." },
      { kind: "improvement", text: "Animações suaves na página inicial." },
      { kind: "improvement", text: "Brave na lista de navegadores compatíveis." },
    ],
  },
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
