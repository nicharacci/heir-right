import { BeuiIcon } from "../../ui/beui-icon-bank";
import { BEUI_HELP_DEMOS, BEUI_HELP_TABS } from "./contract";
import { BeuiTabs, type BeuiTabDefinition } from "./tabs";
import type { BeuiHelpAreaId, BeuiOwnedRouteId } from "./contract";
import { ScreenHeading } from "./shared";

export interface HelpDemosSurfaceProps {
  activeArea?: BeuiHelpAreaId;
  onAreaChange?: (area: BeuiHelpAreaId) => void;
  onNavigate: (route: BeuiOwnedRouteId) => void;
  onSpotlight: (targetId: string) => void;
}

export function HelpDemosSurface({
  activeArea = "estates",
  onAreaChange,
  onNavigate,
  onSpotlight,
}: HelpDemosSurfaceProps) {
  const active = BEUI_HELP_TABS.some((tab) => tab.id === activeArea) ? activeArea : "estates";
  const tabs: readonly BeuiTabDefinition[] = BEUI_HELP_TABS.map((tab) => ({ id: tab.id, label: tab.label }));
  const demos = BEUI_HELP_DEMOS.filter((demo) => demo.area === active);

  function guide(demo: (typeof BEUI_HELP_DEMOS)[number]) {
    onNavigate(demo.route);
    onSpotlight(demo.targetId);
  }

  return (
    <section className="beui-tabs-screen" data-beui-view="help-demos" aria-labelledby="beui-help-title">
      <ScreenHeading id="beui-help-title" eyebrow="Guided controls" title="Help & Demos" copy="Jump to a real control, then spotlight it in place. Guidance does not submit, fetch, or mutate workspace data." />
      <section className="beui-tabs-panel" aria-labelledby="beui-help-list-title">
        <BeuiTabs tabs={tabs} value={active} onValueChange={(value) => onAreaChange?.(value as BeuiHelpAreaId)} ariaLabel="Help and demo categories" panelId="help" />
        <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Choose a guide</p><h2 id="beui-help-list-title">{BEUI_HELP_TABS.find((tab) => tab.id === active)?.label}</h2></div></div>
        <ol className="beui-tabs-help-list">
          {demos.map((demo, index) => (
            <li key={demo.id}>
              <button type="button" className="beui-tabs-help-row" data-beui-control={`help-${demo.id}`} onClick={() => guide(demo)}>
                <span className="beui-tabs-help-index" aria-hidden="true">{index + 1}</span>
                <span><strong>{demo.title}</strong><span>{demo.copy}</span></span>
                <BeuiIcon name="external" size={17} />
              </button>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
