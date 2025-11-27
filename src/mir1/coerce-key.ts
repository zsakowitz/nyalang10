import { T } from "@/shared/enum"
import { nextUid } from "@/shared/id"
import type { TypeR } from "./def"
import { printTypeR } from "./def-debug"
import { issue } from "./error"

export type CoercionKey = number & { readonly __coercion_key: unique symbol }

const CKEY_VOID = nextUid() as CoercionKey
const CKEY_NEVER = nextUid() as CoercionKey
const CKEY_INT = nextUid() as CoercionKey
const CKEY_BOOL = nextUid() as CoercionKey

const CKEY_EXTERN: Record<number, CoercionKey> = Object.create(null)
const CKEY_ADT: Record<number, CoercionKey> = Object.create(null)

export function tryAsCkey(type: TypeR): CoercionKey | null {
  const { k, v } = type.data

  switch (k) {
    case T.Void:
      return CKEY_VOID
    case T.Never:
      return CKEY_NEVER
    case T.Int:
      return CKEY_INT
    case T.Bool:
      return CKEY_BOOL
    case T.Extern:
      return (CKEY_EXTERN[v.data.index] ??= nextUid() as CoercionKey)
    case T.Adt:
      if (v.def.params.length) {
        return null
      }
      return (CKEY_ADT[v.def.id.data.index] ??= nextUid() as CoercionKey)
    case T.Array:
      return null
    case T.Tuple:
      return null
    case T.Param:
      return null
    case T.UnitIn:
      return null
    case T.Maybe:
      return null
  }
}

export function asCkey(type: TypeR): CoercionKey {
  const key = tryAsCkey(type)
  if (key == null) {
    issue(`Cannot define coercions on '${printTypeR(type)}'.`, type.span)
  }
  return key
}
