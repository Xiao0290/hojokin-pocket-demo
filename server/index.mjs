#!/usr/bin/env node
import http from 'node:http'
import {
  analytics,
  authUser,
  confirmBusinessPlanDraft,
  createBusinessPlan,
  createDiagnosis,
  createLead,
  devLogin,
  exportPlan,
  configureServicePortsFromEnv,
  getAdminSourceReview,
  getDiagnosis,
  getDiagnosisEvents,
  getLlmUsageSummary,
  getMatches,
  getPlan,
  getPlanEvents,
  getRound,
  listUserData,
  patchPlanSection,
  readExportDownload,
  recommendExperts,
  submitBusinessPlan,
  updateApplicantConfirmations,
  updateNotificationSettings,
} from './services.mjs'
import { resetStore } from './store.mjs'
import { readBody, sendError, sendJson } from './utils.mjs'

const port = Number(process.env.API_PORT || 8787)

configureServicePortsFromEnv()

if (process.env.RESET_STORE === '1') {
  await resetStore()
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders())
      res.end()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
    const pathname = url.pathname

    if (req.method === 'GET' && (pathname === '/health' || pathname === '/v1/health' || pathname === '/ready' || pathname === '/v1/ready')) {
      sendJson(res, 200, { ok: true, service: 'hojokin-pocket-api', time: new Date().toISOString() })
      return
    }

    if (req.method === 'GET' && pathname.startsWith('/exports/')) {
      await sendExport(req, res, pathname, url.searchParams.get('token'))
      return
    }

    if (req.method === 'POST' && pathname === '/v1/auth/dev-login') {
      sendJson(res, 200, await devLogin())
      return
    }

    if (req.method === 'GET' && pathname === '/v1/me') {
      sendJson(res, 200, { user: authUser(), ...(await listUserData()) })
      return
    }

    if (req.method === 'GET' && pathname === '/v1/me/diagnoses') {
      const data = await listUserData()
      sendJson(res, 200, { diagnoses: data.diagnoses, companies: data.companies, plans: data.plans })
      return
    }

    if (req.method === 'PUT' && pathname === '/v1/me/notifications/settings') {
      sendJson(res, 200, await updateNotificationSettings(await readBody(req)))
      return
    }

    if (req.method === 'GET' && (pathname === '/v1/analytics' || pathname === '/v1/analytics/events')) {
      sendJson(res, 200, await analytics())
      return
    }

    if (req.method === 'GET' && pathname === '/v1/admin/llm-usage') {
      sendJson(res, 200, await getLlmUsageSummary({ limit: Number(url.searchParams.get('limit') || 20) }))
      return
    }

    if (req.method === 'GET' && pathname === '/v1/admin/source-review') {
      sendJson(res, 200, await getAdminSourceReview())
      return
    }

    if (req.method === 'POST' && pathname === '/v1/diagnoses') {
      const body = await readBody(req)
      sendJson(res, 202, await createDiagnosis(body.url, { attested: body.attested === true }))
      return
    }

    const diagnosisStatus = pathname.match(/^\/v1\/diagnoses\/([^/]+)$/)
    if (req.method === 'GET' && diagnosisStatus) {
      const diagnosis = await getDiagnosis(decodeURIComponent(diagnosisStatus[1]))
      if (!diagnosis) return sendError(res, 404, 'NOT_FOUND', '診断が見つかりません')
      sendJson(res, 200, diagnosis)
      return
    }

    const diagnosisEvents = pathname.match(/^\/v1\/diagnoses\/([^/]+)\/events$/)
    if (req.method === 'GET' && diagnosisEvents) {
      await sendSse(res, () => getDiagnosisEvents(decodeURIComponent(diagnosisEvents[1])), ['diagnosis.done', 'diagnosis.error'])
      return
    }

    const diagnosisMatches = pathname.match(/^\/v1\/diagnoses\/([^/]+)\/matches$/)
    if (req.method === 'GET' && diagnosisMatches) {
      const result = await getMatches(decodeURIComponent(diagnosisMatches[1]))
      if (!result) return sendError(res, 404, 'NOT_FOUND', '診断が見つかりません')
      sendJson(res, 200, result)
      return
    }

    const diagnosisConfirmations = pathname.match(/^\/v1\/diagnoses\/([^/]+)\/applicant-confirmations$/)
    if ((req.method === 'POST' || req.method === 'PUT') && diagnosisConfirmations) {
      const body = await readBody(req)
      sendJson(res, 200, await updateApplicantConfirmations(decodeURIComponent(diagnosisConfirmations[1]), body))
      return
    }

    const roundDetail = pathname.match(/^\/v1\/subsidies\/rounds\/([^/]+)$/)
    if (req.method === 'GET' && roundDetail) {
      const round = getRound(decodeURIComponent(roundDetail[1]))
      if (!round) return sendError(res, 404, 'NOT_FOUND', '補助金が見つかりません')
      sendJson(res, 200, round)
      return
    }

    if (req.method === 'GET' && pathname === '/v1/experts/recommendations') {
      sendJson(res, 200, await recommendExperts({
        diagnosisId: url.searchParams.get('diagnosisId') || undefined,
        roundId: url.searchParams.get('roundId') || undefined,
        limit: Number(url.searchParams.get('limit') || 4),
      }))
      return
    }

    if (req.method === 'POST' && pathname === '/v1/business-plans') {
      sendJson(res, 202, await createBusinessPlan(await readBody(req)))
      return
    }

    const planStatus = pathname.match(/^\/v1\/business-plans\/([^/]+)$/)
    if (req.method === 'GET' && planStatus) {
      const plan = await getPlan(decodeURIComponent(planStatus[1]))
      if (!plan) return sendError(res, 404, 'NOT_FOUND', '計画書が見つかりません')
      sendJson(res, 200, plan)
      return
    }

    const planEvents = pathname.match(/^\/v1\/business-plans\/([^/]+)\/events$/)
    if (req.method === 'GET' && planEvents) {
      await sendSse(res, () => getPlanEvents(decodeURIComponent(planEvents[1])), ['plan.completed', 'plan.error'])
      return
    }

    const sectionPatch = pathname.match(/^\/v1\/business-plans\/([^/]+)\/sections\/(\d+)$/)
    if (req.method === 'PATCH' && sectionPatch) {
      const body = await readBody(req)
      sendJson(res, 200, await patchPlanSection(decodeURIComponent(sectionPatch[1]), sectionPatch[2], body.body, body.status))
      return
    }

    const planConfirmation = pathname.match(/^\/v1\/business-plans\/([^/]+)\/confirmation$/)
    if ((req.method === 'POST' || req.method === 'PUT') && planConfirmation) {
      const body = await readBody(req)
      sendJson(res, 200, await confirmBusinessPlanDraft(decodeURIComponent(planConfirmation[1]), body))
      return
    }

    const exportRoute = pathname.match(/^\/v1\/business-plans\/([^/]+)\/export$/)
    if (req.method === 'POST' && exportRoute) {
      const body = await readBody(req)
      sendJson(res, 200, await exportPlan(decodeURIComponent(exportRoute[1]), body.format))
      return
    }

    const submissionRoute = pathname.match(/^\/v1\/business-plans\/([^/]+)\/submission$/)
    if (req.method === 'POST' && submissionRoute) {
      const body = await readBody(req)
      sendJson(res, 200, await submitBusinessPlan(decodeURIComponent(submissionRoute[1]), body))
      return
    }

    if (req.method === 'POST' && pathname === '/v1/leads/expert') {
      sendJson(res, 200, await createLead(await readBody(req)))
      return
    }

    sendError(res, 404, 'NOT_FOUND', 'エンドポイントが見つかりません', { pathname })
  } catch (error) {
    const status = error.status || 500
    sendError(res, status, error.code || 'INTERNAL_ERROR', error.message || 'サーバーエラー', error.details || {})
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Hojokin Pocket API listening on http://127.0.0.1:${port}`)
})

function corsHeaders(extra = {}) {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,OPTIONS',
    ...extra,
  }
}

async function sendSse(res, loadEvents, doneNames) {
  res.writeHead(200, corsHeaders({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  }))

  let sent = 0
  let closed = false
  reqClose(res, () => {
    closed = true
  })

  const started = Date.now()
  while (!closed && Date.now() - started < 60000) {
    const events = await loadEvents()
    for (const event of events.slice(sent)) {
      res.write(`event: ${event.event}\n`)
      res.write(`data: ${JSON.stringify(event.data)}\n\n`)
      sent += 1
      if (doneNames.includes(event.event)) {
        res.end()
        return
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!closed) res.end()
}

function reqClose(res, onClose) {
  res.on('close', onClose)
}

async function sendExport(req, res, pathname, token) {
  const filename = decodeURIComponent(pathname.replace(/^\/exports\//, ''))
  try {
    const download = await readExportDownload(filename, token)
    res.writeHead(200, corsHeaders({
      'content-type': download.contentType,
      'content-length': download.body.length,
    }))
    res.end(download.body)
  } catch {
    sendError(res, 404, 'NOT_FOUND', '出力ファイルが見つかりません')
  }
}
