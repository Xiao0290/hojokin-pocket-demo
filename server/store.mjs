import { createInitialStore, defaultStoreRepository } from './storeRepository.mjs'

export const initialStore = createInitialStore

export async function loadStore() {
  return defaultStoreRepository.load()
}

export async function saveStore(store) {
  return defaultStoreRepository.save(store)
}

export async function resetStore() {
  return defaultStoreRepository.reset()
}

export function mutateStore(mutator) {
  return defaultStoreRepository.mutate(mutator)
}

export async function appendAudit(event, payload = {}, scopeLike, options = {}) {
  return defaultStoreRepository.appendAudit(event, payload, scopeLike, options)
}
