export function toAccessScope(userOrScope) {
  const userId = typeof userOrScope === 'string' ? userOrScope : userOrScope?.userId || userOrScope?.id
  if (!userId) {
    throw Object.assign(new Error('認証ユーザーを確認してください'), {
      status: 401,
      code: 'AUTH_REQUIRED',
    })
  }
  return {
    userId,
    role: userOrScope?.role || 'owner',
  }
}

export function isOwnedBy(record, scopeLike) {
  if (!record) return false
  const scope = toAccessScope(scopeLike)
  return record.userId === scope.userId
}

export function filterOwned(records = [], scopeLike) {
  const scope = toAccessScope(scopeLike)
  return records.filter((record) => record?.userId === scope.userId)
}

export function findOwned(records = [], scopeLike, predicate = () => true) {
  const scope = toAccessScope(scopeLike)
  return records.find((record) => record?.userId === scope.userId && predicate(record)) || null
}

export function accessDeniedAsNotFoundError(label = 'record') {
  return Object.assign(new Error(`${label} not found`), {
    status: 404,
    code: 'NOT_FOUND',
  })
}
