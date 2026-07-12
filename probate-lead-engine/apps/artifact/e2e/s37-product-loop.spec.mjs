import { expect, test } from "@playwright/test";

function watchBrowserFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return failures;
}

async function openWorkspace(page) {
  await page.goto("/");
  await expect(page.locator('[data-shell-nav="find-estates"]')).toBeVisible();
  await expect(page.locator("#authGate")).toBeHidden();
}

test("estate identity, Queue handoff, removal, and primary navigation stay coherent", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await openWorkspace(page);

  await page.locator('[data-shell-nav="find-estates"]').click();
  await page.locator("#evidenceFilter").selectOption("0", { force: true });
  await expect(page.locator("#resultsBody [data-row-id]")).toHaveCount(7);
  await expect(page.locator('#resultsBody [data-row-id="estate"]')).toHaveCount(1);
  await expect(page.locator('#resultsBody [data-row-id^="demo-estate-"]')).toHaveCount(6);

  await page.locator('[data-add-row-to-queue="demo-estate-003"]').click();
  await page.locator('[data-shell-nav="queue"]').click();
  await expect(page.locator('[data-queue-remove="demo-estate-003"]')).toBeVisible();
  await expect(page.locator("[data-queue-export]")).toBeEnabled();
  await page.locator('[data-queue-remove="demo-estate-003"]').click();
  await expect(page.locator(".queue-list").getByText("No leads queued", { exact: true })).toBeVisible();
  await expect(page.locator("[data-queue-export]")).toBeDisabled();

  const panels = {
    dashboard: "#dashboardView",
    dossiers: "#dossiersView",
    drips: "#dripsView",
    queue: "#queueView",
    admin: "#adminView",
    settings: "#settingsView",
    "help-demos": "#helpDemosView"
  };
  for (const [view, panel] of Object.entries(panels)) {
    await page.locator(`[data-shell-nav="${view}"]`).click();
    await expect(page.locator(`[data-shell-nav="${view}"]`)).toHaveClass(/is-active/);
    await expect(page.locator(panel)).toBeVisible();
  }
  await page.locator('[data-shell-nav="find-estates"]').click();
  await expect(page.locator('.workbench-body[data-view-panel="find-estates"]')).toBeVisible();

  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("Full Discovery invokes source orchestration before streaming packet sections", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  const sourceRequests = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/discovery/external-source-run") && request.method() === "POST") {
      sourceRequests.push(request.postDataJSON());
    }
  });

  await openWorkspace(page);
  await page.locator('[data-shell-nav="dossiers"]').click();
  await page.locator('[data-dossier-row="estate"]').click();
  const runButton = page.locator('#dossiersView [data-docprep-main-run="discovery"]');
  await expect(runButton).toBeVisible();
  await runButton.click();
  await expect(page.locator('[data-docprep-stream-flow="discovery"]')).toBeVisible();
  await expect.poll(() => sourceRequests.length, { timeout: 60_000 }).toBe(1);
  expect(sourceRequests[0].operatorIntent).toBe("run_external_source_search");
  expect(sourceRequests[0].seed.propertyAddress).toContain("20611 NW 33rd Pl");
  expect(sourceRequests[0].seed.ownerName).toBeTruthy();

  const activeChip = page.locator('[data-docprep-section-jump][aria-selected="true"]');
  const before = await activeChip.getAttribute("data-docprep-section-jump");
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(async () => activeChip.getAttribute("data-docprep-section-jump")).not.toBe(before);
  const afterDown = await activeChip.getAttribute("data-docprep-section-jump");
  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(async () => activeChip.getAttribute("data-docprep-section-jump")).not.toBe(afterDown);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
    { width: 1110, height: 627 }
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const rail = document.querySelector("#researchRail");
      const preview = document.querySelector("[data-docprep-stream]");
      const documentPanel = document.querySelector("[data-docprep-stream-document]");
      const workspace = document.querySelector(".workspace");
      const app = document.querySelector(".app");
      const content = document.querySelector(".content");
      const workbench = document.querySelector(".workbench");
      const dossiersView = document.querySelector("#dossiersView");
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
        railClientWidth: rail?.clientWidth || 0,
        railScrollWidth: rail?.scrollWidth || 0
      };
    });
    expect(geometry.pageScrollWidth).toBeLessThanOrEqual(geometry.pageClientWidth);
    expect(geometry.railScrollWidth).toBeLessThanOrEqual(geometry.railClientWidth);
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
  await page.locator('[data-shell-nav="dossiers"]').click();
  await page.locator('[data-dossier-row="estate"]').click();
  const documentRow = page.locator("[data-document-row]").first();
  await expect(documentRow).toBeVisible();
  await documentRow.locator("[data-ui-menu-button]").click();
  await documentRow.locator('[data-ui-menu-action="replace"]').click();
  await expect(page.locator("[data-document-modal-layer]")).toBeVisible();

  await page.locator("[data-save-document-file]").click();
  await expect(page.locator("#topStatus")).toContainText("Choose a supporting document");
  await expect(documentRow).not.toHaveClass(/is-linked/);

  await page.locator("#documentFileInput").setInputFiles({
    name: "tax-receipt.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes
  });
  await page.locator("[data-save-document-file]").click();
  await expect(page.locator("[data-document-modal-layer]")).toHaveCount(0);
  await expect(documentRow).toHaveClass(/is-linked/);
  await expect(page.locator("#topStatus")).toContainText("passed backend storage and artifact readback");
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});
