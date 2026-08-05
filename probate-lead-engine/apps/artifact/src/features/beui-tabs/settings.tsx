import { Switch } from "../../beui-foundation/components/motion/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../beui-foundation/components/motion/select";
import { BeuiTabs, type BeuiTabDefinition } from "./tabs";
import { BEUI_SETTINGS_TABS } from "./contract";
import type {
  BeuiAccountIdentity,
  BeuiAgenticModelStatus,
  BeuiPreferences,
  BeuiSettingsTabId,
  IntegrationRecord,
} from "./contract";
import {
  QuietButton,
  ScreenHeading,
  ScreenStatus,
  StateBadge,
  type ScreenStatusProps,
} from "./shared";

export interface SettingsSurfaceProps extends ScreenStatusProps {
  identity: BeuiAccountIdentity | null;
  activeTab?: BeuiSettingsTabId;
  canOpenAdmin?: boolean;
  integrations?: readonly IntegrationRecord[];
  agenticModelStatus?: BeuiAgenticModelStatus;
  agenticModelPreference?: string;
  verifiedFreeModels?: readonly string[];
  preferences?: BeuiPreferences;
  allowedDomains?: readonly string[];
  onTabChange?: (tab: BeuiSettingsTabId) => void;
  onPreferenceChange?: (key: keyof BeuiPreferences, value: boolean) => void;
  onConnectionAction?: (connectionId: string) => void;
  onAgenticModelChange?: (model: string) => void;
  onOpenAuth?: () => void;
  onAdminAction?: (action: string) => void;
}

export function SettingsSurface({
  identity,
  activeTab = "integrations",
  canOpenAdmin = false,
  integrations = [],
  agenticModelStatus,
  agenticModelPreference = "dynamic-free-catalog",
  verifiedFreeModels = [],
  preferences,
  allowedDomains = [],
  onTabChange,
  onPreferenceChange,
  onConnectionAction,
  onAgenticModelChange,
  onOpenAuth,
  onAdminAction,
  status,
  message,
}: SettingsSurfaceProps) {
  const visibleTabs = BEUI_SETTINGS_TABS.filter((tab) => !tab.requiresAdmin || canOpenAdmin);
  const active = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : "integrations";
  const settingsTabDefinitions: readonly BeuiTabDefinition[] = visibleTabs.map((tab) => ({ id: tab.id, label: tab.label }));

  return (
    <section className="beui-tabs-screen" data-beui-view="settings" aria-labelledby="beui-settings-title">
      <ScreenHeading id="beui-settings-title" eyebrow="Workspace controls" title="Settings" copy="Keep access, connections, support, outreach, and preferences close to the state that owns them." />
      <section className="beui-tabs-panel beui-tabs-settings-panel">
        <BeuiTabs tabs={settingsTabDefinitions} value={active} onValueChange={(value) => onTabChange?.(value as BeuiSettingsTabId)} ariaLabel="Settings sections" panelId="settings" />
        <div className="beui-tabs-settings-content">
          {active === "access" ? <AccessSettings identity={identity} allowedDomains={allowedDomains} onOpenAuth={onOpenAuth} /> : null}
          {active === "integrations" ? <IntegrationSettings
            integrations={integrations}
            agenticModelStatus={agenticModelStatus}
            agenticModelPreference={agenticModelPreference}
            verifiedFreeModels={verifiedFreeModels}
            onConnectionAction={onConnectionAction}
            onAgenticModelChange={onAgenticModelChange}
          /> : null}
          {active === "support" ? <SupportSettings onAdminAction={onAdminAction} /> : null}
          {active === "outreach" ? <OutreachSettings preferences={preferences} onPreferenceChange={onPreferenceChange} /> : null}
          {active === "preferences" ? <PreferenceSettings preferences={preferences} onPreferenceChange={onPreferenceChange} /> : null}
          {active === "admin" ? <AdminSettings accessDomains={allowedDomains} onAdminAction={onAdminAction} /> : null}
        </div>
      </section>
      <ScreenStatus status={status} message={message} />
    </section>
  );
}

