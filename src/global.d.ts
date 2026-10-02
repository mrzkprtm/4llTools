import 'react'

declare module 'react' {
  interface DetailsHTMLAttributes<T> {
    defaultOpen?: boolean | undefined
  }
}
