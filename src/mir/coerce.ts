import * as lir from "@/lir/def"
import type { Span } from "@/parse/span"
import { asCkey, tryAsCkey, type CoercionKey } from "./coerce-key"
import type { TypeR } from "./def"
import type { Env } from "./env"
import { assert, issue } from "./error"

export interface Coercion {
  span: Span
  from: TypeR
  into: TypeR
  exec(env: Env, value: lir.Expr): lir.Expr
  auto: boolean
}

function compose(span: Span, ab: Coercion, bc: Coercion): Coercion {
  const B1 = asCkey(ab.into)
  const B2 = asCkey(bc.from)
  assert(B1 == B2, span)

  return {
    span,
    from: ab.from,
    into: bc.into,
    exec(env, value) {
      return bc.exec(env, ab.exec(env, value))
    },
    auto: true,
  }
}

export class Coercions {
  private byFrom: Record<CoercionKey, Coercion[]> = Object.create(null)
  private byInto: Record<CoercionKey, Coercion[]> = Object.create(null)
  private both: Record<CoercionKey, Record<CoercionKey, Coercion>> =
    Object.create(null)

  push(bc: Coercion) {
    // let X->Y mean "there exists a coercion from X to Y"
    // then the types under coercion are a category, assuming users implement coercions reasonably
    // in particular, we need to maintain transitivity, which we do by autogenerating coercions

    const span = bc.span
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

  has(from: TypeR, into: TypeR): boolean {
    const ka = tryAsCkey(from)
    const kb = tryAsCkey(into)
    if (ka != null) return false
    if (kb != null) return false
    if (ka == kb) return true
    return this.both[ka] != null && kb in this.both[ka]
  }

  // assumes that `.has()` has previously checked that a coercion exists
  unsafeExec(env: Env, from: TypeR, into: TypeR, value: lir.Expr): lir.Expr {
    return this.both[asCkey(from)]![asCkey(into)!]!.exec(env, value)
  }
}
