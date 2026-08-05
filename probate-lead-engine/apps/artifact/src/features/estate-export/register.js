import { registerFeature } from "../../core/feature-registry.js";
import { mountExportView, renderExportView, unmountExportView } from "./export-view.js";
import "../data-grid/grids.css";

registerFeature({
  id: "s40-estate-export",
  views: [
    {
      id: "export",
      render: renderExportView,
      mount: ({ mount, bridge }) => mountExportView(mount, bridge),
      unmount: () => unmountExportView(),
    },
  ],
  lifecycle: {
    afterRender: ({ activeView, mount, bridge }) => {
      if (activeView === "export" && mount) mountExportView(mount, bridge);
    },
    bridgeLost: () => unmountExportView(),
  },
});
