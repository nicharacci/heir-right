import type {
  ConnectionStatus,
  ExportResult,
  ExportRoute,
  ExportRouteResult,
  ReadbackEvidencePacket,
  ReadbackRouteEvidence,
  ReadbackRouteStatus,
} from "@ple/types";
import { nowIso, slug } from "../lib";

function connectionFor(statuses: ConnectionStatus[], route: ExportRoute): ConnectionStatus | undefined {
  const name = route === "google" ? "Google" : "Podio";
  return statuses.find((status) => status.name === name);
}

function routeLabel(route: ExportRoute): string {
  return route === "google" ? "Google Workspace" : "Podio";
}

function statusFor(route: ExportRouteResult): ReadbackRouteStatus {
  if (route.mode === "dry_run") return "prepared_only";
  if (route.ok && route.readbackOk) return "passed";
  return "blocked";
}

function humanStatus(status: ReadbackRouteStatus): string {
  if (status === "passed") return "read back";
  if (status === "prepared_only") return "prepared only";
  return "blocked";
}

function routeBlockers(route: ExportRouteResult, status?: ConnectionStatus): string[] {
  return Array.from(new Set([
    ...route.blockers,
    ...(status && !status.ok ? [status.message] : []),
  ]));
}

function googleVerification(route: ExportRouteResult, status: ReadbackRouteStatus): ReadbackRouteEvidence["verification"] {
  if (status === "passed") {
    return {
      record: route.externalId ? `Google report was created with id ${route.externalId}.` : "Google report was created.",
      reportBody: "Report body was written to the controlled Google document.",
      trackingRow: "Tracking row was appended and read back.",
      reviewTask: "Google handoff does not create a Podio review task.",
      cleanup: "Keep the test folder/doc attached to the acceptance record unless Sam asks for cleanup.",
    };
  }
  if (status === "prepared_only") {
    return {
      record: "Google folder, report Doc, and tracking Sheet row are prepared only; no live Google record was created.",
      reportBody: "Report body is ready to write after Workspace access and approval.",
      trackingRow: "Tracking row is ready to append after the target Sheet is configured.",
      reviewTask: "No Podio review task applies to the Google route.",
      cleanup: "No Google cleanup is needed because no live Google record was created.",
    };
  }
  return {
    record: "Google record was not created.",
    reportBody: "Report body was not written to Google.",
    trackingRow: "Tracking row was not appended or read back.",
    reviewTask: "No Podio review task applies to the Google route.",
    cleanup: "No Google cleanup is needed unless a partial live record appears in the blocked route output.",
  };
}

function podioVerification(route: ExportRouteResult, status: ReadbackRouteStatus): ReadbackRouteEvidence["verification"] {
  if (status === "passed") {
    return {
      record: route.externalId ? `Podio test item was created with id ${route.externalId}.` : "Podio test item was created.",
      reportBody: "Report link/source note was attached to the controlled Podio item.",
      trackingRow: "No Google tracking row applies to the Podio route.",
      reviewTask: "Review task/comment were created and read back.",
      cleanup: "Leave the clearly labeled test item for Sam/Joshua review or remove it after acceptance sign-off.",
    };
  }
  if (status === "prepared_only") {
    return {
      record: "Podio item, report link, source note, review task, and readback are prepared only; no live Podio item was created.",
      reportBody: "Report link/source note is ready after controlled write approval.",
      trackingRow: "No Google tracking row applies to the Podio route.",
      reviewTask: "Review task is ready to create after Podio access and approval.",
      cleanup: "No Podio cleanup is needed because no live Podio item was created.",
    };
  }
  return {
    record: "Podio item was not created.",
    reportBody: "Report link/source note was not attached in Podio.",
    trackingRow: "No Google tracking row applies to the Podio route.",
    reviewTask: "Podio review task/comment were not verified.",
    cleanup: "No Podio cleanup is needed unless a partial live item appears in the blocked route output.",
  };
}

function nextActionFor(route: ExportRouteResult, status: ReadbackRouteStatus, connection?: ConnectionStatus): string {
  if (status === "passed") {
    return route.route === "google"
      ? "Keep the Google folder, report Doc, and tracking row with the acceptance record."
      : "Spot-check the clearly labeled Podio test item, source note, review task, and readback before milestone acceptance.";
  }
  if (route.route === "google") {
    return connection?.ok
      ? "Approve one controlled Google export/readback and keep the resulting Doc and Sheet row in the evidence packet."
      : "Provide the approved Google Workspace destination before the controlled readback test.";
  }
  return connection?.ok
    ? "Approve one clearly labeled Podio test item and readback before treating the handoff loop as live."
    : "Provide Podio access, target app setup, controlled test values, and explicit write approval.";
}

