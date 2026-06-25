#!/usr/bin/env node

/**
 * Phase 1 MVP local E2E skeleton.
 *
 * This script intentionally uses only Node built-ins so it can run before the
 * project test runner is wired into package.json.
 *
 * Defaults:
 *   API_BASE_URL=http://127.0.0.1:8787
 *   FRONTEND_BASE_URL=http://127.0.0.1:5173
 *
 * Usage:
 *   node scripts/e2e-phase1-mvp.mjs
 */

const config = {
  apiBaseUrl: normalizeBaseUrl(process.env.API_BASE_URL || 'http://127.0.0.1:8787'),
  frontendBaseUrl: normalizeBaseUrl(process.env.FRONTEND_BASE_URL || 'http://127.0.0.1:5173'),
  companyUrl: process.env.E2E_COMPANY_URL || 'https://www.sample-corp.example',
  devLoginEmail: process.env.E2E_DEV_LOGIN_EMAIL || 'phase1-owner@example.test',
  requestTimeoutMs: numberFromEnv('E2E_REQUEST_TIMEOUT_MS', 15_000),
  healthTimeoutMs: numberFromEnv('E2E_HEALTH_TIMEOUT_MS', 60_000),
  diagnosisTimeoutMs: numberFromEnv('E2E_DIAGNOSIS_TIMEOUT_MS', 90_000),
  planTimeoutMs: numberFromEnv('E2E_PLAN_TIMEOUT_MS', 90_000),
  pollIntervalMs: numberFromEnv('E2E_POLL_INTERVAL_MS', 1_500),
  requireAnalytics: process.env.E2E_ANALYTICS_OPTIONAL !== '1',
  analyticsExpectedEvents: csvFromEnv('E2E_ANALYTICS_EXPECT', [
    'diagnosis.completed',
    'confirmation.updated',
    'expert_recommendations.viewed',
    'business_plan.exported',
    'expert_waitlist.submitted',
    'notification.setting_changed',
  ]),
};

const endpointOverrides = {
  devLoginPath: process.env.E2E_DEV_LOGIN_PATH,
  analyticsPath: process.env.E2E_ANALYTICS_PATH,
};

const run = {
  id: `phase1-e2e-${new Date().toISOString()}`,
  token: process.env.E2E_TOKEN || '',
  userId: '',
  diagnosisId: '',
  companyId: '',
  roundId: '',
  expertId: '',
  planId: '',
  steps: [],
};

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelp();
  process.exit(0);
}

main().catch((error) => {
  console.error('\nE2E failed.');
  console.error(error.stack || error.message || error);
  printSummary('failed');
  process.exit(1);
});

async function main() {
  console.log(`Phase 1 MVP E2E run: ${run.id}`);
  console.log(`API: ${config.apiBaseUrl}`);
  console.log(`Frontend: ${config.frontendBaseUrl}`);
  console.log(`Company URL: ${config.companyUrl}`);

  await step('wait-api-health', () =>
    waitForHealthyEndpoint('API', config.apiBaseUrl, csvFromEnv('E2E_API_HEALTH_PATHS', [
      '/health',
      '/v1/health',
      '/ready',
      '/v1/ready',
    ])),
  );

  await step('wait-frontend-health', () =>
    waitForHealthyEndpoint('frontend', config.frontendBaseUrl, csvFromEnv('E2E_FRONTEND_HEALTH_PATHS', ['/'])),
  );

  await step('dev-login', devLogin);
  await step('create-diagnosis', createDiagnosis);
  await step('wait-diagnosis-done', waitForDiagnosisDone);
  await step('get-matches', getMatches);
  await step('get-detail', getSubsidyDetail);
  await step('get-expert-recommendations', getExpertRecommendations);
  await step('create-business-plan', createBusinessPlan);
  await step('wait-business-plan-done', waitForBusinessPlanDone);
  await step('patch-business-plan-section', patchBusinessPlanSection);
  await step('confirm-business-plan-draft', confirmBusinessPlanDraft);
  await step('export-docx', () => exportBusinessPlan('docx'));
  await step('export-pdf', () => exportBusinessPlan('pdf'));
  await step('expert-waitlist', submitExpertWaitlist);
  await step('notification-settings', updateNotificationSettings);
  await step('analytics', verifyAnalytics);

  printSummary('passed');
}

