const automationStages = Object.freeze([
  Object.freeze({ id: "upload-received", label: "Upload received", copy: "The report is attached to this estate." }),
  Object.freeze({ id: "secure-readback", label: "Saved report verified", copy: "HeirRight confirmed the saved report opens correctly." }),
  Object.freeze({ id: "report-extracted", label: "Report extracted", copy: "HeirRight found searchable evidence in the report." }),
  Object.freeze({ id: "idi-facts-linked", label: "IDI facts linked", copy: "Reviewed facts and their report locations are linked to this estate." }),
  Object.freeze({ id: "discovery-running", label: "Discovery running", copy: "Public records and reviewed IDI evidence are being assembled." }),
  Object.freeze({ id: "packet-verified", label: "Packet verified", copy: "The new Discovery PDF opens correctly and is now the active packet." }),
  Object.freeze({ id: "ready-for-review", label: "Ready for review", copy: "The local packet is ready for operator review." }),
]);

function reportIsLinked(snapshot = {}) {
  return Boolean(snapshot.docPrep?.documents?.some((document) => (
    document.id === "idi-asset-search"
    || /\bIDI\b/i.test(document.title || "")
  ) && document.hasVerifiedFile));
}

function timelineState(snapshot = {}, uiState = {}) {
  const newReportPending = Boolean(uiState.file || uiState.busy || uiState.status === "selected" || uiState.status === "uploading");
  const packetVerified = Boolean(snapshot.docPrep?.packetVerified && !uiState.runStarted && !newReportPending);
  const reportLinked = reportIsLinked(snapshot)
    || uiState.status === "success"
    || uiState.completedStages?.includes("idi-facts-linked");
  const automationStatus = String(snapshot.docPrep?.automation?.status || "").toLowerCase();
  const automationBlocked = automationStatus === "blocked";
  const discoveryActive = Boolean(
    uiState.runStarted
    || uiState.runBusy
    || (reportLinked && automationStatus === "writing"),
  );
  const completed = new Set(uiState.completedStages || []);
  const failedStage = uiState.failedStage || (automationBlocked ? "discovery-running" : "");
  const failedIndex = automationStages.findIndex((stage) => stage.id === failedStage);
  const baselineRevision = Number(uiState.baselinePacketRevision);
  const currentRevision = Number(snapshot.docPrep?.packetRevision || 0);
  const replacementPending = Boolean(
    uiState.runStarted
    && uiState.baselinePacketRevision !== null
    && uiState.baselinePacketRevision !== undefined
    && Number.isFinite(baselineRevision)
    && currentRevision <= baselineRevision,
  );
  if (reportLinked) automationStages.slice(0, 4).forEach((stage) => completed.add(stage.id));
  if (packetVerified) automationStages.forEach((stage) => completed.add(stage.id));

  return automationStages.map((stage, index) => {
    let state = completed.has(stage.id) ? "complete" : "pending";
    if (stage.id === "discovery-running" && discoveryActive) state = "active";
    if (stage.id === "packet-verified" && !packetVerified && automationStatus === "exported") state = "active";
    if (uiState.activeStage === stage.id) state = "active";
    if (replacementPending && index > 4) state = "pending";
    if (failedIndex > -1 && index > failedIndex) state = "pending";
    if (stage.id === failedStage) state = "failed";
    return Object.freeze({ ...stage, state });
  });
}

function renderAutomationTimeline(snapshot = {}, uiState = {}, escape = String) {
  const stages = timelineState(snapshot, uiState);
  return `
    <ol class="hr-automation-timeline" aria-label="Discovery automation progress" data-automation-timeline>
      ${stages.map((stage) => `
        <li class="hr-automation-stage" data-stage="${escape(stage.id)}" data-state="${escape(stage.state)}"${stage.state === "active" ? ' aria-current="step"' : ""}>
          <span class="hr-automation-marker" aria-hidden="true"></span>
          <span class="hr-automation-stage-copy">
            <strong>${escape(stage.label)}</strong>
            <span>${escape(stage.state === "failed" && uiState.error ? uiState.error : stage.copy)}</span>
          </span>
          <span class="hr-automation-state">${escape({ complete: "Complete", active: "In progress", failed: "Needs review", pending: "Waiting" }[stage.state])}</span>
        </li>
      `).join("")}
    </ol>
  `;
}

export { automationStages, renderAutomationTimeline, reportIsLinked, timelineState };
