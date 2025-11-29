declare global {
  interface Console {
    log(...args: unknown[]): void
    error(...args: unknown[]): void
    time(label?: string): void
    timeEnd(label?: string): void
  }

  interface Bun {
    inspect(x: unknown): string
    stringWidth(x: string): number
  }

  var console: Console
  var Bun: Bun
}