async function devLogin() {
  if (run.token) {
    console.log('  using E2E_TOKEN from environment');
    return;
  }

  const candidates = endpointOverrides.devLoginPath
    ? [endpointOverrides.devLoginPath]
    : ['/v1/auth/dev-login', '/v1/dev-login', '/v1/auth/dev', '/auth/dev-login'];

  const payload = {
    email: config.devLoginEmail,
    displayName: 'Phase 1 E2E Owner',
  };

  const result = await firstSuccessfulJson('POST', candidates, payload, {
    continueOnStatuses: [404, 405],
  });

  run.token = pickString(result.body, [
    'token',
    'accessToken',
    'access_token',
    'session.accessToken',
    'session.access_token',
  ]);
  run.userId = pickString(result.body, ['userId', 'user.id', 'id']);

  assert(run.token, `dev-login succeeded at ${result.path}, but no token/accessToken was returned`);
  console.log(`  authenticated through ${result.path}`);
}

async function createDiagnosis() {
  const body = await jsonRequest('POST', '/v1/diagnoses', {
    url: config.companyUrl,
    attested: true,
  });

  run.diagnosisId = pickString(body, ['diagnosisId', 'diagnosis_id', 'id']);
  run.companyId = pickString(body, ['companyId', 'company_id', 'company.id']);

  assert(run.diagnosisId, 'POST /v1/diagnoses did not return diagnosisId');
  assert(['pending', 'scraping', 'extracting', 'matching', 'done'].includes(String(body.status || '')),
    `POST /v1/diagnoses returned unexpected status: ${body.status}`);

  console.log(`  diagnosisId=${run.diagnosisId}`);
}

async function waitForDiagnosisDone() {
  const eventPath = `/v1/diagnoses/${encodeURIComponent(run.diagnosisId)}/events`;
  const sse = await readSseUntil(eventPath, {
    timeoutMs: Math.min(config.diagnosisTimeoutMs, 45_000),
    isDone: (event) => event.name === 'diagnosis.done' || event.data?.status === 'done',
    isError: (event) => event.name === 'diagnosis.error' || event.data?.status === 'failed',
  }).catch((error) => {
    console.log(`  SSE unavailable, falling back to polling: ${shortError(error)}`);
    return null;
  });

  if (sse?.done) {
    console.log(`  diagnosis done via SSE after ${sse.events.length} events`);
    return;
  }

  const diagnosis = await pollJson(`/v1/diagnoses/${encodeURIComponent(run.diagnosisId)}`, {
    timeoutMs: config.diagnosisTimeoutMs,
    isDone: (body) => body.status === 'done' || body.completedAt || body.completed_at,
    isFailed: (body) => body.status === 'failed' || body.error,
  });

  run.companyId ||= pickString(diagnosis, ['companyId', 'company_id', 'company.id']);
  console.log('  diagnosis done via polling');
}

async function getMatches() {
  const body = await jsonRequest('GET', `/v1/diagnoses/${encodeURIComponent(run.diagnosisId)}/matches`);
  const matches = arrayFrom(body, ['matches', 'data.matches', 'data', 'items']);

  assert(matches.length > 0, 'matches response did not contain any subsidy matches');
  assert(!matches.some((match) => match.eligible === false), 'matches response contains eligible=false entries');

  const first = matches.find((match) => match.eligible !== false) || matches[0];
  run.roundId = pickString(first, ['roundId', 'round_id', 'round.id', 'subsidyRoundId']);
  run.companyId ||= pickString(body, ['companyId', 'company_id', 'company.id', 'data.company.id']);

  assert(run.roundId, 'first match did not include roundId');

  console.log(`  matches=${matches.length}, first roundId=${run.roundId}`);
}

