import type { IntakeSeed, RawDossier, SourceFact } from "@ple/types";
import { fetchDeedEvidenceFacts } from "./adapters/deed-evidence";
import { fetchFamilyTreeHypothesisFacts } from "./adapters/family-tree-hypothesis";
import { fetchMarriageDeathIndicatorFacts } from "./adapters/marriage-death-indicators";
import { fetchOfficialRecordFacts } from "./adapters/official-records";
import { fetchProbateCourtFacts } from "./adapters/probate-court";
import { fetchOfferProfitInputFacts } from "./adapters/offer-profit-inputs";
import { fetchPropertyFacts } from "./adapters/property-appraiser";
import { fetchSourceGovernanceFacts } from "./adapters/source-governance";
import { fetchTaxHistoryFacts } from "./adapters/tax-history";
import { PodioAdapter } from "./crm/podio-adapter";
import { buildRawDossier } from "./dossier/build-raw-dossier";
import { generateCompletedLeadReport } from "./documents/completed-lead-report";
import { generateInternalSummary } from "./documents/internal-summary";
import { fact, intakeSubject, normalizeEstateSearchKey, nowIso, seedIdentity, slug } from "./lib";
import { buildOutreachWorkflow } from "./outreach/build-outreach-workflow";
import { buildQualificationDecision } from "./qualification/qualification-review";
import { jsonOutput, PipelineOutput, textOutput } from "./storage/output-manifest";

type RuntimeEnv = Record<string, string | undefined>;

