import { registerFeature } from "../../core/feature-registry.js";
import { mountS40DocPrepView, renderS40DocPrepView, unmountS40DocPrepView } from "./s40-doc-prep-view.js";
import "./s40-doc-prep.css";

registerFeature({
  id: "s40-doc-prep",
  views: [
    {
      id: "dossiers",
      render: renderS40DocPrepView,
      mount: ({ mount, bridge }) => mountS40DocPrepView(mount, bridge),
      unmount: ({ mount }) => unmountS40DocPrepView(mount),
    },
  ],
  lifecycle: {
    afterRender: ({ activeView, mount, bridge }) => {
      if (activeView === "dossiers" && mount) mountS40DocPrepView(mount, bridge);
    },
  },
});