async function getSubsidyDetail() {
  const body = await jsonRequest('GET', `/v1/subsidies/rounds/${encodeURIComponent(run.roundId)}`);

  assert(pickString(body, ['roundId', 'round_id', 'id']) || run.roundId, 'detail response did not include round id');
  assert(arrayFrom(body, ['requirements']).length > 0, 'detail response should include requirements');
  assert(arrayFrom(body, ['requiredDocuments', 'required_documents']).length > 0,
    'detail response should include requiredDocuments');

  console.log(`  detail loaded for ${pickString(body, ['program.name', 'programName', 'name']) || run.roundId}`);
}

async function getExpertRecommendations() {
  const body = await jsonRequest('GET', `/v1/experts/recommendations?diagnosisId=${encodeURIComponent(run.diagnosisId)}&roundId=${encodeURIComponent(run.roundId)}&limit=4`);
  const recommendations = arrayFrom(body, ['recommendations', 'experts', 'data']);

  assert(recommendations.length >= 3, 'expert recommendations should include at least 3 candidates');
  assert(recommendations.every(isAcceptedExpertRecommendation),
    'each expert recommendation should be strong-scored or an explicit caveated fallback candidate');
  assert(recommendations.every((expert) => pickString(expert, ['sourceUrl', 'websiteUrl']).startsWith('https://')),
    'each expert recommendation should include an official source URL');

  run.expertId = pickString(recommendations[0], ['id', 'expertId']);
  assert(run.expertId, 'first expert recommendation did not include id');
  console.log(`  experts=${recommendations.length}, first expertId=${run.expertId}`);
}

async function createBusinessPlan() {
  if (!run.companyId) {
    const diagnosis = await jsonRequest('GET', `/v1/diagnoses/${encodeURIComponent(run.diagnosisId)}`);
    run.companyId = pickString(diagnosis, ['companyId', 'company_id', 'company.id']);
  }

  assert(run.companyId, 'companyId is required before creating a business plan');

  const body = await jsonRequest('POST', '/v1/business-plans', {
    companyId: run.companyId,
    roundId: run.roundId,
    targetChars: 4200,
  });

  run.planId = pickString(body, ['planId', 'plan_id', 'id']);
  assert(run.planId, 'POST /v1/business-plans did not return planId');

  console.log(`  planId=${run.planId}`);
}

async function waitForBusinessPlanDone() {
  const eventPath = `/v1/business-plans/${encodeURIComponent(run.planId)}/events`;
  const sse = await readSseUntil(eventPath, {
    timeoutMs: Math.min(config.planTimeoutMs, 45_000),
    isDone: (event) => event.name === 'plan.completed' || event.data?.status === 'draft',
    isError: (event) => event.name === 'plan.error' || event.data?.status === 'failed',
  }).catch((error) => {
    console.log(`  plan SSE unavailable, falling back to polling: ${shortError(error)}`);
    return null;
  });

  if (sse?.done) {
    console.log(`  plan draft ready via SSE after ${sse.events.length} events`);
    return;
  }

  await pollJson(`/v1/business-plans/${encodeURIComponent(run.planId)}`, {
    timeoutMs: config.planTimeoutMs,
    isDone: (body) => ['draft', 'edited', 'exported'].includes(String(body.status || '')),
    isFailed: (body) => body.status === 'failed' || body.error,
  });

  console.log('  plan draft ready via polling');
}

