export const SERVICE_PORTS = Object.freeze({
  SubsidyDataSource: Object.freeze(['listActiveRounds', 'getRound']),
  DiagnosisExtractor: Object.freeze(['extract']),
  PlanGenerator: Object.freeze(['createSections']),
  Matcher: Object.freeze(['match']),
  AuthProvider: Object.freeze(['currentUser', 'devLogin']),
  Notifier: Object.freeze(['createExpertWaitlistLead', 'updateSettings']),
  SubmissionAdapter: Object.freeze(['submit']),
})

export const SERVICE_PORT_CONTRACTS = Object.freeze({
  SubsidyDataSource: {
    responsibility: 'Read normalized subsidy rounds from a replaceable source.',
    input: {
      listActiveRounds: 'void',
      getRound: '{ roundId: string }',
    },
    output: {
      listActiveRounds: 'SubsidyRound[]',
      getRound: 'SubsidyRound | null',
    },
  },
  DiagnosisExtractor: {
    responsibility: 'Convert an attested public company URL into a cited company profile.',
    input: {
      extract: '{ url: URL }',
    },
    output: {
      extract: '{ profile, html: string, finalUrl: string, warnings: string[] }',
    },
  },
  PlanGenerator: {
    responsibility: 'Create applicant-reviewable business plan draft sections from company and subsidy data.',
    input: {
      createSections: '{ profile, round, targetChars?: number }',
    },
    output: {
      createSections: 'PlanSection[] with sources, status, charCount, and confirmation flags',
    },
  },
  Matcher: {
    responsibility: 'Rank eligible subsidy rounds against an extracted company profile.',
    input: {
      match: '{ diagnosisId: string, profile, rounds: SubsidyRound[] }',
    },
    output: {
      match: 'Match[] sorted by rank, excluding ineligible closed rounds',
    },
  },
  AuthProvider: {
    responsibility: 'Resolve the current user and provide the local development login flow.',
    input: {
      currentUser: 'void',
      devLogin: '{ email?: string, displayName?: string }',
    },
    output: {
      currentUser: 'User',
      devLogin: '{ token: string, user: User }',
    },
  },
  Notifier: {
    responsibility: 'Persist notification preferences and non-operational expert waitlist leads.',
    input: {
      createExpertWaitlistLead: '{ diagnosisId?: string, roundId?: string, expertId?: string, message?: string }',
      updateSettings: '{ push?: boolean, email?: boolean, deadline?: boolean }',
    },
    output: {
      createExpertWaitlistLead: '{ ok: true, status: "waitlisted", leadId: string }',
      updateSettings: 'NotificationSettings',
    },
  },
  SubmissionAdapter: {
    responsibility: 'Represent future official submission handoff without performing network submission.',
    input: {
      submit: '{ plan, payload?: object }',
    },
    output: {
      submit: '{ ok: false, status: "blocked", reason: "notConfigured" }',
    },
  },
})

export function assertServicePorts(ports) {
  for (const [portName, methods] of Object.entries(SERVICE_PORTS)) {
    const candidate = ports?.[portName]
    if (!candidate || typeof candidate !== 'object') {
      throw new TypeError(`Missing service port: ${portName}`)
    }
    for (const method of methods) {
      if (typeof candidate[method] !== 'function') {
        throw new TypeError(`Missing service port method: ${portName}.${method}`)
      }
    }
  }
  return ports
}

export function describeServicePorts() {
  return Object.entries(SERVICE_PORT_CONTRACTS).map(([name, contract]) => ({
    name,
    ...contract,
    methods: SERVICE_PORTS[name],
  }))
}
