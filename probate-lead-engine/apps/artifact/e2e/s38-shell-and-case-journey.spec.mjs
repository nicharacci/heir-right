import { expect, test } from "@playwright/test";

function watchBrowserFailures(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  return failures;
}

async function openWorkspace(page, url = "/") {
  await page.route("**/api/google-workspace/status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ connected: false }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem("heirright:guided-walkthrough-seen", "true");
  });
  await page.goto(url);
  await expect.poll(() => page.locator("html").getAttribute("data-server-hydrated")).not.toBeNull();
  const walkthroughClose = page.locator("[data-walkthrough-close]");
  if (await walkthroughClose.isVisible().catch(() => false)) await walkthroughClose.click();
  await expect(page.locator("#authGate")).toBeHidden();
  await expect(page.locator('[data-shell-nav="dashboard"]')).toBeVisible();
  await expect(page.locator("#workspace")).toHaveAttribute("data-s38-shell", "case-journey");
}

async function expectNoDeveloperLanguage(page) {
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toMatch(/\b(?:JSON|payload|adapter|schema|endpoint|CLI|TypeScript|environment variable)\b/i);
}

function cssTimeListInSeconds(value) {
  return value.split(",").map((entry) => {
    const token = entry.trim();
    const amount = Number.parseFloat(token);
    return token.endsWith("ms") ? amount / 1000 : amount;
  });
}

