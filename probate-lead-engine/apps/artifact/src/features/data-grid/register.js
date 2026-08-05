import { registerFeature } from "../../core/feature-registry.js";
import { mountAdminAuditGrid, resetAdminAuditMount } from "./admin-audit-grid.js";
import { mountEstatesGrid, renderEstatesGrid } from "./estates-grid.js";
import { mountQueueGrid, renderQueueGrid } from "./queue-grid.js";
import "./grids.css";

let unsubscribeState = null;

function reconcileMountedGrids(snapshot, bridge) {
  if (snapshot.activeView !== "admin") resetAdminAuditMount();
  if (snapshot.activeView === "admin") {
    queueMicrotask(() => mountAdminAuditGrid(document.getElementById("adminView"), bridge, snapshot));
  }
}

registerFeature({
  id: "s41-operational-beui-rails",
  views: [
    { id: "find-estates", render: renderEstatesGrid },
    { id: "queue", render: renderQueueGrid },
  ],
  lifecycle: {
    bridgeReady: ({ bridge }) => {
      unsubscribeState?.();
      unsubscribeState = bridge.subscribe((snapshot) => reconcileMountedGrids(snapshot, bridge));
    },
    bridgeLost: () => {
      unsubscribeState?.();
      unsubscribeState = null;
      resetAdminAuditMount();
    },
    afterRender: ({ activeView, mount, bridge }) => {
      if (activeView === "find-estates" && mount) mountEstatesGrid(mount, bridge);
      if (activeView === "queue" && mount) mountQueueGrid(mount, bridge);
    },
  },
});
