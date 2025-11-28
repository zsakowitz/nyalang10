import type { Span } from "@/parse/span"
import { nextUid } from "@/shared/id"
import type { TPrim } from "./def"
import { R } from "./enum"
import { assert, issue } from "./error"
import { execTx, type Tx } from "./tx"

const CKEY_VOID = nextUid()
const CKEY_NEVER = nextUid()
const CKEY_BOOL = nextUid()
const CKEY_INT = nextUid()
const CKEY_EXTERN: Record<number, number> = Object.create(null)

function asCkey({ data: { k, v } }: TPrim): number {
  switch (k) {
    case R.Void:
      return CKEY_VOID
    case R.Never:
      return CKEY_NEVER
    case R.Int:
      return CKEY_INT
    case R.Bool:
      return CKEY_BOOL
    case R.Extern:
      return (CKEY_EXTERN[v.index] ??= nextUid())
  }
}

export interface Coercion {
  from: TPrim
  into: TPrim
  exec: Tx
  auto: boolean
}

function compose(span: Span, ab: Coercion, bc: Coercion): Coercion {
  const B1 = asCkey(ab.into)
  const B2 = asCkey(bc.from)
  assert(B1 == B2, span)

  return {
    from: ab.from,
    into: bc.into,
    auto: true,
    exec(env, value) {
      return execTx(env, bc.exec, execTx(env, ab.exec, value))
    },
  }
}

export class Coercions {
  private byFrom: Record<number, Coercion[]> = Object.create(null)
  private byInto: Record<number, Coercion[]> = Object.create(null)
  private both: Record<number, Record<number, Coercion>> = Object.create(null)

  push(span: Span, bc: Coercion) {
    // let X->Y mean "there exists a coercion from X to Y"
    // then the types under coercion are a category, assuming users implement coercions reasonably
    // in particular, we need to maintain transitivity, which we do by autogenerating coercions

    const B = asCkey(bc.from) // call this B
    const C = asCkey(bc.into) // call this C

    const ABs = (this.byInto[B] ?? []).slice()
    const CDs = (this.byFrom[C] ?? []).slice()

    // if A->B, then we must make A->C
    // if C->D, then we must make B->D
    // if A->B and C->D, then we must make A->D
    // we also must avoid cycles

    this.pushRaw(span, bc)
    for (const ab of ABs) {
      this.pushRaw(span, compose(span, ab, bc))
    }
    for (const cd of CDs) {
      this.pushRaw(span, compose(span, bc, cd))
    }
    for (const ab of ABs) {
      for (const cd of CDs) {
        this.pushRaw(span, compose(span, compose(span, ab, bc), cd))
      }
    }
  }

  private pushRaw(span: Span, coercion: Coercion) {
    const A = asCkey(coercion.from)
    const B = asCkey(coercion.into)
    if (A == B) {
      issue("Coercion cycle detected.", span)
    }

    const fromA = (this.byFrom[A] ??= [])
    const intoB = (this.byInto[B] ??= [])

    const fromApx = fromA.findIndex((ab) => asCkey(ab.into) == B)

    if (fromApx > 0) {
      // replace auto with manual
      if (fromA[fromApx]!.auto) {
        fromA[fromApx] = coercion
        intoB[intoB.findIndex((ab) => asCkey(ab.from) == A)] = coercion
      } else {
        issue("Cannot declare coercion twice.", span)
      }
    } else {
      ;(this.byFrom[A] ??= []).push(coercion)
      ;(this.byInto[B] ??= []).push(coercion)
    }

    ;(this.both[A] ??= Object.create(null))[B] = coercion
  }

  get(from: TPrim, into: TPrim): Tx | false {
    const ka = asCkey(from)
    const kb = asCkey(into)
    if (ka == kb) return true
    return this.both[ka]?.[kb]?.exec ?? false
  }
}
