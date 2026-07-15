import { expect, test } from "@playwright/test";

function watchBrowserFailures(page, { expectedHttpStatuses = [] } = {}) {
  const failures = [];
  const expectedStatuses = new Set(expectedHttpStatuses.map(Number));
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    const resourceStatus = text.match(/^Failed to load resource: .*status of (\d{3})\b/);
    if (resourceStatus && expectedStatuses.has(Number(resourceStatus[1]))) return;
    failures.push(`console: ${text}`);
  });
  return failures;
}

async function openWorkspace(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("heirright:guided-walkthrough-seen", "true"));
  await expect.poll(() => page.locator("html").getAttribute("data-server-hydrated")).not.toBeNull();
  const walkthroughClose = page.locator("[data-walkthrough-close]");
  if (await walkthroughClose.isVisible().catch(() => false)) await walkthroughClose.click();
  await expect(page.locator('[data-shell-nav="dashboard"]')).toHaveClass(/is-active/);
  await expect(page.locator("#authGate")).toBeHidden();
}

async function isolateDocPrepWorkspaceState(page) {
  const keys = new Set([
    "heirright:docprep-estate-state",
    "heirright:discovery-workflow-state",
    "heirright:source-capture-state",
    "heirright:idi-asset-imports",
    "heirright:contact-review-state",
    "heirright:document-files-state",
  ]);
  await page.route("**/local-state/**", async (route) => {
    const key = decodeURIComponent(new URL(route.request().url()).pathname).split("/").pop();
    if (!keys.has(key)) {
      await route.continue();
      return;
    }
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, value: "{}" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route("**/api/discovery/idi-asset-search/import?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, exists: false, assetKey: new URL(route.request().url()).searchParams.get("assetKey") }),
  }));
  await page.route("**/api/discovery/file?*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, readbackStatus: "verified" }),
  }));
  await page.route("**/api/documents/attachments?*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, attachments: [] }) });
  });
  await page.route("**/api/connections/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([]),
  }));
  await page.route("**/api/google-workspace/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ connected: false }),
  }));
}

async function openDocumentPrep(page, estateId = "estate") {
  await page.locator('[data-shell-nav="dossiers"]').click();
  const workspace = page.locator('[data-feature="doc-prep"]');
  await expect(workspace).toBeVisible();
  await expect(workspace).toHaveAttribute("data-estate-id", /.+/);
  const estateSelect = workspace.locator("[data-docprep-estate-select]");
  await estateSelect.selectOption(estateId);
  await expect(workspace).toHaveAttribute("data-estate-id", estateId);
  await expect(estateSelect).toHaveValue(estateId);
}

async function closeUnifiedRail(page) {
  const rail = page.locator("#s38UnifiedRail");
  if (await rail.getAttribute("aria-hidden") === "false") {
    await rail.locator("[data-unified-rail-close]").click();
    await expect(rail).toHaveAttribute("aria-hidden", "true");
  }
}

async function chooseReportWithPicker(page, trigger, file) {
  const chooserReady = page.waitForEvent("filechooser");
  await trigger.click();
  const chooser = await chooserReady;
  await chooser.setFiles(file);
}

