declare module 'virtual:majesticons' {
  /** name → [solid layer (may be missing), line layer], each as inner SVG markup. */
  const icons: Record<string, [string | null, string]>
  export default icons
}
