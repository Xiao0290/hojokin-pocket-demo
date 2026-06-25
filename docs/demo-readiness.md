# Demo Readiness Gate

Created: 2026-06-20 JST  
Purpose: decide whether the project is ready for a meeting demo with a professional subsidy-company CEO.

## Hard Gates

Do not use the demo as the meeting baseline unless all hard gates are true.

| Gate | Required state |
| --- | --- |
| End-to-end flow | `npm run verify:ci` passes, including the SAMPLE E2E path. |
| Demo score | `npm run score:demo` is at least 8.5 / 10. |
| Legal framing | AI is presented only as applicant-owned draft support. |
| Data framing | Fixture/source-backed MVP data is shown honestly; no complete-market coverage claim. |
| Payment and filing | No paid expert marketplace, no success-contingent economics, no in-app filing, no jGrants write-side integration. |
| Production status | Presenter states this is a local MVP, not production auth, not official jGrants ingestion, and not a legal opinion. |

## Scoring Model

The score is a 10 point gate. Each category is worth 1 point. Passing threshold is 8.5 / 10 and every category should pass for tomorrow's meeting.

| ID | Category | What It Proves |
| --- | --- | --- |
| R01 | End-to-end SAMPLE flow | URL diagnosis can reach analytics through the intended demo path. |
| R02 | Stable local verification | Runtime/export isolation and repeat verification exist. |
| R03 | Export-quality proof | DOCX/PDF exports preserve long edited content and disclaimers. |
| R04 | Compliance pause lines | Legal, payment, filing, and adoption-probability boundaries are explicit. |
| R05 | Data-source boundaries | External-source ingestion is gated by license/provenance status. |
| R06 | GitHub handoff governance | Work is traceable through Issue / PR / CI / handoff. |
| R07 | Meeting talk track | A short script exists for tomorrow's live walkthrough. |
| R08 | Known limitations | The presenter can explain what is local, fixture-backed, and not launched. |
| R09 | Professional validation agenda | The CEO meeting has concrete questions instead of a vague pitch. |
| R10 | Quantified readiness gate | The readiness score is scripted, tested, and enforced in CI. |

## Current Target

Target for the meeting: **10 / 10**.

Minimum acceptable fallback: **8.5 / 10**, with no failed hard gate and with a clear explanation of the missing point.

## Known Limitations

- Local MVP, not production deployment.
- Local mock auth, not production auth.
- Fixture/source-backed subsidy data, not official jGrants ingestion.
- Expert flow is waitlist only.
- No in-app filing.
- No paid expert marketplace.
- No company-specific adoption-probability prediction.
- Track L1 external legal opinion is not yet received.

## Commands

```sh
npm run score:demo
npm run verify:ci
```

The E2E flow must continue using `https://www.sample-corp.example` unless the presenter intentionally overrides it for a separate test.