export interface RunDryPipelineOptions {
  env?: RuntimeEnv;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function seedFromArgs(): IntakeSeed {
  const estateName = arg("estate");
  const propertyAddress = arg("address");
  const ownerName = arg("owner");
  const caseNumber = arg("case-number");
  const parcelId = arg("folio");
  const county = arg("county") ?? "miami-dade";

  if (!estateName && !propertyAddress && !parcelId && !caseNumber) {
    return {
      propertyAddress: "3850 NW 176th St, Miami Gardens, FL 33055",
      ownerName: ownerName ?? "Fresh public-source lead",
      county,
      parcelId,
      source: "operator_cli",
    };
  }

  return {
    estateName,
    propertyAddress,
    ownerName,
    caseNumber,
    county,
    parcelId,
    source: "operator_cli",
  };
}

function intakeFacts(runId: string, seed: IntakeSeed): SourceFact[] {
  const identity = seedIdentity(seed);
  const subject = intakeSubject(seed);
  const facts: SourceFact[] = [
    fact({
      runId,
      source: "intake",
      rawId: `intake:${slug(identity)}`,
      fetchedAt: nowIso(),
      county: seed.county,
      subject,
      factType: "intake_seed",
      value: seed,
      confidence: 0.95,
      reviewFlags: ["NO_ENRICHMENT_RUN"],
    }),
  ];

  if (seed.estateName) {
    facts.push(
      fact({
        runId,
        source: "intake",
        rawId: `intake:${slug(identity)}:estate`,
        fetchedAt: nowIso(),
        county: seed.county,
        subject,
        factType: "estate_name",
        value: seed.estateName,
        confidence: 0.95,
        reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      }),
      fact({
        runId,
        source: "intake",
        rawId: `intake:${slug(identity)}:estate-search-key`,
        fetchedAt: nowIso(),
        county: seed.county,
        subject,
        factType: "estate_search_key",
        value: normalizeEstateSearchKey(seed.estateName),
        confidence: 0.95,
        reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      }),
    );
  }

  if (seed.caseNumber) {
    facts.push(
      fact({
        runId,
        source: "intake",
        rawId: `intake:${slug(identity)}:case-number`,
        fetchedAt: nowIso(),
        county: seed.county,
        subject,
        factType: "case_number",
        value: seed.caseNumber,
        confidence: 0.9,
        reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      }),
    );
  }

  return facts;
}

function confirmedSourceFacts(runId: string, seed: IntakeSeed): SourceFact[] {
  const identity = seedIdentity(seed);
  const subject = intakeSubject(seed);
  const fetchedAt = nowIso();

  return (seed.confirmedSourceFacts ?? []).map((sourceFact, index) => fact({
    runId,
    source: sourceFact.source,
    rawId: sourceFact.rawId ?? `confirmed-source:${slug(identity)}:${index + 1}:${slug(sourceFact.factType)}`,
    fetchedAt: sourceFact.fetchedAt ?? fetchedAt,
    county: seed.county,
    subject,
    factType: sourceFact.factType,
    value: sourceFact.value,
    confidence: sourceFact.confidence ?? 0.9,
    sourceUrl: sourceFact.sourceUrl,
    reviewFlags: sourceFact.reviewFlags ?? [],
  }));
}

export async function runDryPipeline(seed: IntakeSeed = seedFromArgs(), options: RunDryPipelineOptions = {}): Promise<{
  runId: string;
  facts: SourceFact[];
  dossier: RawDossier;
  outputs: Record<string, string>;
  outputFiles: Record<string, PipelineOutput>;
}> {
  const identity = seedIdentity(seed);
  const runId = `run-${Date.now()}-${slug(identity)}`;
  const subject = intakeSubject(seed);

  const [propertyFacts, officialRecordFacts, taxFacts, deedFacts, probateFacts, marriageDeathFacts, familyTreeFacts, governanceFacts, offerProfitFacts] = await Promise.all([
    fetchPropertyFacts(runId, seed),
    fetchOfficialRecordFacts(runId, seed),
    fetchTaxHistoryFacts(runId, seed),
    fetchDeedEvidenceFacts(runId, seed),
    fetchProbateCourtFacts(runId, seed),
    fetchMarriageDeathIndicatorFacts(runId, seed),
    fetchFamilyTreeHypothesisFacts(runId, seed),
    fetchSourceGovernanceFacts(runId, seed),
    fetchOfferProfitInputFacts(runId, seed),
  ]);
  const facts = [
    ...intakeFacts(runId, seed),
    ...confirmedSourceFacts(runId, seed),
    ...propertyFacts,
    ...officialRecordFacts,
    ...taxFacts,
    ...deedFacts,
    ...probateFacts,
    ...marriageDeathFacts,
    ...familyTreeFacts,
    ...governanceFacts,
    ...offerProfitFacts,
  ];
  const propertyCountyFact = fact({
    runId,
    source: "property_appraiser",
    rawId: `property-search:${slug(identity)}:county`,
    fetchedAt: nowIso(),
    county: seed.county,
    subject,
    factType: "property_county",
    value: seed.county,
    confidence: 0.8,
    reviewFlags: ["NO_ENRICHMENT_RUN"],
  });
  facts.push(propertyCountyFact);

  const dossier = buildRawDossier(runId, facts);
  dossier.completedLeadReport = await generateCompletedLeadReport(dossier);
  dossier.outreach = buildOutreachWorkflow(dossier, dossier.completedLeadReport);
  dossier.completedLeadReport = await generateCompletedLeadReport(dossier);
  dossier.qualificationDecision = buildQualificationDecision(dossier);
  const podio = new PodioAdapter(options.env);
  const podioPayload = await podio.dryRun(dossier);
  dossier.crm.payload = podioPayload;
  dossier.documentPacket = await generateInternalSummary(dossier);

  const outputFiles = {
    latestRun: jsonOutput("latest-run.json", { runId, seed, facts, dossier }),
    dossier: jsonOutput("latest-dossier.json", dossier),
    podio: jsonOutput("podio-dry-run.json", podioPayload),
    summaryMarkdown: textOutput("internal-summary.md", dossier.documentPacket.formats.markdown),
    summaryHtml: textOutput("internal-summary.html", dossier.documentPacket.formats.html, "text/html; charset=utf-8"),
    completedReportMarkdown: textOutput("completed-lead-report.md", dossier.completedLeadReport.formats.markdown),
    completedReportHtml: textOutput("completed-lead-report.html", dossier.completedLeadReport.formats.html, "text/html; charset=utf-8"),
  };
  const outputs = {
    latestRun: outputFiles.latestRun.path,
    dossier: outputFiles.dossier.path,
    podio: outputFiles.podio.path,
    summaryMarkdown: outputFiles.summaryMarkdown.path,
    summaryHtml: outputFiles.summaryHtml.path,
    completedReportMarkdown: outputFiles.completedReportMarkdown.path,
    completedReportHtml: outputFiles.completedReportHtml.path,
  };

  return { runId, facts, dossier, outputs, outputFiles };
}