async function installSuccessfulIdiPipeline(page, { failFirstExtraction = false, failFirstGoogleDelivery = false, googleConnected = false, holdFirstExtraction = false } = {}) {
  const attachmentRequests = [];
  const extractionRequests = [];
  const sourceRequests = [];
  const exportRequests = [];
  const googleDeliveryRequests = [];
  const attachmentId = "supporting-1780000000000-0123456789abcdea";
  const attachmentHash = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  const reportBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  const docxBytes = Buffer.from("PK\u0003\u0004mock-searchable-docx-report");
  const packetBytes = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(12_500, 32), Buffer.from("\n%%EOF\n")]);
  const packetArtifacts = new Map();
  let releaseExtraction = () => {};
  let packetApproval = null;
  let uploadedBytes = reportBytes;
  let uploadedContentType = "application/pdf";
  const extractionBarrier = holdFirstExtraction
    ? new Promise((resolve) => { releaseExtraction = resolve; })
    : null;

  await page.route("**/api/connections/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(googleConnected ? [{ id: "google-workspace", name: "Google", label: "Google Workspace", mode: "connected" }] : []),
  }));
  await page.route("**/api/google-workspace/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(googleConnected
      ? { connected: true, destinationId: "drive-folder-1", destinationName: "Discovery Packets" }
      : { connected: false }),
  }));
  await page.route("**/api/doc-prep/packet-approval", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "approve") {
      packetApproval = {
        packetRevision: Number(body.packetRevision),
        approvedAt: new Date().toISOString(),
        approvedBy: "operator@heirright.test",
        artifactId: String(body.artifactId),
        estateId: String(body.estateId),
        flow: String(body.flow),
      };
    }
    const matchesCurrentRevision = Boolean(packetApproval
      && packetApproval.packetRevision === Number(body.packetRevision)
      && packetApproval.artifactId === String(body.artifactId)
      && packetApproval.estateId === String(body.estateId)
      && packetApproval.flow === String(body.flow));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        approved: matchesCurrentRevision,
        approval: matchesCurrentRevision ? packetApproval : null,
        readbackStatus: "verified",
      }),
    });
  });
  await page.route("**/api/google-workspace/export", async (route) => {
    const body = route.request().postDataJSON();
    googleDeliveryRequests.push(body);
    if (failFirstGoogleDelivery && googleDeliveryRequests.length === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "internal_drive_endpoint", message: "raw stack and token details" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        route: "google",
        readbackStatus: "verified",
        readbackOk: true,
        destination: "Discovery Packets",
        fileId: `drive-file-${googleDeliveryRequests.length}`,
      }),
    });
  });

  await page.route("**/api/documents/attachments**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      attachmentRequests.push(body);
      uploadedBytes = Buffer.from(String(body.dataBase64 || ""), "base64");
      uploadedContentType = body.contentType;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          attachment: {
            id: attachmentId,
            artifactId: attachmentId,
            estateId: body.estateId,
            documentId: body.documentId,
            fileName: body.fileName,
            contentType: uploadedContentType,
            size: uploadedBytes.byteLength,
            contentHash: attachmentHash,
            createdAt: new Date().toISOString(),
            uploadedBy: "operator@heirright.com",
            artifactUrl: `/api/documents/attachments?attachmentId=${attachmentId}`,
            readbackStatus: "verified",
          },
        }),
      });
      return;
    }
    if (url.searchParams.get("attachmentId") === attachmentId) {
      await route.fulfill({
        status: 200,
        contentType: uploadedContentType,
        headers: {
          "x-heirright-artifact-id": attachmentId,
          "x-heirright-content-hash": attachmentHash,
        },
        body: uploadedBytes,
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, attachments: [] }) });
  });

  await page.route("**/api/discovery/idi-asset-search/extract", async (route) => {
    const body = route.request().postDataJSON();
    extractionRequests.push(body);
    if (extractionBarrier && extractionRequests.length === 1) await extractionBarrier;
    if (failFirstExtraction && extractionRequests.length === 1) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, message: "No searchable text was found in the scanned report." }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "uploaded_file",
        provider: "idi",
        lockKey: `idi:${body.estateId}`,
        importedAt: new Date().toISOString(),
        importedBy: "operator@heirright.com",
        duplicateGuard: "first_import_only",
        adminOverrideReason: null,
        attachment: {
          id: attachmentId,
          artifactId: attachmentId,
          estateId: body.estateId,
          documentId: "idi-asset-search",
          fileName: body.attachment.fileName,
          contentType: uploadedContentType,
          size: uploadedBytes.byteLength,
          contentHash: attachmentHash,
          createdAt: new Date().toISOString(),
          uploadedBy: "operator@heirright.com",
          artifactUrl: `/api/documents/attachments?attachmentId=${attachmentId}`,
          readbackStatus: "verified",
        },
        extraction: {
          status: "extracted",
          method: uploadedContentType === "application/pdf" ? "pdf_text" : "docx_text",
          fileKind: uploadedContentType === "application/pdf" ? "pdf" : "docx",
          extractedAt: new Date().toISOString(),
          characterCount: 184,
          sourceLocators: [{ kind: "page", index: 2, label: "Page 2" }],
        },
        subjectMatch: { matched: true, signals: ["owner", "address"], reviewedAt: new Date().toISOString() },
        candidates: [{
          id: `${body.estateId}:idi:1`,
          name: "Avery Sample",
          relationship: "representative",
          group: "primary",
          phones: ["305-555-0100"],
          emails: [],
          currentAddress: "",
          addressHistory: [],
          ownerLastNameMatch: true,
          confidence: 90,
          confidenceReason: "named contact; representative relationship; contact or address signal",
          reviewStatus: "auto_accepted_high_confidence",
          sourceLocator: { kind: "page", index: 2, label: "Page 2" },
        }],
        contactReviews: {},
        contactPreviewCount: 1,
        importVerification: "verified",
        paidRun: false,
        paidRunApproved: false,
        paidRunVerification: "not_applicable",
        reviewRequired: false,
        readbackStatus: "verified",
        persistence: { stored: true, readbackStatus: "verified", assetKey: body.estateId },
        message: "IDI report extracted with source-located high-confidence contacts. Discovery can continue with the recorded review trail.",
      }),
    });
  });

  await page.route("**/api/discovery/external-source-run", async (route) => {
    const body = route.request().postDataJSON();
    sourceRequests.push(body);
    const propertySourceUrl = "https://county.example.test/property/estate";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "external_source_run",
        runId: `source-${sourceRequests.length}`,
        generatedAt: new Date().toISOString(),
        sourceFacts: [
          {
            source: "property_appraiser",
            factType: "property_owner",
            value: body.seed.ownerName,
            sourceUrl: propertySourceUrl,
            confidence: 0.98,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "property_appraiser",
            factType: "property_address",
            value: body.seed.propertyAddress,
            sourceUrl: propertySourceUrl,
            confidence: 0.98,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "property_appraiser",
            factType: "property_folio",
            value: body.seed.parcelId,
            sourceUrl: propertySourceUrl,
            confidence: 0.98,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "property_appraiser",
            factType: "mailing_address_signal",
            value: "PO BOX 100, MIAMI, FL 00000",
            sourceUrl: propertySourceUrl,
            confidence: 0.94,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "tax_collector",
            factType: "tax_receipt_link",
            value: "https://county.example.test/tax/receipt-121",
            sourceUrl: "https://county.example.test/tax/receipt-121",
            confidence: 0.92,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "official_records",
            factType: "latest_deed",
            value: { book: "44110", page: "712", recordedDate: "2023-05-01", firstParty: "Jamie Sample", secondParty: "Estate of Jamie Sample" },
            sourceUrl: "https://county.example.test/official-records/44110-712",
            confidence: 0.88,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "official_records",
            factType: "deed_attachment",
            value: "https://county.example.test/official-records/44110-712.pdf",
            sourceUrl: "https://county.example.test/official-records/44110-712.pdf",
            confidence: 0.88,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
          {
            source: "clerk_of_courts",
            factType: "obituary_link",
            value: "https://obituary.example.test/jamie-sample",
            sourceUrl: "https://obituary.example.test/jamie-sample",
            confidence: 0.82,
            reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
          },
        ],
        sourceSummaries: [],
        blockers: [],
        persistence: { stored: true, readbackStatus: "verified" },
      }),
    });
  });

  await page.route("**/api/exports**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      exportRequests.push(body);
      const index = exportRequests.length;
      const artifactId = `packet-1780000000000-${String(index).padStart(16, "0")}`;
      const contentHash = String(index).repeat(64).slice(0, 64);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      packetArtifacts.set(artifactId, { contentHash });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          flow: body.flow,
          packetRevision: body.packetRevision,
          estateId: body.estateId,
          estateIds: [body.estateId],
          contentType: "application/pdf",
          artifactUrl: `/api/reports/pdf?artifactId=${encodeURIComponent(artifactId)}`,
          sections: [],
          routes: [],
          packetPersistence: [{ estateId: body.estateId, stored: true, readbackStatus: "verified" }],
          artifact: {
            kind: "single_pdf",
            artifactId,
            flow: body.flow,
            estateIds: [body.estateId],
            packetRevision: body.packetRevision,
            contentType: "application/pdf",
            contentHash,
            expiresAt,
            url: `/api/reports/pdf?artifactId=${encodeURIComponent(artifactId)}`,
            sections: [],
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });

  await page.route("**/api/reports/pdf**", async (route) => {
    const url = new URL(route.request().url());
    const artifactId = url.searchParams.get("artifactId");
    const packet = packetArtifacts.get(artifactId);
    if (!packet) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "x-heirright-artifact-id": artifactId,
        "x-heirright-content-hash": packet.contentHash,
      },
      body: packetBytes,
    });
  });

  return { attachmentRequests, docxBytes, extractionRequests, googleDeliveryRequests, sourceRequests, exportRequests, reportBytes, releaseExtraction };
}

