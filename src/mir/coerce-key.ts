import { T } from "@/shared/enum"
import { nextUid } from "@/shared/id"
import type { TypeR } from "./def"
import { issue } from "./error"

export type CoercionKey = number & { readonly __coercion_key: unique symbol }

const CKEY_VOID = nextUid() as CoercionKey
const CKEY_NEVER = nextUid() as CoercionKey
const CKEY_INT = nextUid() as CoercionKey
const CKEY_BOOL = nextUid() as CoercionKey

const CKEY_EXTERN: Record<number, CoercionKey> = Object.create(null)
const CKEY_ADT: Record<number, CoercionKey> = Object.create(null)

export function asCkey(type: TypeR): CoercionKey {
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
        issue(
          `Structs and unions with type parameters cannot participate in coercion.`,
          type.span,
        )
      }
      return (CKEY_ADT[v.def.id.data.index] ??= nextUid() as CoercionKey)
    case T.Array:
      issue(`Arrays cannot participate in coercion.`, type.span)
    case T.Tuple:
      issue(`Tuples cannot participate in coercion.`, type.span)
    case T.Param:
      issue(
        `Unresolved type parameters cannot participate in coercion.`,
        type.span,
      )
    case T.UnitIn:
      issue(`Contextual unit types cannot participate in coercion.`, type.span)
  }
}
