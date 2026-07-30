# 2026-06-29 DocPrep and Estates UI Progress

## Completed
- Estates source rail now defaults closed for fresh users and opens into two source cards: Import from External Sources and Fetch Fresh Leads.
- Imported estates now default to Pre-Discovery deal status, with Post-Discovery, Outreach, Warm, Hot, and Cold available in Document Prep.
- Warm and Hot route the active Document Prep flow to Closing Docs; Cold remains available for the SMS drip outreach path.
- Document Prep now has an All clients breadcrumb/list view plus an Add prep modal that starts eligible estates in Discovery or Closing Docs.
- Document Prep list only shows explicit prep work: started flows, completed phases, generated packets, or linked files. Not-started estates stay in Add prep.
- Estate row Archive/Delete text actions were removed. Archive/Delete now live in the selected-action pill, and imported estate rows expose a hover/focus trash icon for single-row delete.

## Verification
- `pnpm --filter @ple/artifact build`
- Local browser regression against `AUTH_REQUIRED=false pnpm --filter @ple/artifact dev`
- Verified source rail default closed, source cards visible on open, batch import, Pre-Discovery default status, Warm-to-Closing Docs routing, Cold status persistence, All clients breadcrumb, Add prep modal eligibility, added prep list row, row hover trash, selected-pill Archive/Delete, and no console/page errors.
