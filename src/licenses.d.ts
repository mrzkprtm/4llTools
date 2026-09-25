declare module 'virtual:licenses' {
  /** Every third-party package that can end up in the site, from package-lock.json. */
  const packages: { name: string; version: string; license: string; url?: string }[]
  export default packages
}
