import type { ComponentType } from "react";

type ReactModule = typeof import("react");
type ReactDomServerModule = typeof import("react-dom/server");
type StreamdownComponent = ComponentType<{
  children?: string;
  mode?: "static" | "streaming";
  skipHtml?: boolean;
}>;

let rendererModules:
  | Promise<{
      React: ReactModule;
      renderToStaticMarkup: ReactDomServerModule["renderToStaticMarkup"];
      Streamdown: StreamdownComponent;
    }>
  | undefined;

async function loadRendererModules(): NonNullable<typeof rendererModules> {
  rendererModules ??= Promise.all([
    import("react") as Promise<ReactModule>,
    import("react-dom/server") as Promise<ReactDomServerModule>,
    import("streamdown") as Promise<{ Streamdown: StreamdownComponent }>,
  ]).then(([react, reactDomServer, streamdown]) => ({
    React: react,
    renderToStaticMarkup: reactDomServer.renderToStaticMarkup,
    Streamdown: streamdown.Streamdown,
  }));
  return rendererModules;
}

export async function renderMarkdownWithStreamdown(markdown: string): Promise<string> {
  const { React, renderToStaticMarkup, Streamdown } = await loadRendererModules();

  return renderToStaticMarkup(
    React.createElement(
      "div",
      { className: "streamdown-doc", "data-markdown-renderer": "streamdown" },
      React.createElement(Streamdown, { mode: "static", skipHtml: true }, markdown),
    ),
  );
}