test("Dashboard starts the operator in one persistent shell and Case Journey", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWorkspace(page);

  await expect(page.locator('[data-shell-nav="dashboard"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("#dashboardView .case-dashboard")).toBeVisible();
  await expect(page.locator(".dashboard-disposition strong")).toContainText(/Move Forward|Review|Blocked|Move On/);
  await expect(page.locator(".case-lifecycle-stage")).toHaveCount(7);
  await expect(page.locator(".case-lifecycle")).toContainText("Title & Tax");
  await expect(page.locator(".case-lifecycle")).toContainText("Probate & Heirs");

  const queueNav = page.locator('[data-shell-nav="queue"]');
  await expect(queueNav).not.toHaveClass(/is-active/);
  await queueNav.hover();
  const queueHoverStyles = await queueNav.evaluate((element) => {
    const control = getComputedStyle(element);
    const icon = getComputedStyle(element.querySelector(".nav-icon"));
    return {
      backgroundColor: control.backgroundColor,
      borderTopWidth: control.borderTopWidth,
      boxShadow: control.boxShadow,
      iconFilter: icon.filter,
    };
  });
  expect(queueHoverStyles).toEqual({
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderTopWidth: "0px",
    boxShadow: "none",
    iconFilter: expect.stringMatching(/^drop-shadow\(/),
  });

  const search = page.locator("#globalSearch");
  await search.fill("estate");
  const firstSearchResult = page.locator("[data-search-open]").first();
  await expect(firstSearchResult).toBeVisible();
  await firstSearchResult.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-shell-nav="find-estates"]')).toHaveAttribute("aria-current", "page");
  await search.fill("");
  await page.locator('[data-shell-nav="dashboard"]').click();

  const commandToggle = page.locator("#commandDrawerToggle");
  const commandPanel = page.locator("#commandDrawerPanel");
  const commandInput = page.locator("#commandInput");
  expect(await page.evaluate(() => matchMedia("(hover: hover) and (pointer: fine)").matches)).toBe(true);
  await expect.poll(() => commandToggle.evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }))).toEqual({ opacity: "0", pointerEvents: "none" });
  await page.locator(".shell-composer").hover();
  await expect.poll(() => commandToggle.evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    pointerEvents: getComputedStyle(element).pointerEvents,
  }))).toEqual({ opacity: "1", pointerEvents: "auto" });
  await expect(commandToggle).toHaveAttribute("aria-expanded", "false");
  await expect(commandPanel).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => commandPanel.evaluate((element) => element.inert)).toBe(true);
  await expect(commandInput).toBeHidden();

  await commandToggle.click();
  await expect(commandToggle).toHaveAttribute("aria-expanded", "true");
  await expect(commandPanel).toHaveAttribute("aria-hidden", "false");
  await expect.poll(() => commandPanel.evaluate((element) => element.inert)).toBe(false);
  await expect(commandInput).toBeFocused();
  await commandInput.fill("open report");
  await commandInput.press("Enter");
  await expect(commandToggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".shell-unified-rail-layer")).toHaveAttribute("data-open", "true");
  await expect(page.locator('[data-unified-rail-tab="documents"]')).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.evaluate(() => ({
    id: document.activeElement?.id || "",
    className: document.activeElement?.className || "",
  }))).toEqual({ id: "commandDrawerToggle", className: "command-drawer-toggle" });

  await commandToggle.focus();
  await page.keyboard.press("Enter");
  await expect(commandInput).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(commandToggle).toBeFocused();
  await expect(commandPanel).toHaveAttribute("aria-hidden", "true");

  await commandToggle.focus();
  await page.keyboard.press("Space");
  await expect(commandInput).toBeFocused();
  await page.locator("#commandDrawerClose").click();
  await expect(commandToggle).toBeFocused();

  await commandToggle.click();
  await expect(commandInput).toBeFocused();
  await commandInput.fill("open report");
  await commandInput.press("Enter");
  const journeyDocument = page.locator(".journey-document-row").first();
  await expect(journeyDocument).toBeVisible();
  await journeyDocument.click();
  await expect(page.locator("[data-unified-rail-label]")).toHaveText("Document Prep");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator('[data-shell-nav="dashboard"]').click();

  const workspace = page.locator("#workspace");
  const sidebarToggle = page.locator("#sidebarToggle");
  await expect(workspace).toHaveAttribute("data-shell-sidebar-collapsed", "true");
  await expect(page.locator('[data-shell-nav="dashboard"] .nav-label')).toBeHidden();
  await sidebarToggle.click();
  await expect(workspace).toHaveAttribute("data-shell-sidebar-collapsed", "false");
  await expect(page.locator('[data-shell-nav="dashboard"] .nav-label')).toBeVisible();

  await page.locator('[data-shell-nav="settings"]').click();
  await page.locator('[data-settings-tab="preferences"]').click();
  await expect(page.locator("#s38SettingsThemeMount")).toBeVisible();
  await page.locator('[data-shell-theme="cream"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");
  await page.locator('[data-shell-nav="dashboard"]').click();
  await page.reload();
  await expect(page.locator("#workspace")).toHaveAttribute("data-shell-sidebar-collapsed", "false");
  await expect(page.locator('[data-shell-nav="dashboard"] .nav-label')).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");
  await expect(page.locator("[data-shell-theme]")).toHaveCount(0);
  await page.locator('[data-shell-nav="settings"]').click();
  await page.locator('[data-settings-tab="preferences"]').click();
  await expect(page.locator("#s38SettingsThemeMount")).toBeVisible();
  await expect(page.locator('[data-shell-theme="cream"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-shell-nav="dashboard"]').click();

  const openRail = page.locator("#s38OpenRail");
  await openRail.click();
  const rail = page.locator("#s38UnifiedRail");
  const layer = page.locator(".shell-unified-rail-layer");
  await expect(layer).toHaveAttribute("data-open", "true");
  await expect(rail).toHaveAttribute("aria-hidden", "false");
  await expect(rail).not.toHaveAttribute("role", "dialog");
  await expect(rail).not.toHaveAttribute("aria-modal", /.+/);
  await expect(page.locator('[data-unified-rail-tab="overview"]')).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.locator('[data-unified-rail-tab="actions"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#s38UnifiedRailPanel")).toHaveAttribute("aria-labelledby", await page.locator('[data-unified-rail-tab="actions"]').getAttribute("id"));
  await page.keyboard.press("Home");
  await expect(page.locator('[data-unified-rail-tab="overview"]')).toHaveAttribute("aria-selected", "true");

  const activityTab = page.locator('[data-unified-rail-tab="activity"]');
  await activityTab.focus();
  await page.keyboard.press("Enter");
  await expect(activityTab).toBeFocused();
  const resizer = page.locator(".shell-rail-resizer");
  const widthBefore = Number(await resizer.getAttribute("aria-valuenow"));
  await resizer.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(resizer).toHaveAttribute("aria-valuenow", String(Math.min(480, widthBefore + 16)));

  for (const view of ["find-estates", "dossiers", "queue", "admin", "dashboard"]) {
    await page.locator(`[data-shell-nav="${view}"]`).click();
    await expect(page.locator(`[data-shell-nav="${view}"]`)).toHaveAttribute("aria-current", "page");
    await expect(layer).toHaveAttribute("data-open", "true");
    await expect(page.locator('[data-unified-rail-tab="activity"]')).toHaveAttribute("aria-selected", "true");
    await expect(resizer).toHaveAttribute("aria-valuenow", String(Math.min(480, widthBefore + 16)));
  }

  await page.keyboard.press("Escape");
  await expect(rail).toHaveAttribute("aria-hidden", "true");
  await expect(openRail).toBeFocused();
  await expect(page.locator("#researchRail")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#historyRail")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#agentDrawer")).toHaveAttribute("aria-hidden", "true");
  const primary = page.locator("[data-shell-primary-command]");
  const primaryTarget = await primary.getAttribute("data-next-view");
  await primary.click();
  await expect(page.locator(`[data-shell-nav="${primaryTarget}"]`)).toHaveAttribute("aria-current", "page");
  await expectNoDeveloperLanguage(page);
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("a document row opens the mobile rail through the direct runtime path and returns focus", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);

  await page.locator('[data-shell-nav="settings"]').click();
  await page.locator('[data-settings-tab="preferences"]').click();
  await expect(page.locator("#s38SettingsThemeMount")).toBeVisible();
  await page.locator('[data-shell-theme="cream"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");
  await page.locator('[data-shell-nav="dashboard"]').click();
  await page.locator("#s38OpenRail").click();
  await expect(page.locator('[data-unified-rail-tab="overview"]')).toBeFocused();
  await page.reload();
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("role", "dialog");
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-modal", "true");
  await expect(page.locator('[data-unified-rail-tab="overview"]')).toBeFocused();
  await page.locator(".shell-rail-close").click();
  await expect(page.locator("#s38UnifiedRail")).toHaveAttribute("aria-hidden", "true");
  await page.locator('[data-shell-nav="find-estates"]').click();
  await expect(page.locator("#sidebarToggle")).toHaveAttribute("title", "Go to Dashboard");
  await page.locator("#sidebarToggle").click();
  await expect(page.locator('[data-shell-nav="dashboard"]')).toHaveAttribute("aria-current", "page");
  await page.locator('[data-shell-nav="find-estates"]').click();
  const mobilePrimary = page.locator("[data-shell-primary-command]");
  await expect(mobilePrimary).toHaveAttribute("title", "Import Estate");
  await mobilePrimary.click();
  await expect(page.locator("[data-crm-import-layer]")).toBeVisible();
  await page.locator("[data-close-crm-import]").first().click();
  await expect(page.locator("[data-crm-import-layer]")).toHaveCount(0);
  await page.locator('[data-shell-nav="dossiers"]').click();
  const documentRow = page.locator("[data-document-open]").first();
  await expect(documentRow).toBeVisible();
  await documentRow.focus();
  await page.keyboard.press("Enter");

  const rail = page.locator("#s38UnifiedRail");
  await expect(rail).toHaveAttribute("role", "dialog");
  await expect(rail).toHaveAttribute("aria-modal", "true");
  await expect(rail).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toBeFocused();
  await expect(page.locator(".shell-rail-close")).toHaveAttribute("aria-label", "Close Document Prep");
  await expect(page.locator(".shell-rail-backdrop")).toHaveAttribute("aria-label", "Close Document Prep");
  await expect(page.locator("body")).toHaveClass(/s38-mobile-rail-open/);
  await expect.poll(() => page.locator(".workbench").evaluate((element) => element.inert)).toBe(true);
  await expect.poll(() => page.locator(".topbar").evaluate((element) => element.inert)).toBe(true);
  await expect.poll(() => page.locator("#primarySidebar").evaluate((element) => element.inert)).toBe(true);

  await page.keyboard.press("/");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toBeFocused();
  await expect(page.locator("#globalSearch")).not.toBeFocused();

  await page.setViewportSize({ width: 900, height: 844 });
  await expect(rail).not.toHaveAttribute("role", "dialog");
  await expect.poll(() => page.locator(".workbench").evaluate((element) => element.inert)).toBe(false);
  await expect.poll(() => page.locator(".topbar").evaluate((element) => element.inert)).toBe(false);
  await expect.poll(() => page.locator("#primarySidebar").evaluate((element) => element.inert)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rail).toHaveAttribute("role", "dialog");
  await expect.poll(() => page.locator(".workbench").evaluate((element) => element.inert)).toBe(true);

  const close = page.locator(".shell-rail-close");
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  const focusWrappedInside = await rail.evaluate((element) => element.contains(document.activeElement));
  expect(focusWrappedInside).toBe(true);
  await page.keyboard.press("Escape");
  await expect(rail).toHaveAttribute("aria-hidden", "true");
  await expect(rail).not.toHaveAttribute("aria-modal", /.+/);
  await expect(documentRow).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass(/s38-mobile-rail-open/);
  await expect.poll(() => page.locator(".workbench").evaluate((element) => element.inert)).toBe(false);
  await expect.poll(() => page.locator(".topbar").evaluate((element) => element.inert)).toBe(false);
  await expect.poll(() => page.locator("#primarySidebar").evaluate((element) => element.inert)).toBe(false);
  await expect.poll(() => page.locator("#historyRail").evaluate((element) => element.inert)).toBe(true);

  await page.locator('[data-shell-nav="settings"]').click();
  await page.locator('[data-settings-tab="preferences"]').click();
  await expect(page.locator("#s38SettingsThemeMount")).toBeVisible();

  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    themeVisible: document.querySelector("#s38SettingsThemeMount")?.getClientRects().length > 0,
    headerRight: document.querySelector(".shell-header-commands")?.getBoundingClientRect().right,
    themeTargets: [...document.querySelectorAll("[data-shell-theme]")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  expect(geometry.clientWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.themeVisible).toBe(true);
  expect(geometry.headerRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.themeTargets.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
  await expectNoDeveloperLanguage(page);
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});

test("deep links, same-session routes, and reduced motion keep their contracts", async ({ page }) => {
  const browserFailures = watchBrowserFailures(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await openWorkspace(page, "/?docprep=estate&railTab=docs");
  await expect(page.locator('[data-shell-nav="dossiers"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".shell-unified-rail-layer")).toHaveAttribute("data-open", "true");
  await expect(page.locator('[data-unified-rail-tab="document"]')).toHaveAttribute("aria-selected", "true");
  await page.locator(".shell-rail-close").click();

  await page.goto("/?view=queue");
  await expect(page.locator("#authGate")).toBeHidden();
  await expect(page.locator('[data-shell-nav="queue"]')).toHaveAttribute("aria-current", "page");

  await page.locator('[data-shell-nav="settings"]').click();
  await page.locator('[data-settings-tab="preferences"]').click();
  await page.locator('[data-shell-theme="system"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "system");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cream");
  await page.reload();
  await expect(page.locator('[data-shell-nav="settings"]')).toHaveAttribute("aria-current", "page");

  await page.locator("#s38OpenRail").click();
  const durations = await page.evaluate(() => {
    const rail = document.querySelector("#s38UnifiedRail");
    const workspace = document.querySelector("#workspace");
    return {
      rail: getComputedStyle(rail).transitionDuration,
      workspace: getComputedStyle(workspace).transitionDuration,
    };
  });
  for (const [surface, serialized] of Object.entries(durations)) {
    const seconds = cssTimeListInSeconds(serialized);
    expect(seconds.length, `${surface} must expose at least one transition duration`).toBeGreaterThan(0);
    expect(seconds.every(Number.isFinite), `${surface} transition durations must be valid CSS times: ${serialized}`).toBe(true);
    expect(Math.max(...seconds), `${surface} reduced-motion duration must remain at or below 1ms: ${serialized}`).toBeLessThanOrEqual(0.001);
  }
  await expectNoDeveloperLanguage(page);
  expect(browserFailures, browserFailures.join("\n")).toEqual([]);
});