function routeEvidence(route: ExportRouteResult, statuses: ConnectionStatus[], generatedAt: string): ReadbackRouteEvidence {
  const connection = connectionFor(statuses, route.route);
  const status = statusFor(route);
  const blockers = routeBlockers(route, connection);
  return {
    route: route.route,
    label: routeLabel(route.route),
    status,
    mode: route.mode,
    prepared: route.mode === "dry_run" || route.ok,
    liveWriteAttempted: route.mode === "live",
    createdRecord: Boolean(route.externalId && route.mode === "live"),
    externalId: route.externalId,
    url: route.url,
    readbackOk: route.readbackOk,
    verification: route.route === "google"
      ? googleVerification(route, status)
      : podioVerification(route, status),
    blockers,
    nextAction: nextActionFor(route, status, connection),
    checkedAt: connection?.checkedAt ?? generatedAt,
  };
}

function packetSummary(routes: ReadbackRouteEvidence[]): string {
  const passed = routes.filter((route) => route.status === "passed").length;
  const prepared = routes.filter((route) => route.status === "prepared_only").length;
  if (passed === routes.length && routes.length > 0) {
    return "Google and Podio controlled readback evidence is present.";
  }
  return [
    "Google and Podio readback is not accepted yet.",
    `${prepared} route(s) are prepared only and ${routes.length - passed - prepared} route(s) are blocked.`,
    "Do not treat the handoff loop as live until both controlled readbacks pass.",
  ].join(" ");
}

export function buildReadbackEvidencePacket(
  exportResult: ExportResult,
  statuses: ConnectionStatus[] = [],
): ReadbackEvidencePacket {
  const generatedAt = nowIso();
  const routes = exportResult.routes.map((route) => routeEvidence(route, statuses, generatedAt));
  const blockers = Array.from(new Set(routes.flatMap((route) => route.blockers)));
  const cleanupNotes = routes.map((route) => `${route.label}: ${route.verification.cleanup}`);
  const nextActions = Array.from(new Set(routes
    .filter((route) => route.status !== "passed")
    .map((route) => route.nextAction)));
  return {
    id: `readback-${Date.now()}-${slug(exportResult.dossierId)}`,
    generatedAt,
    overallStatus: routes.length > 0 && routes.every((route) => route.status === "passed") ? "passed" : "blocked",
    operatorSummary: packetSummary(routes),
    routes,
    blockers,
    cleanupNotes,
    nextActions,
  };
}

function statusLabel(status: ReadbackRouteStatus): string {
  if (status === "passed") return "Passed";
  if (status === "prepared_only") return "Prepared only";
  return "Blocked";
}

function bulletList(items: string[]): string {
  if (!items.length) return "- None";
  return items.map((item) => `- ${item}`).join("\n");
}

function routeRows(packet: ReadbackEvidencePacket): string {
  return packet.routes
    .map((route) => [
      route.label,
      statusLabel(route.status),
      route.liveWriteAttempted ? "Yes" : "No",
      route.createdRecord ? (route.externalId ?? "Created") : "No live record",
      route.readbackOk ? "Read back" : humanStatus(route.status),
      route.nextAction,
    ].map((value) => String(value).replace(/\|/g, "/")).join(" | "))
    .map((row) => `| ${row} |`)
    .join("\n");
}

function verificationSections(packet: ReadbackEvidencePacket): string {
  return packet.routes.map((route) => `### ${route.label}

- Record: ${route.verification.record}
- Report body/link: ${route.verification.reportBody}
- Tracking row: ${route.verification.trackingRow}
- Review task/comment: ${route.verification.reviewTask}
- Cleanup: ${route.verification.cleanup}
- Link: ${route.url ?? "Not available yet"}
- Blockers:
${bulletList(route.blockers)}`).join("\n\n");
}

export function renderReadbackEvidenceMarkdown(packet: ReadbackEvidencePacket): string {
  return `# HeirRight Google + Podio Readback Evidence

Generated: ${packet.generatedAt}
Status: ${packet.overallStatus === "passed" ? "Passed" : "Blocked"}

${packet.operatorSummary}

## Route Summary

| Route | Status | Live write attempted | Created record | Readback | Next action |
| --- | --- | --- | --- | --- | --- |
${routeRows(packet)}

## Verification Detail

${verificationSections(packet)}

## Cleanup Notes

${bulletList(packet.cleanupNotes)}

## Current Blockers

${bulletList(packet.blockers)}

## Next Actions

${bulletList(packet.nextActions)}
`;
}
