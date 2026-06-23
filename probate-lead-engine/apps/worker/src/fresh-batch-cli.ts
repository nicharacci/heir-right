import { freshLeadRequestFromCli, persistFreshLeadBatchOutputs, runFreshLeadBatch } from "./live/source-batch";

runFreshLeadBatch(freshLeadRequestFromCli())
  .then((result) => {
    const outputs = persistFreshLeadBatchOutputs(result);
    console.log(JSON.stringify({
      ok: result.ok,
      source: result.source,
      generatedAt: result.generatedAt,
      filters: result.filters,
      externalRecordCount: result.externalRecordCount,
      acceptedSeedCount: result.acceptedSeedCount,
      rejectedCandidateCount: result.rejectedCandidateCount,
      firstLiveLead: result.seeds[0] ? {
        ownerName: result.seeds[0].ownerName,
        estateName: result.seeds[0].estateName,
        propertyAddress: result.seeds[0].propertyAddress,
        parcelId: result.seeds[0].parcelId,
        source: result.seeds[0].source,
        sourceUrl: result.seeds[0].confirmedSourceFacts?.[0]?.sourceUrl,
      } : null,
      dailyRun: {
        id: result.dailyRun.id,
        rawLeadCount: result.dailyRun.rawLeadCount,
        qualifiedLeadCount: result.dailyRun.qualifiedLeadCount,
        reviewLeadCount: result.dailyRun.reviewLeadCount,
        errorCount: result.dailyRun.errorCount,
        missedVolumeReasons: result.dailyRun.missedVolumeReasons,
      },
      blockers: result.blockers,
      outputs,
    }, null, 2));
    if (!result.ok) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