async function patchBusinessPlanSection() {
  const plan = await jsonRequest('GET', `/v1/business-plans/${encodeURIComponent(run.planId)}`);
  const sections = arrayFrom(plan, ['sections', 'businessPlan.sections', 'data.sections']);
  const firstSection = sections[0] || {};
  const chapterNo = pickNumber(firstSection, ['chapterNo', 'chapter_no', 'no']) || 1;
  const previousBody = pickString(firstSection, ['body', 'content', 'text']);
  const nextBody = process.env.E2E_SECTION_BODY || [
    previousBody || 'E2E検証用の事業計画本文です。',
    '',
    `E2E edit marker: ${run.id}`,
  ].join('\n');

  const body = await jsonRequest('PATCH', `/v1/business-plans/${encodeURIComponent(run.planId)}/sections/${chapterNo}`, {
    body: nextBody,
    status: 'edited',
  });

  assert(body.status === 'edited' || pickString(body, ['section.status']) === 'edited',
    'PATCH section did not return edited status');

  console.log(`  chapterNo=${chapterNo} edited`);
}

async function confirmBusinessPlanDraft() {
  const body = await jsonRequest('POST', `/v1/business-plans/${encodeURIComponent(run.planId)}/confirmation`, {
    draftResponsibility: true,
    sourceReview: true,
    noDelegatedFiling: true,
  });

  assert(pickString(body, ['status']) === 'confirmed',
    'draft confirmation response should return confirmed status');
  assert(pickString(body, ['confirmationType', 'type']) === 'business_plan_draft_review',
    'draft confirmation should be logged as business_plan_draft_review');

  console.log('  applicant draft confirmation recorded');
}

