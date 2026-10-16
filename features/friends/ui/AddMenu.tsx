import { Plus, UserPlus, type LucideIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddFriendWindow } from "@/features/friends/ui/AddFriendDialog";

/** A window opened from the "+" menu; on close, focus goes back to the "+". */
export interface AddMenuWindowState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}

/** Something else to add from the "+" menu, with the window it opens (e.g. "Criar grupo"). */
export interface AddMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  window: (state: AddMenuWindowState) => ReactNode;
}

const ADD_FRIEND = "amigo";

/**
 * One "+" beside the search: "Adicionar amigo" and what other features add, named in the
 * menu instead of two round icons that looked alike.
 */
export function AddMenu({
  code,
  linkPath,
  items = [],
}: {
  code: string;
  linkPath: string;
  items?: readonly AddMenuItem[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const stateOf = (id: string): AddMenuWindowState => ({
    open: openId === id,
    onOpenChange: (open) => setOpenId(open ? id : null),
    // The menu item that opened the window is gone: focus the "+" instead of the page.
    onCloseAutoFocus: (event) => {
      event.preventDefault();
      trigger.current?.focus();
    },
  });
  return (
    <>
      <DropdownMenu>
        <Hint text="Adicionar">
          <DropdownMenuTrigger asChild>
            <Button ref={trigger} variant="brand-outline" size="icon-lg" aria-label="Adicionar">
              <Plus aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => setOpenId(ADD_FRIEND)}>
            <UserPlus aria-hidden="true" />
            Adicionar amigo
          </DropdownMenuItem>
          {items.map(({ id, label, icon: Icon }) => (
            <DropdownMenuItem key={id} onSelect={() => setOpenId(id)}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AddFriendWindow code={code} linkPath={linkPath} {...stateOf(ADD_FRIEND)} />
      {items.map((item) => (
        <AddMenuWindow key={item.id} item={item} state={stateOf(item.id)} />
      ))}
    </>
  );
}

function AddMenuWindow({ item, state }: { item: AddMenuItem; state: AddMenuWindowState }) {
  return item.window(state);
}