test("Document Prep keeps the estate visible, rejects unsupported reports inline, and opens whole rows by mouse and keyboard", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  const attachmentPosts = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/documents/attachments")) attachmentPosts.push(request.url());
  });
  await isolateDocPrepWorkspaceState(page);
  await openWorkspace(page);
  await openDocumentPrep(page);

  const workspace = page.locator('[data-feature="doc-prep"]');
  const run = workspace.locator("[data-run-discovery]");
  const upload = workspace.locator("[data-idi-picker]");
  await expect(run).toBeVisible();
  await expect(upload).toHaveText("Upload IDI Report");
  const [runBox, uploadBox] = await Promise.all([run.boundingBox(), upload.boundingBox()]);
  expect(runBox).not.toBeNull();
  expect(uploadBox).not.toBeNull();
  expect(Math.abs(runBox.y - uploadBox.y)).toBeLessThan(5);
  expect(uploadBox.x).toBeGreaterThan(runBox.x);
  await expect(workspace.locator("[data-docprep-estate-select]")).toHaveValue(await workspace.getAttribute("data-estate-id"));

  const input = workspace.locator("[data-idi-file-input]");
  await expect(input).toHaveAttribute("accept", ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  await chooseReportWithPicker(page, upload, { name: "report.csv", mimeType: "text/csv", buffer: Buffer.from("name,address\nMorgan,121 Probate Way") });
  await expect(workspace.locator("[data-idi-error]")).toContainText("Choose a searchable PDF or DOCX report.");
  await expect(workspace.locator("[data-idi-error]")).toContainText("Choose another file");
  expect(attachmentPosts).toHaveLength(0);

  await chooseReportWithPicker(page, workspace.locator("[data-idi-choose-another]"), {
    name: "operator-report.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("PK\u0003\u0004mock-docx"),
  });
  await expect(workspace.locator("[data-idi-file-review]")).toContainText("operator-report.docx");
  await expect(workspace.locator("[data-idi-submit]")).toHaveText("Upload and run Discovery");
  expect(attachmentPosts).toHaveLength(0);
  await workspace.locator("[data-idi-remove]").click();
  await expect(workspace.locator("[data-idi-file-review]")).toHaveCount(0);

  const closingFlowTab = workspace.locator('[data-docprep-flow="closing-docs"]');
  await closingFlowTab.click();
  await expect(closingFlowTab).toBeFocused();
  const discoveryFlowTab = workspace.locator('[data-docprep-flow="discovery"]');
  await discoveryFlowTab.focus();
  await page.keyboard.press("Enter");
  await expect(discoveryFlowTab).toBeFocused();

  const previouslySelectedDocumentId = await workspace.locator('[data-document-open][aria-current="true"]').first().getAttribute("data-document-open");
  const rowDocumentId = await workspace.locator('[data-document-open][aria-current="false"]').first().getAttribute("data-document-open");
  const previouslySelectedRow = workspace.locator(`[data-document-open="${previouslySelectedDocumentId}"]`);
  const row = workspace.locator(`[data-document-open="${rowDocumentId}"]`);
  await expect(previouslySelectedRow).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("role", "button");
  await expect(row).toHaveAttribute("tabindex", "0");
  await expect(row.locator("button")).toHaveCount(0);
  await expect(row.locator('[data-icon*="eye"], .eye-icon')).toHaveCount(0);

  const rowTitle = (await row.locator("strong").innerText()).trim();
  await row.click();
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-document-preview]")).toBeVisible();
  await expect(page.locator('[data-docprep-rail-panel="document"] h2')).toHaveText(rowTitle);
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(previouslySelectedRow).toHaveAttribute("aria-current", "false");
  await closeUnifiedRail(page);

  await workspace.locator("[data-document-open]").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "false");
  await closeUnifiedRail(page);

  await workspace.locator("[data-document-open]").first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "false");
  await page.setViewportSize({ width: 700, height: 800 });
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("role", "dialog");
  const mobileRailBox = await page.locator("#s38UnifiedRail").boundingBox();
  expect(mobileRailBox.width).toBeGreaterThan(450);
  expect(mobileRailBox.height).toBeGreaterThan(760);
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("a DOCX extraction failure stays inline and Retry reuses the selected report before Discovery starts", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page, { expectedHttpStatuses: [422] });
  await isolateDocPrepWorkspaceState(page);
  const pipeline = await installSuccessfulIdiPipeline(page, { failFirstExtraction: true });
  await openWorkspace(page);
  await openDocumentPrep(page);

  const workspace = page.locator('[data-feature="doc-prep"]');
  await chooseReportWithPicker(page, workspace.locator("[data-idi-picker]"), {
    name: "scanned-then-searchable.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: pipeline.docxBytes,
  });
  await workspace.locator("[data-idi-submit]").click();
  await expect.poll(() => pipeline.extractionRequests.length).toBe(1);
  await expect(workspace.locator("[data-idi-error]")).toContainText("scanned or image-only");
  await expect(workspace.locator("[data-idi-retry]")).toBeVisible();
  await expect(workspace.locator("[data-open-google-settings]")).toBeVisible();
  expect(pipeline.sourceRequests).toHaveLength(0);

  await workspace.locator("[data-idi-retry]").click();
  await expect.poll(() => pipeline.extractionRequests.length).toBe(2);
  expect(pipeline.attachmentRequests[1]).toMatchObject({ fileName: "scanned-then-searchable.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  await expect.poll(() => pipeline.sourceRequests.length).toBe(1);
  await expect(workspace.locator('[data-document-open="idi-asset-search"]')).toContainText("Verified");
  await expect(page.locator('[data-stage="idi-facts-linked"]')).toHaveAttribute("data-state", "complete");
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("the estate captured at upload start owns extraction and Discovery when the operator changes selection mid-request", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await isolateDocPrepWorkspaceState(page);
  const pipeline = await installSuccessfulIdiPipeline(page, { holdFirstExtraction: true });
  await openWorkspace(page);
  await openDocumentPrep(page);

  const workspace = page.locator('[data-feature="doc-prep"]');
  const startingEstateId = await workspace.getAttribute("data-estate-id");
  const otherEstateId = await workspace.locator("[data-docprep-estate-select] option").evaluateAll((options, current) => (
    options.map((option) => option.value).find((value) => value && value !== current)
  ), startingEstateId);
  expect(otherEstateId).toBeTruthy();

  await chooseReportWithPicker(page, workspace.locator("[data-idi-picker]"), {
    name: "estate-bound-report.pdf",
    mimeType: "application/pdf",
    buffer: pipeline.reportBytes,
  });
  await workspace.locator("[data-idi-submit]").click();
  await expect.poll(() => pipeline.extractionRequests.length).toBe(1);
  await workspace.locator("[data-docprep-estate-select]").selectOption(otherEstateId);
  await expect(workspace).toHaveAttribute("data-estate-id", otherEstateId);
  await expect(workspace.locator("[data-docprep-estate-select]")).toBeFocused();
  pipeline.releaseExtraction();
  await expect.poll(() => pipeline.sourceRequests.length).toBe(1);

  expect(pipeline.extractionRequests[0].leadId).toBe(startingEstateId);
  expect(pipeline.extractionRequests[0].assetKey).toBe(pipeline.attachmentRequests[0].estateId);
  await workspace.locator("[data-docprep-estate-select]").selectOption(startingEstateId);
  await expect(workspace).toHaveAttribute("data-estate-id", startingEstateId);
  await expect(workspace.locator("[data-docprep-estate-select]")).toBeFocused();
  await expect(workspace.locator('[data-document-open="idi-asset-search"]')).toContainText("Verified");
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("a verified PDF binds to the selected estate, runs Discovery automatically, completes locally, and replaces the active packet on rerun", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await page.addInitScript(() => {
    window.__heirRightCopiedBrief = "";
    window.__heirRightOpenedUrl = "";
    window.__heirRightClockOffset = 0;
    const browserNow = Date.now.bind(Date);
    Date.now = () => browserNow() + Number(window.__heirRightClockOffset || 0);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__heirRightCopiedBrief = String(value || ""); } },
    });
    window.open = (url = "") => {
      if (url) window.__heirRightOpenedUrl = String(url);
      const location = {};
      Object.defineProperty(location, "href", {
        set: (value) => { window.__heirRightOpenedUrl = String(value || ""); },
      });
      return { opener: null, location, close: () => {} };
    };
  });
  await isolateDocPrepWorkspaceState(page);
  const pipeline = await installSuccessfulIdiPipeline(page);
  await openWorkspace(page);
  await openDocumentPrep(page);

  const workspace = page.locator('[data-feature="doc-prep"]');
  const estateId = await workspace.getAttribute("data-estate-id");
  await chooseReportWithPicker(page, workspace.locator("[data-idi-picker]"), {
    name: "approved-idi-report.pdf",
    mimeType: "application/pdf",
    buffer: pipeline.reportBytes,
  });
  await expect(workspace.locator("[data-idi-file-review]")).toContainText("approved-idi-report.pdf");
  expect(pipeline.attachmentRequests).toHaveLength(0);
  await workspace.locator("[data-idi-submit]").click();

  await expect.poll(() => pipeline.attachmentRequests.length).toBe(1);
  await expect.poll(() => pipeline.extractionRequests.length).toBe(1);
  await expect.poll(() => pipeline.sourceRequests.length).toBe(1);
  expect(pipeline.attachmentRequests[0]).toMatchObject({ documentId: "idi-asset-search", fileName: "approved-idi-report.pdf", contentType: "application/pdf" });
  expect(pipeline.extractionRequests[0]).toMatchObject({ leadId: estateId, provider: "idi" });
  expect(pipeline.extractionRequests[0].assetKey).toBe(pipeline.attachmentRequests[0].estateId);

  await expect(workspace.locator('[data-document-open="idi-asset-search"]')).toContainText("Verified");
  await expect(workspace.locator("[data-idi-file-review]")).toHaveCount(0);
  await expect(page.locator("[data-automation-timeline] [data-stage]")).toHaveCount(7);
  await expect(page.locator('[data-stage="idi-facts-linked"]')).toHaveAttribute("data-state", "complete");
  await expect(workspace.locator("[data-local-packet-complete]"), "Discovery must complete locally even when Google is absent").toBeVisible({ timeout: 30_000 });
  await expect.poll(() => pipeline.exportRequests.length, { timeout: 30_000 }).toBe(1);
  expect(pipeline.exportRequests[0]).toMatchObject({ estateId, flow: "discovery", packetRevision: 1 });

  await workspace.locator('[data-document-open="idi-asset-search"]').click();
  await expect(page.locator('[data-docprep-rail-panel="document"] h2')).toHaveText("IDI Core Report");
  await expect(page.locator("[data-document-preview]")).toContainText("Operator-approved IDI report");
  const idiPopupReady = page.waitForEvent("popup");
  await page.locator('[data-rail-action="open-document"]').click();
  const idiPopup = await idiPopupReady;
  await expect(idiPopup).toHaveURL(/attachmentId=/);
  await idiPopup.close();
  const reportDownloadReady = page.waitForEvent("download");
  await page.locator('[data-rail-action="download-document"]').click();
  const reportDownload = await reportDownloadReady;
  expect(await reportDownload.suggestedFilename()).toContain("approved-idi-report.pdf");
  await page.locator('[data-rail-action="queue-document"]').click();
  await expect(page.locator("#topStatus")).toContainText("added to Queue");
  await closeUnifiedRail(page);

  await workspace.locator("[data-open-completion-actions]").click();
  await expect(page.locator('[data-unified-rail-tab="completion"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-docprep-rail-panel="completion"]')).toContainText("Local packet verified");
  const keepWorkspaceOpen = (route) => route.fulfill({ status: 204 });
  await page.route("**/api/reports/pdf**", keepWorkspaceOpen);
  const packetOpenReady = page.waitForRequest((request) => (
    request.isNavigationRequest() && request.url().includes("/api/reports/pdf?artifactId=")
  ));
  await page.locator('[data-rail-action="open-packet"]').click();
  const packetOpenRequest = await packetOpenReady;
  expect(packetOpenRequest.url()).toMatch(/artifactId=/);
  await page.unroute("**/api/reports/pdf**", keepWorkspaceOpen);
  const packetDownloadReady = page.waitForEvent("download");
  await page.locator('[data-rail-action="download-packet"]').click();
  const packetDownload = await packetDownloadReady;
  expect(await packetDownload.suggestedFilename()).toContain("Estate Discovery");
  await expect(page.locator('[data-rail-action="chatgpt-work"]')).toBeEnabled();
  await expect(page.locator('[data-rail-action="google-settings"]')).toContainText("optional Google setup");
  let chatgptNavigationRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.url().startsWith("https://chatgpt.com/")) chatgptNavigationRequests += 1;
  });
  await page.evaluate(() => { window.__heirRightClockOffset = 8 * 24 * 60 * 60 * 1000; });
  await page.locator('[data-rail-action="chatgpt-work"]').click();
  const expiredPacketRecovery = page.locator("[data-unified-rail-error]");
  await expect(expiredPacketRecovery).toBeVisible();
  await expect(expiredPacketRecovery).toContainText("The ChatGPT Work handoff could not continue");
  expect(chatgptNavigationRequests).toBe(0);
  const keepHeirRightOpen = (route) => route.fulfill({ status: 204 });
  await page.route("https://chatgpt.com/**", keepHeirRightOpen);
  const chatgptOpenReady = page.waitForRequest((request) => (
    request.isNavigationRequest() && request.url().startsWith("https://chatgpt.com/")
  ));
  await page.evaluate(() => {
    window.__heirRightClockOffset = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new DOMException("Clipboard denied", "NotAllowedError"); } },
    });
    Object.defineProperty(document, "execCommand", { configurable: true, value: undefined });
  });
  await expiredPacketRecovery.locator("[data-unified-rail-retry]").click();
  const manualChatgptCopy = page.locator(".chatgpt-work-modal");
  await expect(manualChatgptCopy).toBeVisible();
  await expect(page.locator("#chatgptWorkBriefCopy")).toBeFocused();
  await page.locator("[data-document-modal-layer]").click({ position: { x: 4, y: 4 } });
  await expect(manualChatgptCopy).toBeVisible();
  const manualBrief = await page.locator("#chatgptWorkBriefCopy").inputValue();
  expect(manualBrief).toContain("review-only HeirRight Discovery follow-up");
  expect(manualBrief).toContain("Verified packet:");
  expect(manualBrief).not.toMatch(/raw report|abcdef0123456789abcdef|access token|refresh token/i);
  expect(chatgptNavigationRequests).toBe(0);

  await page.locator("#s38UnifiedRail [data-unified-rail-close]").last().evaluate((control) => control.click());
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "true");
  await manualChatgptCopy.locator(".document-modal-foot [data-close-document-modal]").click();
  await expect(manualChatgptCopy).toBeHidden();
  await expect(page.locator("#topStatus")).toContainText("ChatGPT Work handoff canceled");
  await expect(page.locator("#s38OpenRail")).toBeFocused();

  await workspace.locator("[data-open-completion-actions]").click();
  await expect(page.locator('[data-unified-rail-tab="completion"]')).toHaveAttribute("aria-selected", "true");
  await page.locator('[data-rail-action="chatgpt-work"]').click();
  await expect(manualChatgptCopy).toBeVisible();
  await page.evaluate(() => { window.__heirRightClockOffset = 8 * 24 * 60 * 60 * 1000; });
  await manualChatgptCopy.locator("[data-continue-chatgpt-work]").click();
  await expect(manualChatgptCopy).toBeVisible();
  await expect(manualChatgptCopy.locator("[data-chatgpt-work-error]")).toContainText("expired");
  await expect(page.locator("#topStatus")).toContainText("ChatGPT Work handoff blocked");
  expect(chatgptNavigationRequests).toBe(0);

  await page.evaluate(() => { window.__heirRightClockOffset = 0; });
  await manualChatgptCopy.locator("[data-continue-chatgpt-work]").click();
  await chatgptOpenReady;
  expect(chatgptNavigationRequests).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.__heirRightCopiedBrief = String(value || ""); } },
    });
  });
  const automaticChatgptOpenReady = page.waitForRequest((request) => (
    request.isNavigationRequest() && request.url().startsWith("https://chatgpt.com/")
  ));
  await page.locator('[data-rail-action="chatgpt-work"]').click();
  await automaticChatgptOpenReady;
  expect(chatgptNavigationRequests).toBe(2);
  await page.unroute("https://chatgpt.com/**", keepHeirRightOpen);
  const copiedBrief = await page.evaluate(() => window.__heirRightCopiedBrief);
  expect(copiedBrief).toContain("review-only HeirRight Discovery follow-up");
  expect(copiedBrief).toContain("Verified packet:");
  expect(copiedBrief).not.toMatch(/raw report|abcdef0123456789abcdef|access token|refresh token/i);
  await page.locator('[data-rail-action="google-settings"]').click();
  await expect(page.locator('[data-shell-nav="settings"]')).toHaveClass(/is-active/);
  await page.locator(".shell-rail-close").click();
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#s38OpenRail")).toBeFocused();
  await page.locator('[data-shell-nav="dossiers"]').click();
  await expect(workspace.locator("[data-local-packet-complete]")).toBeVisible();

  await workspace.locator("[data-run-discovery]").click();
  await expect(workspace.locator("[data-docprep-rerun-form]")).toBeVisible();
  await workspace.locator("#hrPacketCorrection").fill("Corrected the probate filing date from the reviewed court record.");
  await workspace.getByRole("button", { name: "Replace active packet" }).click();
  await expect.poll(() => pipeline.sourceRequests.length).toBe(2);
  await expect.poll(() => pipeline.exportRequests.length, { timeout: 30_000 }).toBe(2);
  expect(pipeline.exportRequests[1]).toMatchObject({ estateId, flow: "discovery", packetRevision: 2 });
  await expect(workspace.locator("[data-local-packet-complete]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#topStatus")).toContainText(/run complete|complete in HeirRight/i);
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("a connected operator can recover a failed Google handoff inline and see verified confirmation", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page, { expectedHttpStatuses: [503] });
  await isolateDocPrepWorkspaceState(page);
  const pipeline = await installSuccessfulIdiPipeline(page, { failFirstGoogleDelivery: true, googleConnected: true });
  await openWorkspace(page);
  await openDocumentPrep(page);

  const workspace = page.locator('[data-feature="doc-prep"]');
  await chooseReportWithPicker(page, workspace.locator("[data-idi-picker]"), {
    name: "google-delivery-report.pdf",
    mimeType: "application/pdf",
    buffer: pipeline.reportBytes,
  });
  await workspace.locator("[data-idi-submit]").click();
  await expect(workspace.locator("[data-local-packet-complete]")).toBeVisible({ timeout: 30_000 });
  await page.locator("#s38OpenRail").click();
  await page.locator('[data-unified-rail-tab="actions"]').click();
  const approvePacket = page.locator('[data-rail-action-id="approve-packet"]');
  await expect(approvePacket).toBeEnabled();
  await approvePacket.click();
  await expect(page.locator('[data-rail-action-id="approve-packet"]')).toHaveCount(0);
  await expect(page.locator('#s38UnifiedRailPanel .journey-action-row-completion[role="status"]')).toContainText("Current Packet Approved");
  await closeUnifiedRail(page);
  await workspace.locator("[data-open-completion-actions]").click();
  const delivery = page.locator('[data-rail-action="deliver-google-packet"]');
  await expect(delivery).toBeEnabled();
  await delivery.click();
  await expect.poll(() => pipeline.googleDeliveryRequests.length).toBe(1);
  const recovery = page.locator("[data-unified-rail-error]");
  await expect(recovery).toBeVisible();
  await expect(recovery).toContainText("The approved packet could not be sent");
  await expect(recovery).not.toContainText(/endpoint|stack|token/i);
  await expect(delivery).toBeFocused();
  await recovery.locator("[data-unified-rail-retry]").click();
  await expect.poll(() => pipeline.googleDeliveryRequests.length).toBe(2);
  expect(pipeline.googleDeliveryRequests[0].artifactId).toBeTruthy();
  await expect(page.locator('[data-google-delivery="verified"]')).toContainText("Saved to Google Workspace");
  await expect(page.locator('[data-google-delivery="verified"]')).toContainText("Discovery Packets");
  await expect(page.locator('[data-unified-rail-tab="completion"]')).toBeFocused();
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("Community grids support filtering, keyboard selection and opening, selected-row Queue handoff, removal, pagination, and the preserved Admin forms", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await isolateDocPrepWorkspaceState(page);
  await openWorkspace(page);

  await page.locator('[data-shell-nav="find-estates"]').click();
  const estates = page.locator('[data-operational-grid-view="estates"]');
  const estatesGrid = estates.locator('[data-community-grid="estates"]');
  await expect(estatesGrid.locator(".ag-root")).toBeVisible();
  await expect(estatesGrid.locator(".ag-paging-panel")).toBeVisible();
  const titleHeader = estatesGrid.locator('.ag-header-cell[col-id="title"]');
  await titleHeader.click();
  await expect(titleHeader).toHaveAttribute("aria-sort", "ascending");
  await estatesGrid.locator(".ag-paging-page-size .ag-picker-field-wrapper").click();
  await page.locator(".ag-select-list-item", { hasText: "25" }).click();
  await expect(estatesGrid.locator(".ag-paging-page-size")).toContainText("25");
  const firstRow = estatesGrid.locator(".ag-row").first();
  await expect(firstRow).toBeVisible();
  const firstEstateId = await firstRow.getAttribute("row-id");
  const firstEstateTitle = (await firstRow.locator('[col-id="title"]').innerText()).trim();

  await estates.locator("[data-estate-filters-toggle]").click();
  await expect(estates.locator("#hrEstateFilters")).toBeVisible();
  const firstCounty = (await firstRow.locator('[col-id="county"]').innerText()).trim();
  await estates.locator('[data-estate-filter="county"]').selectOption({ label: firstCounty });
  await expect(estatesGrid.locator(".ag-row").first()).toBeVisible();
  const visibleCounties = await estatesGrid.locator('.ag-row [col-id="county"]').allInnerTexts();
  expect(visibleCounties.every((county) => county.trim() === firstCounty)).toBe(true);
  await estates.locator('[data-estate-filter="priorityOnly"]').check();
  await expect(estates.locator("[data-estate-filter-count]")).toHaveText("2");
  await estates.locator("[data-estate-filters-clear]").click();

  await estates.locator("[data-grid-quick-filter]").fill(firstEstateTitle);
  await expect(estatesGrid.locator(".ag-row")).toHaveCount(1);
  await firstRow.locator('[col-id="title"]').click();
  await page.locator('[data-shell-nav="dossiers"]').click();
  await expect(page.locator('[data-feature="doc-prep"]')).toHaveAttribute("data-estate-id", firstEstateId);
  await page.locator('[data-shell-nav="find-estates"]').click();
  await expect(estatesGrid.locator(".ag-row")).toHaveCount(1);
  await expect(estates.locator("[data-estates-selection-assist]")).toBeHidden();
  await firstRow.locator(".ag-selection-checkbox").click();
  await expect(estates.locator("[data-estates-selection-assist]")).toBeVisible();
  await expect(estates.locator("[data-estates-add-queue]")).toHaveText("Add estate to Queue");
  await estates.locator("[data-estates-add-queue]").click();
  await expect(estates.locator("[data-grid-status]")).toContainText("1 estate added to Queue");

  await page.locator('[data-shell-nav="queue"]').click();
  const queue = page.locator('[data-operational-grid-view="queue"]');
  const queuedRow = queue.locator(`[data-community-grid="queue"] .ag-row[row-id="${firstEstateId}"]`);
  await expect(queuedRow).toBeVisible();
  await expect(queue.locator(".ag-paging-panel")).toBeVisible();
  await queuedRow.locator(".ag-cell").first().focus();
  await page.keyboard.press("Space");
  await expect(queue.locator("[data-grid-selection-count]")).toHaveText("1 selected");
  await queuedRow.locator(".ag-cell").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-feature="doc-prep"]')).toHaveAttribute("data-estate-id", firstEstateId);
  await page.locator('[data-shell-nav="queue"]').click();
  await expect(queuedRow).toBeVisible();
  await queuedRow.getByRole("button", { name: `Remove ${firstEstateTitle} from Queue` }).click();
  await expect(queuedRow).toHaveCount(0);

  await page.locator('[data-shell-nav="find-estates"]').click();
  await estates.locator("[data-grid-quick-filter]").fill("");
  const keyboardRow = estatesGrid.locator(".ag-row").first();
  const keyboardEstateId = await keyboardRow.getAttribute("row-id");
  const selectionBeforeSpace = await estates.locator("[data-estates-add-queue]").textContent();
  await keyboardRow.locator(".ag-cell").first().focus();
  await page.keyboard.press("Space");
  await expect.poll(() => estates.locator("[data-estates-add-queue]").textContent()).not.toBe(selectionBeforeSpace);
  await keyboardRow.locator(".ag-cell").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-feature="doc-prep"]')).toHaveAttribute("data-estate-id", keyboardEstateId);

  await page.locator('[data-shell-nav="admin"]').click();
  await expect(page.locator("[data-admin-support-form]")).toBeVisible();
  await expect(page.locator("[data-admin-access-form]")).toBeVisible();
  await expect(page.locator('[data-community-grid="admin-audit"] .ag-root')).toBeVisible();
  await expect(page.locator('[data-community-grid="admin-audit"] .ag-paging-panel')).toBeVisible();
  const firstAuditCell = page.locator('[data-community-grid="admin-audit"] .ag-row .ag-cell').first();
  await firstAuditCell.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-community-grid="admin-audit"]')).toContainText("Audit event reviewed");
  await page.locator(".hr-admin-audit [data-grid-quick-filter]").fill("Audit event reviewed");
  await expect(page.locator('[data-community-grid="admin-audit"] .ag-row')).toHaveCount(1);
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});
