import { registerFeature } from "../../core/feature-registry.js";
import { mountAdminAuditGrid, resetAdminAuditMount } from "./admin-audit-grid.js";
import { destroyCommunityGrid } from "./community-grid.js";
import { mountEstatesGrid, renderEstatesGrid } from "./estates-grid.js";
import { mountQueueGrid, renderQueueGrid } from "./queue-grid.js";
import "./grids.css";

let unsubscribeState = null;

function reconcileMountedGrids(snapshot, bridge) {
  if (snapshot.activeView !== "find-estates") destroyCommunityGrid("estates");
  if (snapshot.activeView !== "queue") destroyCommunityGrid("queue");
  if (snapshot.activeView !== "admin") resetAdminAuditMount();
  if (snapshot.activeView === "admin") {
    queueMicrotask(() => mountAdminAuditGrid(document.getElementById("adminView"), bridge, snapshot));
  }
}

registerFeature({
  id: "s38-operational-community-grids",
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
      destroyCommunityGrid("estates");
      destroyCommunityGrid("queue");
      resetAdminAuditMount();
    },
    afterRender: ({ activeView, mount, bridge }) => {
      if (activeView === "find-estates" && mount) mountEstatesGrid(mount, bridge);
      if (activeView === "queue" && mount) mountQueueGrid(mount, bridge);
    },
  },
});
