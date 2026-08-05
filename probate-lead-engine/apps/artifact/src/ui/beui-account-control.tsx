import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../beui-foundation/components/motion/popover";
import { BeuiIcon } from "./beui-icon-bank";
import type { BeuiAccountIdentity } from "../features/beui-tabs/contract";

interface BeuiAccountControlProps {
  identity: BeuiAccountIdentity | null;
  onSwitchAccount?: () => void;
  onSignOut?: () => void;
}

const ACCOUNT_MENU_ITEMS = Object.freeze([
  { id: "switch-account", label: "Switch account", href: "/auth/login?prompt=select_account" },
  { id: "sign-out", label: "Log out", href: "/auth/logout" },
]);

function accountCopy(identity: BeuiAccountIdentity | null) {
  if (!identity?.authenticated || !identity.email) {
    return {
      primary: "Sign in",
      secondary: "Authentication required",
      state: "signed-out",
    } as const;
  }
  return {
    primary: identity.name?.trim() || identity.email,
    secondary: identity.domain?.trim() || identity.email,
    state: "signed-in",
  } as const;
}

function BeuiAccountControl({ identity, onSwitchAccount, onSignOut }: BeuiAccountControlProps) {
  const [open, setOpen] = useState(false);
  const menuItemsRef = useRef<Array<HTMLAnchorElement | null>>([]);
  const copy = accountCopy(identity);

  function focusMenuItem(index: number) {
    const count = ACCOUNT_MENU_ITEMS.length;
    const next = (index + count) % count;
    menuItemsRef.current[next]?.focus({ preventScroll: true });
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = document.activeElement;
    const index = menuItemsRef.current.findIndex((item) => item === current);
    if (index < 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(ACCOUNT_MENU_ITEMS.length - 1);
    }
  }

  function onActionClick(
    id: string,
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    if (id === "switch-account") onSwitchAccount?.();
    if (id === "sign-out") onSignOut?.();
    if (!event.defaultPrevented) setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="top"
      align="start"
      sideOffset={8}
      className="beui-account-control"
    >
      <PopoverTrigger>
        <button
          type="button"
          className="beui-account-trigger"
          data-beui-control="account-chip"
          data-state={copy.state}
          aria-label={open ? "Close account menu" : "Open account menu"}
        >
          <BeuiIcon name="account" size={18} />
          <span className="beui-account-copy">
            <strong>{copy.primary}</strong>
            <span>{copy.secondary}</span>
          </span>
          <BeuiIcon name="chevron" size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="beui-account-menu">
        <div role="menu" aria-label="Account menu" onKeyDown={onMenuKeyDown}>
          <div className="beui-account-menu-heading">
            <strong>{copy.primary}</strong>
            <span>{copy.secondary}</span>
          </div>
          <div className="beui-account-menu-divider" role="presentation" />
          {ACCOUNT_MENU_ITEMS.map((item, index) => (
            <a
              key={item.id}
              ref={(node) => {
                menuItemsRef.current[index] = node;
              }}
              className="beui-account-menu-item"
              href={item.href}
              role="menuitem"
              onClick={(event) => onActionClick(item.id, event)}
            >
              <BeuiIcon name={item.id === "sign-out" ? "logout" : "switchAccount"} size={17} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ACCOUNT_MENU_ITEMS, BeuiAccountControl, accountCopy };
export type { BeuiAccountControlProps };