async function exportBusinessPlan(format) {
  const body = await jsonRequest('POST', `/v1/business-plans/${encodeURIComponent(run.planId)}/export`, {
    format,
  });

  const fileUrl = pickString(body, ['fileUrl', 'file_url', 'url']);
  const exportId = pickString(body, ['exportId', 'export_id', 'id']);
  assert(fileUrl || exportId, `${format} export response did not include fileUrl or exportId`);
  assert(body.disclaimerIncluded !== false && body.disclaimer_included !== false,
    `${format} export response says disclaimer is not included`);

  if (fileUrl) {
    const response = await fetchWithTimeout(buildUrl(config.apiBaseUrl, fileUrl), {
      method: 'GET',
      headers: {
        accept: format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.8',
        ...authHeaders(),
      },
    }, config.requestTimeoutMs);
    assert(response.ok, `${format} export download returned HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length > 64, `${format} export download is unexpectedly small`);
    if (format === 'pdf') {
      assert(bytes.slice(0, 5).toString('utf8') === '%PDF-', 'pdf export is not a PDF file');
    } else {
      assert(bytes.slice(0, 2).toString('utf8') === 'PK', 'docx export is not a zip/docx file');
    }
  }

  console.log(`  ${format} export ok`);
}

async function submitExpertWaitlist() {
  const body = await jsonRequest('POST', '/v1/leads/expert', {
    diagnosisId: run.diagnosisId,
    roundId: run.roundId,
    expertId: run.expertId || undefined,
    message: `専門家相談が始まったら知らせてください。${run.id}`,
  });

  assert(body.ok === true || body.status === 'waitlisted',
    'expert waitlist response should be ok=true or status=waitlisted');

  console.log('  expert waitlist recorded');
}

async function updateNotificationSettings() {
  const body = await jsonRequest('PUT', '/v1/me/notifications/settings', {
    channels: {
      email: true,
      push: false,
    },
    types: {
      deadline: true,
      diagnosisDone: true,
      expertWaitlist: true,
    },
    deadlineReminderDays: [30, 14, 7],
  });

  assert(body.ok !== false, 'notification settings response returned ok=false');
  console.log('  notification settings updated');
}

async function verifyAnalytics() {
  const candidates = endpointOverrides.analyticsPath
    ? [endpointOverrides.analyticsPath]
    : ['/v1/analytics/events?limit=100', '/v1/admin/analytics/events?limit=100'];

  let result;
  try {
    result = await firstSuccessfulJson('GET', candidates, undefined, {
      continueOnStatuses: [404, 405],
    });
  } catch (error) {
    if (!config.requireAnalytics) {
      console.log(`  analytics endpoint unavailable but optional: ${shortError(error)}`);
      return;
    }
    throw error;
  }

  const events = arrayFrom(result.body, ['events', 'data.events', 'data', 'items']);
  assert(events.length > 0, `analytics endpoint ${result.path} returned no events`);

  const names = new Set(events.map((event) => pickString(event, ['name', 'eventName', 'event', 'type'])).filter(Boolean));
  const missing = config.analyticsExpectedEvents.filter((name) => !names.has(name));

  assert(missing.length === 0,
    `analytics endpoint ${result.path} is missing expected events: ${missing.join(', ')}`);

  console.log(`  analytics verified at ${result.path}`);
}

async function waitForHealthyEndpoint(label, baseUrl, paths) {
  const deadline = Date.now() + config.healthTimeoutMs;
  const attempts = [];

  while (Date.now() < deadline) {
    for (const path of paths) {
      const url = buildUrl(baseUrl, path);
      try {
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: { accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
        }, 5_000);

        attempts.push(`${path}:${response.status}`);

        if (response.status >= 200 && response.status < 400) {
          console.log(`  ${label} healthy at ${url}`);
          return;
        }
      } catch (error) {
        attempts.push(`${path}:${shortError(error)}`);
      }
    }

    await delay(750);
  }

  throw new Error(`${label} did not become healthy at ${baseUrl}. Attempts: ${attempts.slice(-12).join(', ')}`);
}

async function firstSuccessfulJson(method, paths, payload, options = {}) {
  const failures = [];

  for (const path of paths) {
    try {
      const body = await jsonRequest(method, path, payload, {
        allowStatuses: options.continueOnStatuses || [],
      });

      return { path, body };
    } catch (error) {
      if (error instanceof HttpError && (options.continueOnStatuses || []).includes(error.status)) {
        failures.push(`${path}:${error.status}`);
        continue;
      }

      failures.push(`${path}:${shortError(error)}`);
      throw error;
    }
  }

  throw new Error(`No candidate endpoint succeeded. Tried: ${failures.join(', ')}`);
}

async function jsonRequest(method, path, payload, options = {}) {
  const headers = {
    accept: 'application/json',
    ...authHeaders(),
  };

  const init = { method, headers };

  if (payload !== undefined) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(payload);
  }

  const response = await fetchWithTimeout(buildUrl(config.apiBaseUrl, path), init, config.requestTimeoutMs);
  const text = await response.text();
  const body = parseJsonOrText(text);

  if (!response.ok) {
    if ((options.allowStatuses || []).includes(response.status)) {
      throw new HttpError(response.status, method, path, body);
    }

    throw new HttpError(response.status, method, path, body);
  }

  return body;
}

async function pollJson(path, options) {
  const deadline = Date.now() + options.timeoutMs;
  let lastBody = null;

  while (Date.now() < deadline) {
    lastBody = await jsonRequest('GET', path);

    if (options.isFailed(lastBody)) {
      throw new Error(`Polling ${path} failed: ${JSON.stringify(lastBody)}`);
    }

    if (options.isDone(lastBody)) {
      return lastBody;
    }

    await delay(config.pollIntervalMs);
  }

  throw new Error(`Polling ${path} timed out. Last response: ${JSON.stringify(lastBody)}`);
}

async function readSseUntil(path, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`SSE timeout after ${options.timeoutMs}ms`)), options.timeoutMs);
  const events = [];
  let eventName = 'message';
  let dataLines = [];

  try {
    const response = await fetch(buildUrl(config.apiBaseUrl, path), {
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
        ...authHeaders(),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new HttpError(response.status, 'GET', path, await response.text());
    }

    if (!response.body) {
      throw new Error(`SSE response for ${path} has no body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const event = consumeSseLine(line);

        if (!event) continue;

        events.push(event);

        if (options.isError(event)) {
          throw new Error(`SSE ${path} reported error: ${JSON.stringify(event.data)}`);
        }

        if (options.isDone(event)) {
          await reader.cancel().catch(() => {});
          return { done: true, events };
        }
      }
    }

    return { done: false, events };
  } finally {
    clearTimeout(timeout);
  }

  function consumeSseLine(line) {
    if (line === '') {
      if (dataLines.length === 0) {
        eventName = 'message';
        return null;
      }

      const event = {
        name: eventName,
        data: parseJsonOrText(dataLines.join('\n')),
      };

      eventName = 'message';
      dataLines = [];
      return event;
    }

    if (line.startsWith(':')) return null;

    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
      return null;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
      return null;
    }

    return null;
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function step(name, fn) {
  const startedAt = Date.now();
  process.stdout.write(`\n[${name}]\n`);

  try {
    await fn();
    run.steps.push({ name, status: 'passed', ms: Date.now() - startedAt });
  } catch (error) {
    run.steps.push({ name, status: 'failed', ms: Date.now() - startedAt, error: shortError(error) });
    throw error;
  }
}