function AccessSettings({
  identity,
  allowedDomains,
  onOpenAuth,
}: {
  identity: BeuiAccountIdentity | null;
  allowedDomains: readonly string[];
  onOpenAuth?: () => void;
}) {
  const signedIn = Boolean(identity?.authenticated && identity.email);
  return (
    <section className="beui-tabs-settings-section" data-beui-control="settings-access" aria-labelledby="beui-settings-access-title">
      <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Access</p><h2 id="beui-settings-access-title">Account access</h2></div><StateBadge state={signedIn ? "ready" : "blocked"}>{signedIn ? "Signed in" : "Sign-in required"}</StateBadge></div>
      <p className="beui-tabs-detail-copy">The account state comes from the authenticated session. This surface does not create a person, picture, or placeholder identity.</p>
      <dl className="beui-tabs-detail-list">
        <div><dt>Signed-in email</dt><dd>{identity?.email || "No signed-in email"}</dd></div>
        <div><dt>Account name</dt><dd>{identity?.name || "Provided by the session when available"}</dd></div>
        <div><dt>Allowed domains</dt><dd>{allowedDomains.length ? allowedDomains.join(", ") : "No domains supplied"}</dd></div>
      </dl>
      {!signedIn && onOpenAuth ? <a className="beui-tabs-inline-link" href="/auth/login" onClick={onOpenAuth}>Continue to sign in</a> : null}
    </section>
  );
}

