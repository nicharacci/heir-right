import { expect, test } from "@playwright/test";

function watchBrowserFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      const source = location.url ? ` (${location.url}:${location.lineNumber}:${location.columnNumber})` : "";
      failures.push(`console: ${message.text()}${source}`);
    }
  });
  return failures;
}

async function openWorkspace(page) {
  await page.route("**/api/google-workspace/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ connected: false }),
  }));
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("heirright:guided-walkthrough-seen", "true"));
  await expect.poll(() => page.locator("html").getAttribute("data-server-hydrated")).not.toBeNull();
  const walkthroughClose = page.locator("[data-walkthrough-close]");
  if (await walkthroughClose.isVisible().catch(() => false)) await walkthroughClose.click();
  await expect(page.locator('[data-shell-nav="find-estates"]')).toBeVisible();
  await expect(page.locator("#authGate")).toBeHidden();
}

async function expectVisibleButtonsNamed(page, root = "body") {
  const unnamed = await page.locator(`${root} button:visible`).evaluateAll((buttons) => buttons
    .filter((button) => !button.disabled)
    .filter((button) => {
      const labelledBy = button.getAttribute("aria-labelledby");
      const labelledText = labelledBy
        ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim()
        : "";
      return !(button.getAttribute("aria-label") || button.title || labelledText || button.textContent?.trim());
    })
    .map((button) => button.outerHTML.slice(0, 240)));
  expect(unnamed, `Visible buttons without an accessible name:\n${unnamed.join("\n")}`).toEqual([]);
}

async function expectNoDeveloperLanguage(page) {
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(/\b(?:JSON|payload|adapter|schema|endpoint|CLI|TypeScript|environment variable)\b/i);
}

async function isolateDocPrepWorkspaceState(page) {
  const keys = new Set([
    "heirright:docprep-estate-state",
    "heirright:discovery-workflow-state",
    "heirright:source-capture-state",
    "heirright:idi-asset-imports",
    "heirright:contact-review-state",
    "heirright:document-files-state"
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
}

async function installEmptyCanonicalDocPrepReadbacks(page, { attachments = false } = {}) {
  await page.route("**/api/discovery/idi-asset-search/import?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, exists: false }),
  }));
  await page.route("**/api/discovery/file?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, exists: false, readbackStatus: "not_found" }),
  }));
  if (attachments) {
    await page.route("**/api/documents/attachments?**", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, attachments: [] }),
    }));
  }
}

async function openEstateInDocumentPrep(page, estateId) {
  await page.locator('[data-shell-nav="find-estates"]').click();
  const row = page.locator(`[data-community-grid="estates"] .ag-row[row-id="${estateId}"]`);
  await expect(row).toBeVisible();
  const titleCell = row.locator('.ag-cell[col-id="title"]');
  await titleCell.focus();
  await page.keyboard.press("Enter");
  const workspace = page.locator('[data-feature="doc-prep"]');
  await expect(workspace).toBeVisible();
  await expect(workspace).toHaveAttribute("data-estate-id", estateId);
  return workspace;
}

