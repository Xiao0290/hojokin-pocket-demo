# Bedrock LLM Cost Control

This project can use Amazon Bedrock Claude for staging plan-draft generation, but
real LLM calls are disabled by default.

## Default

`LLM_PROVIDER=local` is the default. It uses the deterministic subsidy-specific
template generator and does not call AWS.

CI must keep this default. Do not set `LLM_PROVIDER=bedrock` in GitHub Actions
unless a separate paid-LLM integration job is explicitly approved.

## Enable Bedrock Locally Or In Staging

Required environment:

Before enabling paid calls, submit the Anthropic first-time-use model use-case
details form. If this is missing, Bedrock returns
`Model use case details have not been submitted for this account`.

Use an inference profile ID for current Claude models in Tokyo/APAC. Direct
foundation model IDs can return `on-demand throughput is not supported`. The
initial staging model is Claude 3.5 Sonnet v2 because its pricing is explicit
and it is sufficient for applicant-reviewable plan drafts. Use Haiku for cheap
connectivity smoke tests.

```bash
LLM_PROVIDER=bedrock
AWS_REGION=ap-northeast-1
BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_SMOKE_MODEL_ID=apac.anthropic.claude-3-haiku-20240307-v1:0
LLM_DAILY_BUDGET_USD=5
LLM_MONTHLY_BUDGET_USD=50
LLM_MAX_REQUEST_USD=0.25
LLM_MAX_OUTPUT_TOKENS=2200
LLM_MAX_INPUT_CHARS=18000
```

## What The Owner Must Provide

Before the product can use real Bedrock generation, the owner must provide or
confirm:

- AWS account ID and target Region.
- AWS CLI profile or runtime IAM role with Bedrock runtime permissions.
- Anthropic model access/use-case details submitted in the Bedrock console.
- The inference profile ID to use, for example
  `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`.
- App-side budget caps: daily, monthly, per-request, max output tokens, and max
  input characters.
- AWS Budgets alert destination, such as an owner email address or SNS topic.

Do not provide AWS root credentials, access keys in chat, or customer data.

The server refuses to create the Bedrock adapter if the daily, monthly, and
per-request caps are missing. If a request exceeds an app-side cap, the service
falls back to the deterministic template generator and marks the plan generation
provenance as `PlanGenerator.localMockFallback`.

## What The LLM May Do

- Generate applicant-reviewable Japanese business-plan draft sections.
- Use the already-selected subsidy round, company profile, template metadata,
  required documents, and source references.
- Mark unknown or unsupported values as confirmation items.

## What The LLM Must Not Do

- Select the subsidy match itself.
- Claim adoption probability or eligibility guarantees.
- Perform proxy drafting/submission or official filing.
- Introduce marketplace, success-fee, platform-take-rate, payment, or jGrants
  POST behavior.

## AWS Account Controls

The app-side ledger is a safety layer, not a billing guarantee. Pair it with AWS
Budgets before enabling Bedrock in staging.

Recommended initial budget:

- Monthly budget: `50 USD`
- Alert thresholds: `50%`, `80%`, `100%`
- Notification: owner email or SNS topic

Example CLI shape:

```bash
aws budgets create-budget \
  --account-id "$AWS_ACCOUNT_ID" \
  --budget file://budget.json \
  --notifications-with-subscribers file://budget-notifications.json
```

Keep the budget JSON outside the repository if it contains personal email
addresses. The repository should not store AWS credentials, account secrets, or
customer data.

## Bedrock Readiness Preflight

The repository includes a manual AWS preflight helper. It is read-only by
default:

```bash
npm run bedrock:preflight
```

It checks the current AWS caller, Anthropic FTU form status, inference profile
base models, foundation model availability, and relevant Bedrock Service Quotas.
It exits non-zero when Bedrock is not ready.

Explicit state-changing switches are available for account setup:

```bash
BEDROCK_USE_CASE_COMPANY_NAME="Hojokin Pocket" \
BEDROCK_USE_CASE_COMPANY_WEBSITE="https://www.sample-corp.example" \
BEDROCK_USE_CASE_INTENDED_USERS=2 \
BEDROCK_USE_CASE_INDUSTRY_OPTION="Information Technology" \
BEDROCK_USE_CASE_OTHER_INDUSTRY_OPTION="AI-assisted subsidy matching and administrative services for Japanese SMEs" \
BEDROCK_USE_CASES="Closed-beta subsidy diagnosis, matching explanation, and applicant-reviewable draft plan generation for Japanese SMEs. No proxy filing, no legal representation, and human review remains required." \
node scripts/bedrock-readiness.mjs --submit-use-case
```

```bash
node scripts/bedrock-readiness.mjs --create-agreement
```

Only run the paid smoke command after preflight passes or when intentionally
checking the current Bedrock blocker:

```bash
npm run bedrock:smoke
```

If the smoke call returns `Too many tokens per day`, check Service Quotas for
the selected profile's base models. In a newly enabled account, relevant quota
values can remain `0` until AWS finishes unlocking access.

## Per-Run Token And Cost Ledger

Every Bedrock plan-generation attempt is recorded in the local LLM usage ledger.
The ledger records:

- request id, plan id, company id, subsidy round id, and template id;
- provider, model/inference-profile id, status, and request kind;
- input tokens, output tokens, estimated cost, actual estimated cost, and
  currency;
- status values such as `completed`, `budget_denied`, `provider_error`, and
  `invalid_output`.

Budget-denied runs record the estimated tokens and estimated cost, but
`actualCostUsd = 0` because Bedrock is not called. Completed runs use Bedrock
returned token usage when available.

Owner/admin usage API:

```bash
curl http://127.0.0.1:8787/v1/admin/llm-usage
```

The response includes today, month, all-time totals, status rollups, model
rollups, and recent run rows. The My Page owner view also shows a compact
summary.

## Verification

Free local verification:

```bash
npm run verify:ci
```

Paid Bedrock smoke test:

```bash
LLM_PROVIDER=bedrock \
AWS_REGION=ap-northeast-1 \
BEDROCK_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0 \
BEDROCK_SMOKE_MODEL_ID=apac.anthropic.claude-3-haiku-20240307-v1:0 \
LLM_DAILY_BUDGET_USD=5 \
LLM_MONTHLY_BUDGET_USD=50 \
LLM_MAX_REQUEST_USD=0.25 \
npm run bedrock:smoke
```

After Bedrock smoke passes, start the API with the same environment and run one
SAMPLE plan-generation flow. Do not run repeated paid tests without checking
`data/runtime/llm-usage.jsonl`, `GET /v1/admin/llm-usage`, and the AWS Billing
console.
