import { ice } from "./error"

// INVARIANT: `uid` is never used as an identifier
let uid = 0

export class Id {
  readonly index = uid++

  constructor(readonly name: string) {}

  fresh() {
    return new Id(this.name)
  }

  get uid() {
    return `_${this.index.toString(36)}/*${this.name}*/`
  }

  toString() {
    ice(`'Id' cannot be coerced to a string. Access .uid instead.`)
  }
}
