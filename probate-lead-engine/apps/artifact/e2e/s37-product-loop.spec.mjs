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
      const box = (element) => {
        const rect = element?.getBoundingClientRect();
        return rect ? { left: rect.left, right: rect.right, width: rect.width } : null;
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
