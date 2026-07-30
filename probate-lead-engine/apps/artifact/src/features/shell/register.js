import { registerFeature } from "../../core/feature-registry.js";
import { caseJourneyRailDefinition } from "../case-journey/case-journey-rail.js";
import { renderDashboardView } from "../dashboard/dashboard-view.js";
import "../case-journey/case-journey.css";
import "../dashboard/dashboard.css";
import "./shell.css";
import { createShellController } from "./shell-controller.js";

const controller = createShellController();

registerFeature({
  id: "case-journey-cockpit",
  views: [
    {
      id: "dashboard",
      render: renderDashboardView,
    },
  ],
  commands: [
    {
      id: "open-case-journey",
      run: (payload = {}) => controller.openContext(payload.tab || "overview", payload.source || null),
    },
  ],
  rails: [caseJourneyRailDefinition()],
  lifecycle: {
    bridgeReady: ({ bridge }) => controller.mount(bridge),
    afterRender: () => controller.afterRender(),
    bridgeLost: () => controller.unmount(),
    unmount: () => controller.unmount(),
  },
});
