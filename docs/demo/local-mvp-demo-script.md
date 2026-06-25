# Local MVP Demo Script

Created: 2026-06-20 JST  
Baseline commit: `dd44b39315664ba098460253a674a61324480ea9`

## Purpose

This script freezes the current local MVP demo as the baseline for Closed Beta planning. It is a working professional-validation demo, not a production launch.

The customer-facing flow must stay low-density at the start:

1. Ask for a company URL.
2. Show a short analysis animation.
3. Lead with the number of matching subsidies and the total upper-limit amount.
4. Offer the next action: consult an administrative scrivener.
5. Keep forms, detailed evidence, and draft preparation behind the consultation-oriented path.

## Demo Path

Use `https://www.sample-corp.example` as the primary example.

1. Open the responsive app shell.
2. Enter the company URL and start diagnosis.
3. Wait for the analysis steps to complete.
4. Show the result headline first: candidate count and total upper-limit amount.
5. Open one subsidy detail only after the headline result is understood.
6. Show source URL, last-seen date, requirements, and applicant confirmations.
7. Use the administrative-scrivener CTA as the main solution path.
8. If asked, show the later preparation flow for applicant-owned business-plan draft support.
9. If asked, export DOCX/PDF and point out the AI draft disclaimer.
10. Close with the validation questions for a subsidy professional.

## Required Framing

- This is a local MVP and Closed Beta baseline, not production.
- Diagnosis is signal-based. It must not return a fixed recommendation list for every URL.
- Current plan drafts are deterministic local templates, not production LLM output.
- Subsidy data is fixture/source-backed MVP data, not complete national/local coverage.
- Source review and licensing gates must be completed before real data is shown to beta users.
- Expert flow is consent-gated lead or waitlist only.
- The product does not file applications, submit to jGrants, proxy drafting/submission, or operate a paid marketplace.
- No success-fee, platform take-rate, adoption-probability guarantee, or official approval guarantee may be claimed.

## Do Not Show First

Avoid opening with dense tables, admin views, source-review internals, export files, long draft text, or implementation details. Those are proof points for later questions; they should not be the first customer impression.

## Acceptance Commands

```sh
npm run verify:ci
```

The command must pass before this baseline is used as the input for parallel Closed Beta foundation work.
