export const PRODUCTION_LIKE_ENVIRONMENTS = Object.freeze(['production', 'staging', 'beta', 'closed-beta'])
export const MOCK_AUTH_PROVIDERS = Object.freeze(['local_mock', 'dev_mock'])
export const MOCK_TOKEN_TYPES = Object.freeze(['dev-token', 'implicit-current-user'])

export function createAuthContext({
  user,
  organizationId = null,
  role = user?.role || 'owner',
  provider = 'local_mock',
  tokenType = 'implicit-current-user',
  env = process.env,
  issuedAt = new Date().toISOString(),
} = {}) {
  if (!user?.id && !user?.userId) {
    throw authError('AUTH_REQUIRED', '認証ユーザーを確認してください', 401)
  }
  const environment = resolveAuthEnvironment(env)
  const isProductionLike = isProductionLikeEnvironment(environment)
  if (isProductionLike && (MOCK_AUTH_PROVIDERS.includes(provider) || MOCK_TOKEN_TYPES.includes(tokenType))) {
    throw authError(
      'AUTH_PROVIDER_NOT_ALLOWED',
      'Production-like environments cannot use local mock authentication.',
      500,
      { environment, provider, tokenType },
    )
  }
  const userId = user.id || user.userId
  return Object.freeze({
    user,
    userId,
    organizationId,
    role,
    provider,
    tokenType,
    environment,
    isProductionLike,
    issuedAt,
    accessScope: Object.freeze({
      userId,
      role,
      organizationId,
    }),
  })
}

export function publicAuthContext(authContext) {
  return {
    userId: authContext.userId,
    organizationId: authContext.organizationId,
    role: authContext.role,
    provider: authContext.provider,
    environment: authContext.environment,
    isProductionLike: authContext.isProductionLike,
  }
}

export function resolveAuthEnvironment(env = process.env) {
  return String(env.APP_ENV || env.NODE_ENV || 'development').toLowerCase()
}

export function isProductionLikeEnvironment(environmentOrEnv = process.env) {
  const environment = typeof environmentOrEnv === 'string'
    ? environmentOrEnv.toLowerCase()
    : resolveAuthEnvironment(environmentOrEnv)
  return PRODUCTION_LIKE_ENVIRONMENTS.includes(environment)
}

function authError(code, message, status, details = {}) {
  return Object.assign(new Error(message), { code, status, details })
}
