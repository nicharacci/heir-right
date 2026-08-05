# HeirRight OSS UI dependency boundary

The operator artifact installs these exact MIT-licensed packages through the repository pnpm lockfile. Production bundles and serves their code locally; the browser does not load a runtime CDN.

| Package | Version | License | Allowed boundary | Production path |
| --- | ---: | --- | --- | --- |
| `@awesome.me/webawesome` | `3.10.0` | MIT | Free components imported explicitly from `dist/components`; no Pro component or package | Component code in `/assets/app.js`; locale/runtime metadata under `/assets/webawesome` |
| `esbuild` | `0.28.1` | MIT | Build-time JavaScript/CSS bundler | Build-time only |

Web Awesome's `File Input`, `Combobox`, `Date Input`, `Date Picker`, Toast, Patterns, Data Viz, and all other Pro-marked components are forbidden. The IDI report control remains a native `input[type=file]`. Product icons stay behind HeirRight's Nucleo facade; Web Awesome's hosted default icon library is unregistered, its embedded system icons are retained only for component internals, and the icon path is pinned to `/assets/webawesome/icons` as a local-only fallback.

AG Grid, Enterprise modules, integrated charts, Excel export, server-side row model, master/detail, row grouping, and sparklines are absent from the application. Interactive queue and operational tables use the installed BeUI table foundation. The build and contract test reject AG Grid package references and known runtime asset CDNs in source or shipped entry assets.

Registration, authorization, bridge, rail, and theme behavior is defined in [ui-runtime-contract.md](./ui-runtime-contract.md) and enforced by the executable S38 component-runtime contract test.
