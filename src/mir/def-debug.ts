import { T } from "@/shared/enum"
import type { ConstIntR, TypeR } from "./def"

export function printConstIntR({ data: { k, v } }: ConstIntR): string {
  switch (k) {
    case T.Int:
      return "" + v
    case T.Param:
      return v.data.debug
  }
}

export function printTypeR({ data: { k, v } }: TypeR): string {
  switch (k) {
    case T.Void:
      return "void"
    case T.Never:
      return "!"
    case T.Int:
      return "int"
    case T.Bool:
      return "bool"
    case T.Extern:
      return v.data.debug
    case T.Adt:
      return v.def.id.data.debug + (v.args.length ? "<...>" : "")
    case T.Array:
      return `(${printTypeR(v.el)}; ${printConstIntR(v.len)})`
    case T.Tuple:
      return `@(${v.map(printTypeR).join(", ")}${v.length == 1 ? "," : ""})`
    case T.Param:
      return v.data.debug
    case T.UnitIn:
      return `in ${printTypeR(v)}`
    case T.Maybe:
      return `?${printTypeR(v)}`
  }
}