test("estate identity, Queue handoff, removal, and primary navigation stay coherent", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await openWorkspace(page);

  await page.locator('[data-shell-nav="find-estates"]').click();
  const estates = page.locator('[data-operational-grid-view="estates"]');
  const estatesGrid = estates.locator('[data-community-grid="estates"]');
  await expect(estatesGrid.locator(".ag-root")).toBeVisible();
  await expect(estatesGrid.locator(".ag-row")).toHaveCount(7);
  await expect(estatesGrid.locator('.ag-row[row-id="estate"]')).toHaveCount(1);
  await expect(estatesGrid.locator('.ag-row[row-id^="demo-estate-"]')).toHaveCount(6);

  const estateTitle = (await estatesGrid.locator('.ag-row[row-id="demo-estate-003"] [col-id="title"]').innerText()).trim();
  await expect(estates.locator("[data-estates-selection-assist]")).toBeHidden();
  await estatesGrid.locator('.ag-row[row-id="demo-estate-003"] .ag-selection-checkbox').click();
  await expect(estates.locator("[data-estates-selection-assist]")).toBeVisible();
  await expect(estates.locator("[data-estates-add-queue]")).toHaveText("Add estate to Queue");
  await estates.locator("[data-estates-add-queue]").click();
  await expect(estates.locator("[data-grid-status]")).toContainText("1 estate added to Queue");
  await page.locator('[data-shell-nav="queue"]').click();
  const queue = page.locator('[data-operational-grid-view="queue"]');
  const queuedRow = queue.locator('[data-community-grid="queue"] .ag-row[row-id="demo-estate-003"]');
  await expect(queuedRow).toBeVisible();
  await queuedRow.locator(".ag-cell").first().focus();
  await page.keyboard.press("Space");
  await expect(queue.locator("[data-grid-selection-count]")).toHaveText("1 selected");
  await expect(queue.locator("[data-queue-export]")).toBeEnabled();
  await queuedRow.getByRole("button", { name: `Remove ${estateTitle} from Queue` }).click();
  await expect(queuedRow).toHaveCount(0);
  await expect(queue.getByText("No estates are queued yet.", { exact: true })).toBeVisible();
  await expect(queue.locator("[data-queue-export]")).toBeDisabled();

  const panels = {
    dashboard: "#dashboardView",
    dossiers: '[data-feature="doc-prep"]',
    drips: "#dripsView",
    queue: '[data-operational-grid-view="queue"]',
    admin: "#adminView",
    settings: "#settingsView",
    "help-demos": "#helpDemosView"
  };
  for (const [view, panel] of Object.entries(panels)) {
    await page.locator(`[data-shell-nav="${view}"]`).click();
    await expect(page.locator(`[data-shell-nav="${view}"]`)).toHaveClass(/is-active/);
    await expect(page.locator(panel)).toBeVisible();
    await expectNoDeveloperLanguage(page);
  }
  await page.locator('[data-shell-nav="find-estates"]').click();
  await expect(page.locator('[data-operational-grid-view="estates"]')).toBeVisible();
  await expectNoDeveloperLanguage(page);

  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("Full Discovery invokes source orchestration before streaming packet sections", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  const sourceRequests = [];
  const sourceResponses = [];
  await isolateDocPrepWorkspaceState(page);
  await installEmptyCanonicalDocPrepReadbacks(page, { attachments: true });
  await page.route("**/api/discovery/external-source-run", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      mode: "external_source_run",
      generatedAt: new Date().toISOString(),
      sourceFacts: [],
      sourceSummaries: [],
      blockers: ["Browserbase billing is required before the Tax Collector browser function can start."],
      persistence: { readbackStatus: "verified" },
    }),
  }));
  page.on("request", (request) => {
    if (request.url().includes("/api/discovery/external-source-run") && request.method() === "POST") {
      sourceRequests.push(request.postDataJSON());
    }
  });
  page.on("response", async (response) => {
    if (response.url().includes("/api/discovery/external-source-run") && response.request().method() === "POST") {
      sourceResponses.push({ status: response.status(), body: await response.json().catch(() => ({})) });
    }
  });

  await openWorkspace(page);
  const workspace = await openEstateInDocumentPrep(page, "estate");
  const displayedAddress = (await workspace.locator(".hr-docprep-title > p:last-child").innerText()).split(" - ")[0].trim();
  const runButton = workspace.locator("[data-run-discovery]");
  await expect(runButton).toBeVisible();
  await runButton.click();
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator('[data-unified-rail-tab="automation"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-automation-timeline]")).toBeVisible();
  await expect.poll(() => sourceRequests.length, { timeout: 60_000 }).toBe(1);
  expect(sourceRequests[0].operatorIntent).toBe("run_external_source_search");
  expect(sourceRequests[0].seed.propertyAddress).toBe(displayedAddress);
  expect(sourceRequests[0].seed.ownerName).toBeTruthy();
  await expect.poll(() => sourceResponses.length, { timeout: 60_000 }).toBe(1);
  expect(sourceResponses[0].status).toBe(200);
  expect(sourceResponses[0].body.persistence?.readbackStatus).toBe("verified");
  await expect(page.locator("[data-automation-timeline] [data-stage]")).toHaveCount(7);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1110, height: 627 }
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.locator("#s38UnifiedRail").evaluate((element) => getComputedStyle(element).transform))
      .toMatch(/^(?:none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    const geometry = await page.evaluate(() => {
      const rail = document.querySelector("#s38UnifiedRail");
      const railContent = document.querySelector("#s38UnifiedRailPanel");
      const preview = document.querySelector("[data-automation-timeline]");
      const documentPanel = document.querySelector('[data-feature="doc-prep"]');
      const workspace = document.querySelector(".workspace");
      const app = document.querySelector(".app");
      const content = document.querySelector(".content");
      const workbench = document.querySelector(".workbench");
      const dossiersView = document.querySelector('[data-feature="doc-prep"]');
      const box = (element) => {
        const rect = element?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
      };
      const styles = (element) => {
        if (!element) return null;
        const computed = getComputedStyle(element);
        return {
          width: computed.width,
          maxWidth: computed.maxWidth,
          paddingRight: computed.paddingRight,
          transform: computed.transform,
          transition: computed.transition,
          gridColumn: computed.gridColumn,
          justifySelf: computed.justifySelf
        };
      };
      return {
        viewportWidth: window.innerWidth,
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        pageScrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        rail: box(rail),
        preview: box(preview),
        documentPanel: box(documentPanel),
        owners: {
          workspace: box(workspace),
          app: box(app),
          content: box(content),
          workbench: box(workbench),
          dossiersView: box(dossiersView)
        },
        styles: {
          rail: styles(rail),
          dossiersView: styles(dossiersView)
        },
        railContentClientWidth: railContent?.clientWidth || 0,
        railContentScrollWidth: railContent?.scrollWidth || 0
      };
    });
    expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.pageClientWidth);
    expect(geometry.railContentScrollWidth).toBeLessThanOrEqual(geometry.railContentClientWidth);
    for (const [name, box] of Object.entries({ rail: geometry.rail, preview: geometry.preview, documentPanel: geometry.documentPanel })) {
      expect(box).not.toBeNull();
      expect(box.left).toBeGreaterThanOrEqual(-1);
      expect(box.right, `${name}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    }
    if (viewport.height === 627) expect(geometry.pageScrollHeight).toBeGreaterThan(geometry.viewportHeight);
  }

  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("supporting documents stay incomplete until backend artifact readback passes", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  const artifactId = "supporting-1780000000000-0123456789abcdef";
  const contentHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

  await isolateDocPrepWorkspaceState(page);
  await installEmptyCanonicalDocPrepReadbacks(page);

  await page.route("**/api/documents/attachments**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      expect(body.dataBase64).toBeTruthy();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          attachment: {
            id: artifactId,
            estateId: body.estateId,
            documentId: body.documentId,
            fileName: body.fileName,
            contentType: "application/pdf",
            size: pdfBytes.byteLength,
            contentHash,
            createdAt: new Date().toISOString(),
            uploadedBy: "operator@heirright.com",
            artifactUrl: `/api/documents/attachments?attachmentId=${artifactId}`,
            readbackStatus: "verified"
          }
        })
      });
      return;
    }
    if (url.searchParams.get("attachmentId") === artifactId) {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "x-heirright-artifact-id": artifactId,
          "x-heirright-content-hash": contentHash
        },
        body: pdfBytes
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, attachments: [] }) });
  });

  await openWorkspace(page);
  const workspace = await openEstateInDocumentPrep(page, "demo-estate-001");
  const documentRow = workspace.locator('[data-document-open]:not([data-document-open="idi-asset-search"])').first();
  await expect(documentRow).toBeVisible();
  await expect(documentRow).not.toHaveAttribute("data-state", "complete");
  const documentId = await documentRow.getAttribute("data-document-open");
  await documentRow.click();
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toHaveAttribute("aria-selected", "true");
  const preview = page.locator("[data-document-preview]");
  await expect(preview).toBeVisible();
  expect(await preview.locator("script, iframe, object, embed, form").count()).toBe(0);
  expect(await preview.locator("*[onload], *[onclick], *[srcdoc]").count()).toBe(0);
  const previewGeometry = await page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { width: rect.width, left: rect.left, right: rect.right } : null;
    };
    return { rail: box("#s38UnifiedRail"), document: box(".hr-document-row[aria-current='true']") };
  });
  expect(previewGeometry.rail?.width).toBeGreaterThanOrEqual(340);
  expect(previewGeometry.rail?.width).toBeLessThanOrEqual(480);
  expect(previewGeometry.document?.width).toBeGreaterThan(420);
  await page.locator('[data-rail-action="replace-document"]').click();
  await expect(page.locator("[data-document-modal-layer]")).toBeVisible();

  await page.locator("[data-save-document-file]").click();
  await expect(page.locator("#topStatus")).toContainText("Choose a supporting document");
  await expect(workspace.locator(`[data-document-open="${documentId}"]`)).not.toHaveAttribute("data-state", "complete");

  await page.locator("#documentFileInput").setInputFiles({
    name: "tax-receipt.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes
  });
  await page.locator("[data-save-document-file]").click();
  await expect(page.locator("[data-document-modal-layer]")).toHaveCount(0);
  await expect(workspace.locator(`[data-document-open="${documentId}"]`)).toHaveAttribute("data-state", "complete");
  await expect(workspace.locator(`[data-document-open="${documentId}"]`)).toContainText("Verified");
  await expect(page.locator("#topStatus")).toContainText("passed backend storage and artifact readback");
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("IDI report upload verifies a report artifact, extracts it, and starts one Discovery run", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  const artifactId = "supporting-1780000000000-0123456789abcdea";
  const contentHash = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
  const attachmentRequests = [];
  const extractionRequests = [];
  const sourceRequests = [];

  await page.route("**/api/documents/attachments**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      attachmentRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          attachment: {
            id: artifactId,
            artifactId,
            estateId: body.estateId,
            documentId: body.documentId,
            fileName: body.fileName,
            contentType: "application/pdf",
            size: pdfBytes.byteLength,
            contentHash,
            createdAt: new Date().toISOString(),
            uploadedBy: "operator@heirright.com",
            artifactUrl: `/api/documents/attachments?attachmentId=${artifactId}`,
            readbackStatus: "verified"
          }
        })
      });
      return;
    }
    if (url.searchParams.get("attachmentId") === artifactId) {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "x-heirright-artifact-id": artifactId,
          "x-heirright-content-hash": contentHash
        },
        body: pdfBytes
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, attachments: [] }) });
  });
  await page.route("**/api/discovery/idi-asset-search/extract", async (route) => {
    const body = route.request().postDataJSON();
    extractionRequests.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        attachment: body.attachment,
        duplicateGuard: "first_import_only",
        candidates: [{
          id: "idi-browser-proof-1",
          name: "Avery QA Fixture",
          relationship: "spouse",
          reviewStatus: "auto_accepted_high_confidence",
          sourceLocator: { kind: "page", index: 2, label: "PDF page 2" }
        }]
      })
    });
  });
  await page.route("**/api/discovery/external-source-run", async (route) => {
    sourceRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "external_source_run",
        generatedAt: new Date().toISOString(),
        sourceFacts: [],
        sourceSummaries: [],
        blockers: ["Browserbase billing is required before the Tax Collector browser function can start."],
        persistence: { readbackStatus: "verified" }
      })
    });
  });
  await isolateDocPrepWorkspaceState(page);
  await installEmptyCanonicalDocPrepReadbacks(page);

  await openWorkspace(page);
  const workspace = await openEstateInDocumentPrep(page, "estate");
  await expect(workspace.locator(".hr-docprep-title h1")).toContainText(/Jamie Sample/i);
  const uploadControl = workspace.locator("[data-idi-picker]");
  const mainRun = workspace.locator("[data-run-discovery]");
  await expect(uploadControl).toBeVisible();
  await expect(mainRun).toBeVisible();
  await expect(uploadControl).toHaveText("Upload IDI Report");
  await uploadControl.scrollIntoViewIfNeeded();
  await mainRun.scrollIntoViewIfNeeded();
  const [uploadBox, mainRunBox] = await Promise.all([uploadControl.boundingBox(), mainRun.boundingBox()]);
  expect(uploadBox).not.toBeNull();
  expect(mainRunBox).not.toBeNull();
  expect(Math.abs(uploadBox.y - mainRunBox.y)).toBeLessThan(5);
  expect(uploadBox.x).toBeLessThan(mainRunBox.x);
  await expect(uploadControl).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(uploadControl).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");

  await workspace.locator("[data-idi-file-input]").setInputFiles({
    name: "idi-browser-proof.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes
  });
  await expect(workspace.locator("[data-idi-file-review]")).toContainText("idi-browser-proof.pdf");
  await workspace.locator("[data-idi-submit]").click();
  await expect.poll(() => attachmentRequests.length).toBe(1);
  await expect.poll(() => extractionRequests.length).toBe(1);
  await expect.poll(() => sourceRequests.length).toBe(1);
  await expect(workspace.locator(".hr-docprep-title h1")).toContainText(/Jamie Sample/i);
  expect(attachmentRequests[0]).toMatchObject({ documentId: "idi-asset-search", fileName: "idi-browser-proof.pdf", contentType: "application/pdf" });
  expect(extractionRequests[0]).toMatchObject({ provider: "idi", attachment: { artifactId, contentHash } });
  expect(sourceRequests[0].operatorIntent).toBe("run_external_source_search");
  await expect(workspace.locator('[data-document-open="idi-asset-search"]')).toContainText("Verified");
  await expect(page.locator("[data-automation-timeline]")).toBeVisible();
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("operator rails, settings, Outreach, imports, and walkthrough controls complete their visible loops", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await openWorkspace(page);

  const rail = page.locator("#s38UnifiedRail");
  const railLayer = page.locator(".shell-unified-rail-layer");
  const openRail = page.locator("#s38OpenRail");
  await openRail.click();
  await expect(openRail).toHaveAttribute("aria-expanded", "true");
  await expect(railLayer).toHaveAttribute("data-open", "true");
  await expect(rail).toHaveAttribute("aria-hidden", "false");
  await page.locator('[data-unified-rail-tab="activity"]').click();
  await expect(page.locator('[data-unified-rail-tab="activity"]')).toHaveAttribute("aria-selected", "true");
  await rail.locator("[data-unified-rail-close]").click();
  await expect(rail).toHaveAttribute("aria-hidden", "true");
  await expect(openRail).toHaveAttribute("aria-expanded", "false");
  await expect(openRail).toBeFocused();

  const commandToggle = page.locator("#commandDrawerToggle");
  await page.locator(".shell-composer").hover();
  await expect(commandToggle).toBeVisible();
  await commandToggle.click();
  await expect(commandToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#commandDrawerPanel")).toHaveAttribute("aria-hidden", "false");
  await expect.poll(() => page.locator("#commandDrawerPanel").evaluate((element) => element.inert)).toBe(false);
  await expect(page.locator("#commandInput")).toBeFocused();
  await page.locator("#commandDrawerClose").click();
  await expect(commandToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#commandDrawerPanel")).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.locator("#commandDrawerPanel").evaluate((element) => element.inert)).toBe(true);
  await expect(commandToggle).toBeFocused();

  await page.locator('[data-shell-nav="find-estates"]').click();
  await expect(page.locator('[data-shell-nav="find-estates"]')).toHaveAttribute("aria-current", "page");
  await page.locator("#crmImportSingle").click();
  await expect(page.locator("[data-crm-import-layer]")).toBeVisible();
  await expect(page.locator('[data-crm-import-form][role="dialog"]')).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#crmImportTitle")).toHaveText("Import estate into DocPrep");
  await page.locator("[data-close-crm-import]").first().click();
  await expect(page.locator("[data-crm-import-layer]")).toHaveCount(0);
  await page.locator("#crmImportBatchToggle").click();
  await expect(page.locator("#crmImportMenu")).toHaveAttribute("data-open", "true");
  await expect(page.locator("#crmImportBatchToggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#crmImportPopover")).toBeVisible();
  await page.locator('[data-crm-batch-import="csv"]').click();
  await expect(page.locator("[data-crm-import-layer]")).toBeVisible();
  await expect(page.locator("#crmImportTitle")).toHaveText("Batch import estates");
  await expect(page.locator('[data-crm-import-form] input[name="mode"]')).toHaveValue("batch");
  await expect(page.locator("#crmImportProvider")).toHaveValue("csv");
  await page.locator("[data-close-crm-import]").last().click();
  await expect(page.locator("[data-crm-import-layer]")).toHaveCount(0);

  await page.locator('[data-shell-nav="settings"]').click();
  await expect(page.locator('[data-shell-nav="settings"]')).toHaveAttribute("aria-current", "page");
  for (const tab of ["access", "integrations", "sources", "outreach", "audit", "preferences"]) {
    await page.locator(`[data-settings-tab="${tab}"]`).click();
    await expect(page.locator(`[data-settings-tab="${tab}"]`)).toHaveAttribute("aria-pressed", "true");
    await expectVisibleButtonsNamed(page, "#settingsView");
  }
  await expect(page.locator("#s38SettingsThemeMount .shell-theme-control")).toHaveCount(1);

  await page.locator('[data-shell-nav="drips"]').click();
  await expect(page.locator('[data-shell-nav="drips"]')).toHaveAttribute("aria-current", "page");
  await page.locator('[data-outreach-side-tab="preferences"]').click();
  await expect(page.locator('[data-outreach-side-tab="preferences"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-outreach-side-tab="variables"]').click();
  await expect(page.locator('[data-outreach-side-tab="variables"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-new-template="sms"]').click();
  await expect(page.locator("#outreachTemplateModalMount [role=dialog]")).toBeVisible();
  await expect(page.locator("#outreachTemplateModalMount [role=dialog]")).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#outreachTemplateTitle")).toHaveText("New SMS Template");
  await expectVisibleButtonsNamed(page, "#outreachTemplateModalMount");
  await page.locator("[data-close-outreach-template]").first().click();
  await expect(page.locator("#outreachTemplateModalMount [role=dialog]")).toHaveCount(0);

  await page.locator('[data-shell-nav="help-demos"]').click();
  await expect(page.locator('[data-shell-nav="help-demos"]')).toHaveAttribute("aria-current", "page");
  for (const tab of ["docprep", "export", "admin"]) {
    await page.locator(`[data-help-demo-tab="${tab}"]`).click();
    await expect(page.locator(`[data-help-demo-tab="${tab}"]`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#helpDemosView [data-help-demo-card]").first()).toBeVisible();
  }
  await page.locator('[data-help-demo-card="settings-readiness"]').click();
  const walkthrough = page.locator(".walkthrough-popover");
  await expect(walkthrough).toBeVisible();
  await expect(walkthrough).toHaveAttribute("role", "dialog");
  await expect(page.locator(".walkthrough-step-count")).toHaveText("1 / 3");
  await page.locator("[data-walkthrough-next]").click();
  await expect(page.locator(".walkthrough-step-count")).toHaveText("2 / 3");
  await page.locator("[data-walkthrough-next]").click();
  await expect(page.locator(".walkthrough-step-count")).toHaveText("3 / 3");
  await expect(page.locator("[data-walkthrough-next]")).toHaveText("Done");
  await page.locator("[data-walkthrough-next]").click();
  await expect(walkthrough).toHaveCount(0);

  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});
