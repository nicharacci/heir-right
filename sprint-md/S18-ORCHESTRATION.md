# Sprint Brief: S18-ORCH -- Qualification Promotion Loop

Owner: TP
Beta phase: 30-Day Acceptance
Branch: `v2.4.1/heirright-2026-06-16-run-point`
Project: HeirRight Deal Engine Automation

## Goal

Turn extracted evidence into qualified, review, disqualified, duplicate, and dead-letter outcomes that match HeirRight's actual workflow.

## Tracks

| Track | Title | Brief |
| --- | --- | --- |
| S18-T1 | Evidence Coverage Scoring | `@sprint-md/S18-T1-evidence-coverage-scoring.md` |
| S18-T2 | Lead-Quality Settings Activation | `@sprint-md/S18-T2-lead-quality-settings-activation.md` |
| S18-T3 | Operator Spot-Check Packet | `@sprint-md/S18-T3-operator-spot-check-packet.md` |

## Acceptance

- The system can promote real source-backed candidates or honestly explain why none qualify.
- No lead with open core blockers is counted as qualified.
- Operator review can tune thresholds without weakening source-evidence rules.
- A `qualification-review.md` packet gives a sample across qualified, review, disqualified, duplicate, and dead-letter states.

