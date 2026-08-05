import { useState } from "react";
import { BeuiIcon } from "../../ui/beui-icon-bank";
import { BeuiTabs, type BeuiTabDefinition } from "./tabs";
import type {
  BeuiCommandHandler,
  OutreachCampaign,
  OutreachTemplate,
} from "./contract";
import {
  PearlButton,
  ScreenHeading,
  ScreenStatus,
  StateBadge,
  type ScreenStatusProps,
} from "./shared";

export interface OutreachSurfaceProps extends ScreenStatusProps {
  campaigns?: readonly OutreachCampaign[];
  templates?: readonly OutreachTemplate[];
  selectedCampaignId?: string;
  selectedTemplateId?: string;
  onSelectCampaign?: (campaignId: string) => void;
  onSelectTemplate?: (templateId: string) => void;
  onTemplateAction?: (action: string, template: OutreachTemplate) => void;
  onCommand?: BeuiCommandHandler;
}

export function OutreachSurface({
  campaigns = [],
  templates = [],
  selectedCampaignId,
  selectedTemplateId,
  onSelectCampaign,
  onSelectTemplate,
  onTemplateAction,
  status,
  message,
}: OutreachSurfaceProps) {
  const activeCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) || campaigns[0];
  const campaignTemplates = templates.filter((template) => template.campaignId === activeCampaign?.id && template.state !== "Archived");
  const selectedTemplate = campaignTemplates.find((template) => template.id === selectedTemplateId) || campaignTemplates[0];
  const [sideTab, setSideTab] = useState("variables");
  const sideTabs: readonly BeuiTabDefinition[] = [
    { id: "variables", label: "Variables" },
    { id: "preferences", label: "Preferences" },
  ];
  const actionForState: Partial<Record<OutreachTemplate["state"], { id: string; label: string }>> = {
    Draft: { id: "mark-ready", label: "Mark ready" },
    Ready: { id: "submit-approval", label: "Submit for approval" },
    Approved: { id: "sync", label: "Sync to Podio" },
    "Sync to Podio": { id: "hold-outbound", label: "Hold outbound send" },
  };

  return (
    <section className="beui-tabs-screen" data-beui-view="drips" aria-labelledby="beui-outreach-title">
      <ScreenHeading
        id="beui-outreach-title"
        eyebrow="Approved outreach"
        title="Outreach"
        copy="Keep campaigns, templates, approval state, and stop rules visible before any external follow-up."
      />
      <div className="beui-tabs-outreach-layout">
        <section className="beui-tabs-panel" aria-labelledby="beui-campaigns-title">
          <div className="beui-tabs-panel-heading">
            <div><p className="beui-tabs-eyebrow">Campaigns</p><h2 id="beui-campaigns-title">Review queue</h2></div>
            <span className="beui-tabs-count">{campaigns.length} available</span>
          </div>
          <ul className="beui-tabs-select-list" aria-label="Outreach campaigns">
            {campaigns.map((campaign) => (
              <li key={campaign.id}>
                <button
                  type="button"
                  className="beui-tabs-select-row"
                  data-state={campaign.id === activeCampaign?.id ? "selected" : "idle"}
                  aria-pressed={campaign.id === activeCampaign?.id}
                  onClick={() => onSelectCampaign?.(campaign.id)}
                >
                  <span><strong>{campaign.label}</strong><span>{campaign.detail || "Campaign detail supplied by the workspace."}</span></span>
                  <BeuiIcon name="chevron" size={15} />
                </button>
              </li>
            ))}
          </ul>
          {!campaigns.length ? <p className="beui-tabs-empty">No campaigns are available in the current workspace state.</p> : null}
        </section>
        <section className="beui-tabs-panel" aria-labelledby="beui-templates-title">
          <div className="beui-tabs-panel-heading">
            <div><p className="beui-tabs-eyebrow">Templates</p><h2 id="beui-templates-title">{activeCampaign?.label || "Select a campaign"}</h2></div>
            <span className="beui-tabs-count">{campaignTemplates.length} shown</span>
          </div>
          <ul className="beui-tabs-select-list" aria-label="Outreach templates">
            {campaignTemplates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  className="beui-tabs-select-row"
                  data-state={template.id === selectedTemplate?.id ? "selected" : "idle"}
                  aria-pressed={template.id === selectedTemplate?.id}
                  onClick={() => onSelectTemplate?.(template.id)}
                >
                  <span><strong>{template.label}</strong><span>{template.channel.toUpperCase()} · {template.detail || "Template copy is held for review."}</span></span>
                  <StateBadge state={template.state === "Approved" ? "ready" : template.state === "Archived" ? "neutral" : "review"}>{template.state}</StateBadge>
                </button>
              </li>
            ))}
          </ul>
          {!campaignTemplates.length ? <p className="beui-tabs-empty">No templates are available for the selected campaign.</p> : null}
        </section>
        <aside className="beui-tabs-panel beui-tabs-outreach-detail" aria-label="Outreach review details">
          <div className="beui-tabs-panel-heading">
            <div><p className="beui-tabs-eyebrow">Selected template</p><h2>{selectedTemplate?.label || "Nothing selected"}</h2></div>
            {selectedTemplate ? <StateBadge state={selectedTemplate.state === "Approved" ? "ready" : "review"}>{selectedTemplate.state}</StateBadge> : null}
          </div>
          {selectedTemplate ? (
            <>
              <BeuiTabs tabs={sideTabs} value={sideTab} onValueChange={setSideTab} ariaLabel="Outreach detail" panelId="outreach-detail" />
              {sideTab === "variables" ? (
                <div id="outreach-detail-variables" className="beui-tabs-detail-copy" role="tabpanel">
                  <p>Estate fields are available as reviewed template variables. Values stay bound to the selected estate.</p>
                  <ul><li>Estate title</li><li>Property address</li><li>Reviewed contact fields</li></ul>
                </div>
              ) : (
                <div id="outreach-detail-preferences" className="beui-tabs-detail-copy" role="tabpanel">
                  <p>Stop rules keep no-contact, company-owned, source-blocked, and recent-sale records out of outreach.</p>
                  <StateBadge state="review">Stop rules supplied by workspace</StateBadge>
                </div>
              )}
              {actionForState[selectedTemplate.state] && onTemplateAction ? (
                <PearlButton
                  data-beui-control="outreach-template-action"
                  onClick={() => onTemplateAction(actionForState[selectedTemplate.state]!.id, selectedTemplate)}
                >
                  {actionForState[selectedTemplate.state]!.label}
                </PearlButton>
              ) : null}
            </>
          ) : <p className="beui-tabs-empty">Select a template to inspect its reviewed state.</p>}
          <ScreenStatus status={status} message={message} />
        </aside>
      </div>
    </section>
  );
}
