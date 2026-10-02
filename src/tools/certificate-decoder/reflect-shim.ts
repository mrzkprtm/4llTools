/**
 * @peculiar/x509 uses tsyringe, which refuses to load without the Reflect
 * metadata API. It only needs these three functions, so this tiny shim
 * replaces the reflect-metadata package. Import it before @peculiar/x509.
 */
type Meta = Map<unknown, unknown>
const store = new WeakMap<object, Meta>()
const R = Reflect as unknown as Record<string, unknown>

if (typeof R.getMetadata !== 'function') {
  const own = (target: object, key: unknown) => store.get(target)?.get(key)
  R.defineMetadata = (key: unknown, value: unknown, target: object) => {
    let m = store.get(target)
    if (!m) store.set(target, (m = new Map()))
    m.set(key, value)
  }
  R.getOwnMetadata = (key: unknown, target: object) => own(target, key)
  R.getMetadata = (key: unknown, target: object) => {
    for (let o: object | null = target; o; o = Object.getPrototypeOf(o)) {
      const v = own(o, key)
      if (v !== undefined) return v
    }
    return undefined
  }
}

export {}
