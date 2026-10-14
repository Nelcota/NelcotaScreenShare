import {
  Ban,
  DoorOpen,
  Flag,
  Hand,
  Handshake,
  History,
  KeyRound,
  Mail,
  MessageSquare,
  MessageSquareOff,
  MicOff,
  MonitorOff,
  Search,
  UserRound,
  UsersRound,
  VideoOff,
  type LucideIcon,
} from "lucide-react";
import { PrivacyItem, PrivacyList, PrivacySection } from "./PrivacySection";

const NOT_STORED: { icon: LucideIcon; label: string }[] = [
  { icon: MicOff, label: "Áudio" },
  { icon: VideoOff, label: "Vídeo" },
  { icon: MonitorOff, label: "Telas compartilhadas" },
  { icon: MessageSquareOff, label: "Chat da sala" },
];

/** "O que guardamos" and "O que não guardamos" on the privacy page. */
export function StoredDataSections() {
  return (
    <>
      <PrivacySection
        id="o-que-guardamos"
        index={1}
        title="O que guardamos"
        description="Os dados ligados à sua conta, divididos pelo motivo de existirem."
      >
        <PrivacyList>
          <PrivacyItem icon={UserRound} title="Conta">
            Nome de exibição, e-mail, senha (guardada só como hash argon2id) e, se você escolher, a
            foto de perfil, sem os metadados da imagem. Nome e foto aparecem para quem está nas
            mesmas salas; a foto pode ser trocada ou removida em Configurações.
          </PrivacyItem>
          <PrivacyItem icon={KeyRound} title="Segurança">
            Sessões ativas (IP e navegador) e, se você ativar, o segredo da verificação em duas
            etapas, cifrado.
          </PrivacyItem>
          <PrivacyItem icon={History} title="Uso">
            Em quais salas você entrou, quando entrou e saiu, e quando compartilhou a tela, com o IP
            de acesso.
          </PrivacyItem>
          <PrivacyItem icon={UsersRound} title="Convidados sem conta">
            O nome que a pessoa digitou para a sala, quando entrou e saiu, e o IP de acesso, com os
            mesmos prazos dos registros de uso.
          </PrivacyItem>
          <PrivacyItem icon={Handshake} title="Amigos">
            Seus amigos, os pedidos de amizade, quem você bloqueou e o seu código e link de amigo.
          </PrivacyItem>
          <PrivacyItem icon={DoorOpen} title="Salas que você cria">
            O código da sala, quem criou, quem é dono ou moderador e se a entrada precisa de
            aprovação.
          </PrivacyItem>
          <PrivacyItem icon={Hand} title="Pedidos de entrada">
            Numa sala com aprovação, o nome que você digitou e a resposta do dono.
          </PrivacyItem>
          <PrivacyItem icon={Ban} title="Remoções de chamada">
            Quem foi removido de uma chamada, de qual sala e por quem. Não guardamos motivo nem IP.
          </PrivacyItem>
          <PrivacyItem icon={MessageSquare} title="Mensagens">
            As conversas e os grupos de que você participa, as mensagens que você envia e seus GIFs
            favoritos. Cada mensagem fica guardada até quem enviou apagar.
          </PrivacyItem>
          <PrivacyItem icon={Search} title="Busca de GIFs">
            Vai do seu navegador direto para a KLIPY, que recebe o que você digitou e o seu IP. Do
            GIF enviado ou favoritado, guardamos só o código.
          </PrivacyItem>
          <PrivacyItem icon={Flag} title="Denúncias">
            Quando você denuncia alguém, uma mensagem ou um grupo: o motivo, o que você escreveu e a
            data. Quem foi denunciado não fica sabendo quem denunciou. Ao denunciar uma mensagem,
            guardamos uma cópia dela até a equipe avaliar; a cópia também some se a conta de quem
            enviou ou de quem denunciou for excluída.
          </PrivacyItem>
          <PrivacyItem icon={Mail} title="Lista de espera do Pro">
            Só o e-mail de quem pediu para ser avisado, até enviarmos o aviso do lançamento. Para
            sair da lista antes, é só pedir.
          </PrivacyItem>
        </PrivacyList>
      </PrivacySection>

      <PrivacySection
        id="o-que-nao-guardamos"
        index={2}
        title="O que não guardamos"
        description="Não gravamos áudio, vídeo, telas compartilhadas nem o chat da sala: tudo isso passa ao vivo e some quando a sala acaba."
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NOT_STORED.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex flex-col items-start gap-3 rounded-2xl border border-brand/25 bg-brand/8 p-4"
            >
              <Icon className="size-5 text-brand-soft" aria-hidden="true" />
              <span className="text-sm font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </PrivacySection>
    </>
  );
}
