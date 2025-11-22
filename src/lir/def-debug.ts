import type { Type } from "./def"

export function printType({ k, v }: Type): string {
  return { k, v }.toString()
}
