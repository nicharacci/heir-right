export type BeuiRouteId =
  | "dashboard"
  | "find-estates"
  | "dossiers"
  | "export"
  | "drips"
  | "queue"
  | "admin"
  | "settings"
  | "help-demos";

export type LegacyState = Record<string, unknown>;
export type LegacyStateListener = (state: LegacyState) => void;

export interface AuthorizedLegacyBridge {
  readState: () => LegacyState;
  subscribe: (listener: LegacyStateListener) => () => void;
  navigate: (view: string) => unknown;
  dispatch: (command: string, payload?: Readonly<Record<string, unknown>>) => unknown;
  selectedEstateId?: string | null | (() => string | null);
  emit?: (...args: unknown[]) => unknown;
}

export interface BeuiBridgeAdapter {
  readonly selectedEstateId?: string | null;
  readState: () => LegacyState;
  subscribe: (listener: LegacyStateListener) => () => void;
  navigate: (route: BeuiRouteId | string) => unknown;
  dispatch: (command: string, payload?: Readonly<Record<string, unknown>>) => unknown;
  emit: (...args: unknown[]) => unknown;
}

export interface ReactRootLike {
  render: (node: unknown) => void;
  unmount: () => void;
}

export interface ReactRuntimeLifecycleOptions<Props> {
  createRoot: (element: Element) => ReactRootLike;
  render: (root: ReactRootLike, props: Props) => void;
}

export interface ReactRuntimeLifecycle<Props> {
  mount: (element: Element, props: Props) => void;
  unmount: () => void;
  isMounted: () => boolean;
}

const ROUTE_ALIASES: Readonly<Record<string, BeuiRouteId>> = Object.freeze({
  home: "dashboard",
  manage: "dashboard",
  "manage-estates": "dashboard",
  estates: "find-estates",
  "estate-search": "find-estates",
  dossier: "dossiers",
  "doc-prep": "dossiers",
  docprep: "dossiers",
  outreach: "drips",
  "scheduled-drips": "drips",
  help: "help-demos",
  demos: "help-demos",
});

const ROUTES = new Set<BeuiRouteId>([
  "dashboard",
  "find-estates",
  "dossiers",
  "export",
  "drips",
  "queue",
  "admin",
  "settings",
  "help-demos",
]);

export function normalizeBeuiRoute(route: BeuiRouteId | string): BeuiRouteId {
  const value = String(route || "dashboard").trim().toLowerCase();
  if (ROUTE_ALIASES[value]) return ROUTE_ALIASES[value];
  if (ROUTES.has(value as BeuiRouteId)) return value as BeuiRouteId;
  return "dashboard";
}

export function createBeuiBridgeAdapter(bridge: AuthorizedLegacyBridge): BeuiBridgeAdapter {
  if (!bridge || typeof bridge.readState !== "function" || typeof bridge.subscribe !== "function") {
    throw new Error("The authorized HeirRight bridge is unavailable.");
  }
  if (typeof bridge.navigate !== "function" || typeof bridge.dispatch !== "function") {
    throw new Error("The authorized HeirRight bridge is incomplete.");
  }

  return Object.freeze({
    selectedEstateId:
      typeof bridge.selectedEstateId === "function"
        ? bridge.selectedEstateId()
        : bridge.selectedEstateId ?? null,
    readState: () => bridge.readState(),
    subscribe: (listener: LegacyStateListener) => bridge.subscribe(listener),
    navigate: (route: BeuiRouteId | string) => bridge.navigate(normalizeBeuiRoute(route)),
    dispatch: (command: string, payload?: Readonly<Record<string, unknown>>) =>
      bridge.dispatch(command, payload),
    emit: (...args: unknown[]) => bridge.emit?.(...args),
  });
}

export function createReactRuntimeLifecycle<Props>(
  options: ReactRuntimeLifecycleOptions<Props>,
): ReactRuntimeLifecycle<Props> {
  let mounted: { element: Element; root: ReactRootLike } | null = null;

  return {
    mount(element, props) {
      if (!mounted || mounted.element !== element) {
        if (mounted) mounted.root.unmount();
        mounted = { element, root: options.createRoot(element) };
      }
      options.render(mounted.root, props);
    },
    unmount() {
      if (!mounted) return;
      mounted.root.unmount();
      mounted = null;
    },
    isMounted: () => mounted !== null,
  };
}
