# Service Ports and Local Adapters


Phase 1.5 introduces service ports so later Bedrock, auth, notification,
official data, and submission work can replace local behavior without rewriting
the MVP service flow. The current implementation remains a local MVP: local
fixtures, deterministic templates, local waitlists, and no operational filing.

## Ports

The source of truth for port contracts is `server/servicePorts.mjs`.

| Port | Responsibility | Default adapter |
| --- | --- | --- |
| `SubsidyDataSource` | Reads normalized subsidy rounds and round details. | Local fixture-backed adapter from `data/fixtures/subsidy-programs.json` with `server/seedData.mjs` fallback. |
| `DiagnosisExtractor` | Converts an attested public company URL into a cited company profile. | Local mock extractor using guarded public fetch, synthetic fixtures when enabled, and the SAMPLE cache fallback. |
| `PlanGenerator` | Creates applicant-reviewable business plan draft sections. | Local mock template generator that preserves draft status, sources, and confirmation flags. Optional Bedrock Claude and local Claude CLI adapters are disabled by default and require explicit cost guards. |
| `Matcher` | Ranks eligible subsidy rounds against the extracted company profile. | Local mock keyword and rule scorer with capped eligible output. |
| `AuthProvider` | Resolves the current user through the AuthContext boundary and development login. | Local mock owner user and `dev-token`, blocked in production-like environments. |
| `Notifier` | Persists notification preferences and expert waitlist leads. | Local mock settings and waitlist persistence in the local store. |
| `SubmissionAdapter` | Represents future official filing handoff. | Non-operational local stub that returns `blocked/notConfigured` only. |

## Repository Ports

Persistence ports are tracked separately in `server/repositoryPorts.mjs` and documented in `docs/repository-ports.md`. They split the broad local store into domain repositories for users, organizations, companies, diagnoses, subsidies, business plans, exported files, lead requests, and audit logs.

The current implementation keeps `LocalMockStoreRepository` as the default runtime and exposes `makeLocalRepositoryPorts()` as a compatibility adapter. Postgres repositories should implement the same contract before `STORE_BACKEND=postgres` is enabled.

## Provenance Contracts

The local MVP must be explicit about what is real and what is still simulated.

- `GET /v1/diagnoses/:id/matches` returns `provenance.matcher = local_keyword_signal_v1`, `subsidyDataSource = local_fixture_subsidy_rounds`, `directSignalRequired`, and `fixedRecommendationSet = false`.
- Real public-site profiles require a direct company/subsidy keyword overlap before a subsidy is returned. Development-only synthetic fixtures can use broad QA matches and are marked with `syntheticFixtureMode = true`.
- Business-plan objects, plan completion events, and audit logs include `generation`. The current default is `provider = local_mock`, `mode = deterministic_template`, `model = null`, and `llm = false`.
- Phase 3 Bedrock/RAG work must replace the `PlanGenerator` adapter and update generation provenance when real LLM output is introduced. The first Bedrock adapter is documented in [`bedrock-llm-cost-control.md`](./bedrock-llm-cost-control.md) and remains disabled unless `LLM_PROVIDER=bedrock` plus budget caps are configured.
- `LLM_PROVIDER=claude_cli` is a local-only unblocker that invokes `claude -p` from the developer machine. It is documented in [`claude-cli-llm-provider.md`](./claude-cli-llm-provider.md) and must not be treated as a production backend integration.

## Boundaries

In scope for this PR:

- Port method contracts and responsibility/input/output documentation.
- Local mock adapters wired into the existing service flow.
- Contract and adapter smoke tests for port completeness, injection, and blocked submission.
- The existing MVP flow, including the SAMPLE E2E example URL, remains unchanged.

Out of scope for this PR:

- Production prompt orchestration, RAG, or unconditional paid LLM calls.
- Real auth, eKYC, payment, marketplace, or delegated filing flows.
- jGrants POST or any other operational submission.
- Source refresh, dry-run ingestion, source freshness checks, or Track L conclusion changes.

## Handoff

Future production adapters should implement the same `server/servicePorts.mjs`
methods and be injected through `configureServicePorts`. The #4 source-refresh
thread can consume the `SubsidyDataSource` boundary, but its dry-run and freshness
logic should live in its own PR. Depending on merge order, either #4 should rebase
onto this branch to use the port contract, or this branch should rebase after #4
while keeping the PR scope limited to service ports and adapters.
