import { registerFeature } from "../../core/feature-registry.js";
import { docPrepRail } from "./doc-prep-rail.js";
import { mountDocPrepView, renderDocPrepView, unmountDocPrepView } from "./doc-prep-view.js";
import "./doc-prep.css";

registerFeature({
  id: "s38-doc-prep",
  views: [
    {
      id: "dossiers",
      render: renderDocPrepView,
      mount: ({ mount, bridge }) => mountDocPrepView(mount, bridge),
      unmount: ({ mount }) => unmountDocPrepView(mount),
    },
  ],
  rails: [docPrepRail],
  lifecycle: {
    afterRender: ({ activeView, mount, bridge }) => {
      if (activeView === "dossiers" && mount) mountDocPrepView(mount, bridge);
    },
  },
});
