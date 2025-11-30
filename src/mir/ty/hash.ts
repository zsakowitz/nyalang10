import { nextUid } from "@/shared/id"
import { type TFinal } from "../def"
import { R } from "../enum"

export type Hash = number & { readonly __hash: unique symbol }

export function nextHash() {
  return nextUid() as Hash
}

const R_VOID = nextHash()
const R_INT = nextHash()
const R_BOOL = nextHash()
const R_NEVER = nextHash()
const R_EXTERN: Record<number /* id */, Hash> = Object.create(null)
const R_ARRAYFIXED: Record<
  Hash /* el */,
  Record<number /* len */, Hash>
> = Object.create(null)
const R_ARRAYDYN: Record<Hash /* el */, Hash> = Object.create(null)
const R_UNIT_IN: Record<Hash /* el */, Hash> = Object.create(null)

const R_EMPTY = nextHash()
const R_COMBO: Record<Hash, Record<Hash, Hash>> = Object.create(null)

export function hash({ k, v }: TFinal): Hash {
  switch (k) {
    case R.Void:
      return R_VOID
    case R.Int:
      return R_INT
    case R.Bool:
      return R_BOOL
    case R.Struct:
      return v.name.data.index as Hash
    case R.Extern:
      return (R_EXTERN[v.data.index] ??= nextHash())
    case R.Never:
      return R_NEVER
    case R.ArrayFixed:
      return ((R_ARRAYFIXED[hash(v.el)] ??= Object.create(null))[v.len] ??=
        nextHash())
    case R.ArrayDyn:
      return (R_ARRAYDYN[hash(v)] ??= nextHash())
    case R.UnitIn:
      return (R_UNIT_IN[hash(v)] ??= nextHash())
    case R.FnKnown:
      return v.hash
  }
}

export function hashList(tys: TFinal[]): Hash {
  if (tys.length == 0) {
    return R_EMPTY
  }
  return tys
    .map(hash)
    .reduce((a, b) => ((R_COMBO[a] ??= Object.create(null))[b] ??= nextHash()))
}
