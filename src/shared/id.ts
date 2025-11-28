import { lIce as iceLir } from "@/lir/error"
import { dim, reset } from "./ansi"

// INVARIANT: `uid` is never used as an identifier
let uid = 0

export class Id {
  readonly index = uid++

  constructor(readonly name: string) {}

  fresh() {
    return new Id(this.name)
  }

  get uid(): string {
    return `_${this.index.toString(36)}/*${this.name}*/`
  }

  get debug(): string {
    return `${this.name}${dim}${reset}`
    return `${this.name}${dim}_${this.index.toString(36)}${reset}`
  }

  toString(): string {
    iceLir(`'Id' cannot be coerced to a string. Access .uid instead.`)
  }

  [Symbol.for("nodejs.util.inspect.custom")]() {
    return this.debug
  }
}

export function nextUid() {
  return uid++
}

const named: Record<string, Id> = Object.create(null)

export function idFor(name: string) {
  return (named[name] ??= new Id(name))
}
