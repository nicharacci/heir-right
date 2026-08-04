# HeirRight UI runtime contract

The operator artifact is a modular monolith. `src/entry.js` owns startup order, esbuild auto-discovers every `src/features/**/register.js`, and each feature registers through `core/feature-registry.js`. A feature can declare named views, commands, contextual rails, and lifecycle handlers. Identifiers are globally unique; duplicate registration fails, and the returned teardown removes every view, command, rail, and feature record even when a lifecycle callback fails.

## Authorization boundary

Feature definitions may load while the authentication gate is visible, but they cannot render, run commands, activate a rail, or execute rail actions until the legacy bridge is installed. The legacy application keeps `#workspace` inert until its fallible state and connection boot succeeds, installs the bridge only at the final authorized step, and restores the locked retry state if startup fails. Uninstalling the bridge closes the rail and disables the runtime again.

The bridge is a narrow capability object rather than access to legacy state. It exposes read-only public snapshots, sanitized state subscriptions, named command dispatch, selected-estate identity, allowlisted navigation, safe event emission, HTML escaping, and the Nucleo icon facade. It does not expose credentials, auth tokens, raw report text, arbitrary network requests, or mutable estate rows. Commands that name an estate reject an unknown identifier; exports resolve identifiers to internal rows before acting.

## Feature and rail registration

Feature modules call `registerFeature({ id, views, commands, rails, lifecycle })` as a module side effect. View renderers and lifecycle handlers receive the authorized bridge in a frozen context. Command handlers receive only their caller payload and the authorized bridge. A feature module must keep its own DOM and subscriptions inside its lifecycle so teardown remains complete.

Each contextual rail has one stable ID, named tabs, optional actions, and a width contract. The runtime allows one active contextual rail, persists open state, active rail, active tab, and width, and clamps width to the registered 280–640 pixel safety bounds. Mobile-sheet state is transient. Subscriber, renderer, and lifecycle failures are isolated so one feature cannot suppress another feature's state update.

## Theme and component boundary

The theme store owns `dark`, `cream`, and `system` modes. It applies semantic `--hr-*` roles to the document, maps those roles into Web Awesome Free, and isolates subscriber failures. Body copy and muted text meet WCAG AA contrast; focus rings and interactive control boundaries meet at least 3:1 against their surface. New feature styles consume the semantic roles directly.

Web Awesome Free is the only component primitive library, AG Grid Community is limited to Estates, Queue, and Admin/audit datasets, and esbuild bundles all production code and assets locally. Product icons go through the Nucleo facade. Runtime CDN assets, Web Awesome Pro components, and AG Grid Enterprise are outside this contract and are rejected by the build tests.