function IntegrationSettings({
  integrations,
  agenticModelStatus,
  agenticModelPreference,
  verifiedFreeModels,
  onConnectionAction,
  onAgenticModelChange,
}: {
  integrations: readonly IntegrationRecord[];
  agenticModelStatus?: BeuiAgenticModelStatus;
  agenticModelPreference: string;
  verifiedFreeModels: readonly string[];
  onConnectionAction?: (connectionId: string) => void;
  onAgenticModelChange?: (model: string) => void;
}) {
  const modelOptions = ["dynamic-free-catalog", ...verifiedFreeModels.filter((model) => model !== "dynamic-free-catalog")];
  const selectedModel = modelOptions.includes(agenticModelPreference) ? agenticModelPreference : "dynamic-free-catalog";
  const modelState = !agenticModelStatus?.loaded
    ? "neutral"
    : agenticModelStatus.available
      ? "ready"
      : "review";
  return (
    <section className="beui-tabs-settings-section" data-beui-control="settings-integrations" aria-labelledby="beui-settings-integrations-title">
      <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Integrations</p><h2 id="beui-settings-integrations-title">Connection state</h2></div><span className="beui-tabs-count">{integrations.length} shown</span></div>
      <p className="beui-tabs-detail-copy">Each connection reports its current state and leaves the provider action with its owning contract.</p>
      <ul className="beui-tabs-connection-list">
        {integrations.map((integration) => (
          <li key={integration.id}>
            <span><strong>{integration.label}</strong><span>{integration.detail || "Connection detail supplied by the workspace."}</span></span>
            <span className="beui-tabs-connection-actions">
              <StateBadge state={integration.state}>{integration.state}</StateBadge>
              {onConnectionAction ? <QuietButton size="sm" onClick={() => onConnectionAction(integration.id)}>Refresh status</QuietButton> : null}
            </span>
          </li>
        ))}
      </ul>
      {!integrations.length ? <p className="beui-tabs-empty">No integration state was supplied.</p> : null}
      <section className="beui-tabs-settings-section" data-beui-control="nous-portal-model" aria-labelledby="beui-nous-portal-model-title">
        <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Nous Portal</p><h2 id="beui-nous-portal-model-title">Free model route</h2></div><StateBadge state={modelState}>{!agenticModelStatus?.loaded ? "Loading" : agenticModelStatus.available ? "Catalog ready" : "Review only"}</StateBadge></div>
        <p className="beui-tabs-detail-copy">Automatic selection uses only the verified free text-model catalog. Back Story output remains review-required.</p>
        <div className="beui-tabs-detail-list">
          <div>
            <dt>Model</dt>
            <dd>
              <Select
                value={selectedModel}
                onValueChange={onAgenticModelChange}
                disabled={!agenticModelStatus?.loaded || !onAgenticModelChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a verified free model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dynamic-free-catalog">Automatic free model</SelectItem>
                  {verifiedFreeModels.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                </SelectContent>
              </Select>
            </dd>
          </div>
          <div><dt>Route</dt><dd>{agenticModelStatus?.available ? agenticModelStatus.model || "Automatic catalog selection" : "Reviewed report formatting"}</dd></div>
        </div>
      </section>
    </section>
  );
}

function SupportSettings({ onAdminAction }: { onAdminAction?: (action: string) => void }) {
  return (
    <section className="beui-tabs-settings-section" aria-labelledby="beui-settings-support-title">
      <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Support</p><h2 id="beui-settings-support-title">Operator support</h2></div></div>
      <p className="beui-tabs-detail-copy">Support actions stay inside the authenticated workspace and retain their existing ownership boundary.</p>
      {onAdminAction ? <QuietButton onClick={() => onAdminAction("open-support")}>Open support control</QuietButton> : null}
    </section>
  );
}

function OutreachSettings({
  preferences,
  onPreferenceChange,
}: {
  preferences?: BeuiPreferences;
  onPreferenceChange?: (key: keyof BeuiPreferences, value: boolean) => void;
}) {
  return (
    <section className="beui-tabs-settings-section" aria-labelledby="beui-settings-outreach-title">
      <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Outreach</p><h2 id="beui-settings-outreach-title">Outreach safeguards</h2></div></div>
      <p className="beui-tabs-detail-copy">Keep the existing no-contact and review boundaries visible before a template can move forward.</p>
      {preferences ? <PreferenceControls preferences={preferences} onPreferenceChange={onPreferenceChange} /> : <p className="beui-tabs-empty">No outreach preference state was supplied.</p>}
    </section>
  );
}

function PreferenceSettings({
  preferences,
  onPreferenceChange,
}: {
  preferences?: BeuiPreferences;
  onPreferenceChange?: (key: keyof BeuiPreferences, value: boolean) => void;
}) {
  return (
    <section className="beui-tabs-settings-section" aria-labelledby="beui-settings-preferences-title">
      <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Preferences</p><h2 id="beui-settings-preferences-title">Workspace preferences</h2></div></div>
      {preferences ? <PreferenceControls preferences={preferences} onPreferenceChange={onPreferenceChange} /> : <p className="beui-tabs-empty">No preference state was supplied.</p>}
    </section>
  );
}

function PreferenceControls({
  preferences,
  onPreferenceChange,
}: {
  preferences: BeuiPreferences;
  onPreferenceChange?: (key: keyof BeuiPreferences, value: boolean) => void;
}) {
  return (
    <div className="beui-tabs-preference-list">
      <Switch
        checked={preferences.holdNoContact}
        onCheckedChange={(checked) => onPreferenceChange?.("holdNoContact", checked)}
        label="Hold no-contact records"
        ariaLabel="Hold no-contact records"
      />
      <Switch
        checked={preferences.compactTables}
        onCheckedChange={(checked) => onPreferenceChange?.("compactTables", checked)}
        label="Use compact tables"
        ariaLabel="Use compact tables"
      />
    </div>
  );
}

function AdminSettings({
  accessDomains,
  onAdminAction,
}: {
  accessDomains: readonly string[];
  onAdminAction?: (action: string) => void;
}) {
  return (
    <section className="beui-tabs-settings-section" aria-labelledby="beui-settings-admin-title">
      <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Admin</p><h2 id="beui-settings-admin-title">Access operations</h2></div></div>
      <p className="beui-tabs-detail-copy">Admin settings expose the current access boundary for the authenticated operator.</p>
      <p className="beui-tabs-detail-copy">{accessDomains.length ? `${accessDomains.length} allowed domain${accessDomains.length === 1 ? "" : "s"} supplied.` : "No access domains supplied."}</p>
      {onAdminAction ? <QuietButton onClick={() => onAdminAction("review-access")}>Review access state</QuietButton> : null}
    </section>
  );
}
