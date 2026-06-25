import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAuthContext,
  isProductionLikeEnvironment,
  publicAuthContext,
  resolveAuthEnvironment,
} from '../server/authContext.mjs'
import {
  authContext,
  authUser,
  devLogin,
  resetServicePorts,
} from '../server/services.mjs'
import { resetStore } from '../server/store.mjs'

test('AuthContext carries user, role, organization, provider, and scoped access', () => {
  const context = createAuthContext({
    user: { id: 'auth_user_1', email: 'auth@example.test', role: 'member' },
    organizationId: 'org_auth_1',
    provider: 'cognito',
    tokenType: 'access-token',
    env: { APP_ENV: 'staging-preview' },
    issuedAt: '2026-06-20T00:00:00.000Z',
  })

  assert.equal(context.userId, 'auth_user_1')
  assert.equal(context.role, 'member')
  assert.equal(context.organizationId, 'org_auth_1')
  assert.equal(context.provider, 'cognito')
  assert.equal(context.environment, 'staging-preview')
  assert.equal(context.isProductionLike, false)
  assert.deepEqual(context.accessScope, {
    userId: 'auth_user_1',
    role: 'member',
    organizationId: 'org_auth_1',
  })
  assert.deepEqual(publicAuthContext(context), {
    userId: 'auth_user_1',
    organizationId: 'org_auth_1',
    role: 'member',
    provider: 'cognito',
    environment: 'staging-preview',
    isProductionLike: false,
  })
})

test('AuthContext rejects local mock auth in production-like environments', () => {
  for (const env of [
    { APP_ENV: 'production' },
    { APP_ENV: 'staging' },
    { APP_ENV: 'beta' },
    { APP_ENV: 'closed-beta' },
    { NODE_ENV: 'production' },
  ]) {
    assert.throws(
      () => createAuthContext({
        user: { id: 'auth_user_prod', email: 'prod@example.test', role: 'owner' },
        provider: 'local_mock',
        tokenType: 'dev-token',
        env,
      }),
      /Production-like environments cannot use local mock authentication/,
    )
  }
})

test('AuthContext environment helpers classify explicit environments', () => {
  assert.equal(resolveAuthEnvironment({ APP_ENV: 'BETA', NODE_ENV: 'development' }), 'beta')
  assert.equal(resolveAuthEnvironment({ NODE_ENV: 'test' }), 'test')
  assert.equal(isProductionLikeEnvironment({ APP_ENV: 'closed-beta' }), true)
  assert.equal(isProductionLikeEnvironment({ APP_ENV: 'development' }), false)
})

test('service dev login remains available locally and fails closed in production-like env', async () => {
  const previousAppEnv = process.env.APP_ENV
  const previousNodeEnv = process.env.NODE_ENV
  try {
    delete process.env.APP_ENV
    process.env.NODE_ENV = 'test'
    resetServicePorts()
    await resetStore()

    const login = await devLogin()
    assert.equal(login.token, 'dev-token')
    assert.equal(login.user.id, 'usr_dev_owner')
    assert.equal(login.authContext.provider, 'local_mock')
    assert.equal(authUser().id, 'usr_dev_owner')
    assert.equal(authContext().accessScope.userId, 'usr_dev_owner')

    process.env.APP_ENV = 'production'
    await assert.rejects(
      () => devLogin(),
      (error) => error.code === 'AUTH_PROVIDER_NOT_ALLOWED' && error.status === 500,
    )
    assert.throws(
      () => authUser(),
      (error) => error.code === 'AUTH_PROVIDER_NOT_ALLOWED' && error.status === 500,
    )
  } finally {
    resetServicePorts()
    if (previousAppEnv === undefined) delete process.env.APP_ENV
    else process.env.APP_ENV = previousAppEnv
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
  }
})