function authHeaders() {
  return run.token ? { authorization: `Bearer ${run.token}` } : {};
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function buildUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function parseJsonOrText(text) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function arrayFrom(source, paths) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (Array.isArray(value)) return value;
  }

  if (Array.isArray(source)) return source;
  return [];
}

function pickString(source, paths) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'number') return String(value);
  }

  return '';
}

function pickNumber(source, paths) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }

  return 0;
}

function isAcceptedExpertRecommendation(expert) {
  if (pickNumber(expert, ['score']) >= 7) return true;
  if (expert?.fallbackCandidate !== true) return false;
  if (pickString(expert, ['fitLevel']) !== 'candidate') return false;

  return arrayFrom(expert, ['reasons']).some((reason) =>
    typeof reason === 'string' && reason.includes('対応可否を確認'));
}

function getPath(source, path) {
  if (!source || typeof source !== 'object') return undefined;
  return path.split('.').reduce((current, part) => {
    if (!current || typeof current !== 'object') return undefined;
    return current[part];
  }, source);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function csvFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function shortError(error) {
  if (error instanceof HttpError) {
    return `${error.method} ${error.path} HTTP ${error.status}: ${stringifyShort(error.body)}`;
  }

  if (error?.name === 'AbortError') return 'timeout';
  return error?.message || String(error);
}

function stringifyShort(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

function printSummary(status) {
  console.log(`\nSummary: ${status}`);
  for (const item of run.steps) {
    const suffix = item.error ? ` - ${item.error}` : '';
    console.log(`  ${item.status.padEnd(6)} ${String(item.ms).padStart(5)}ms ${item.name}${suffix}`);
  }
}

function printHelp() {
  console.log(`
Phase 1 MVP local E2E skeleton

Command:
  node scripts/e2e-phase1-mvp.mjs

Important environment variables:
  API_BASE_URL                 default http://127.0.0.1:8787
  FRONTEND_BASE_URL            default http://127.0.0.1:5173
  E2E_TOKEN                    skip dev-login and use this Bearer token
  E2E_DEV_LOGIN_PATH           override dev-login endpoint
  E2E_COMPANY_URL              default https://www.sample-corp.example
  E2E_API_HEALTH_PATHS         comma-separated health paths
  E2E_FRONTEND_HEALTH_PATHS    comma-separated health paths
  E2E_ANALYTICS_PATH           override analytics events endpoint
  E2E_ANALYTICS_EXPECT         comma-separated expected analytics event names
  E2E_ANALYTICS_OPTIONAL=1     warn instead of failing when analytics is unavailable
`);
}

class HttpError extends Error {
  constructor(status, method, path, body) {
    super(`${method} ${path} failed with HTTP ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.method = method;
    this.path = path;
    this.body = body;
  }
}
