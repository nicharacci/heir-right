import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  PanelRight,
  Plug,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  UploadCloud,
  UserRound,
  UserRoundPlus,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * The public BeUI source owns Lucide as its icon dependency. This bank keeps
 * that dependency behind one HeirRight semantic boundary for the future
 * React surface; the mounted vanilla runtime keeps its existing facade.
 */
const BEUI_ICON_BANK = Object.freeze({
  dashboard: LayoutDashboard,
  estates: Search,
  documents: FileText,
  export: Download,
  outreach: Send,
  queue: Inbox,
  admin: ShieldCheck,
  settings: Settings2,
  integrations: Plug,
  help: CircleHelp,
  command: Search,
  panel: PanelRight,
  filter: Filter,
  upload: UploadCloud,
  folder: FolderOpen,
  external: ArrowUpRight,
  refresh: RefreshCw,
  account: UserRound,
  switchAccount: UserRoundPlus,
  logout: LogOut,
  success: Check,
  loading: LoaderCircle,
  close: X,
  chevron: ChevronDown,
} satisfies Record<string, LucideIcon>);

type BeuiIconName = keyof typeof BEUI_ICON_BANK;

interface BeuiIconProps extends Omit<LucideProps, "name"> {
  name: BeuiIconName;
  label?: string;
}

function resolveBeuiIcon(name: BeuiIconName): LucideIcon {
  const Icon = BEUI_ICON_BANK[name];
  if (!Icon) throw new Error(`Unknown BeUI icon: ${String(name)}`);
  return Icon;
}

function BeuiIcon({ name, label, size = 18, strokeWidth = 1.8, ...props }: BeuiIconProps) {
  const Icon = resolveBeuiIcon(name);
  return (
    <Icon
      {...props}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  );
}

export { BEUI_ICON_BANK, BeuiIcon, resolveBeuiIcon };
export type { BeuiIconName, BeuiIconProps };
