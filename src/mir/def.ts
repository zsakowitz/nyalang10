import type { WithSpan } from "../parse"
import { T } from "../shared/enum"
import { type Id as IdRaw } from "../shared/id"

type Id = WithSpan<IdRaw>

export function kv<const K, V>(k: K, v: V) {
  return { k, v }
}

export type TypedArg = WithSpan<{ name: Id; type: Type }>

export type Path = WithSpan<[Id, ...Id[]]>

export type ConstInt = WithSpan<
  { k: T.Path; v: Path } | { k: T.Int; v: bigint }
>

export type ConstIntR = WithSpan<
  { k: T.Param; v: Id } | { k: T.Int; v: bigint }
>

export type TParam<T = Type> = WithSpan<
  { name: Id; kind: T.Type; type: null } | { name: Id; kind: T.Const; type: T }
>

export type TArg = WithSpan<
  | { k: T.Infer; v: null }
  | { k: T.TypeOrConst; v: Path }
  | { k: T.Type; v: Type }
  | { k: T.Const; v: ConstInt }
>

export type TArgR = WithSpan<
  { k: T.Type; v: TypeR } | { k: T.Const; v: ConstIntR }
>

// INVARIANT: two `AdtDefn`s with the same `id` are the same
// intentionally has no span; this is the final form of an Adt
interface AdtDefn {
  id: Id
  kind: T.Struct | T.Union
  params: TParam<TypeR>[]
  fields: TypedArg[]
}

// type before aliases are resolved
export type Type = WithSpan<
  | { k: T.Void; v: null }
  | { k: T.Never; v: null }
  | { k: T.Int; v: null }
  | { k: T.Bool; v: null }
  | { k: T.Array; v: { el: Type; len: ConstInt } }
  | { k: T.Tuple; v: Type[] }
  | { k: T.Extern; v: Id } // mostly not nameable in textual language, only creatable by builtins
  | { k: T.UnitIn; v: Type } // the type `in T` has a single value for any type `T`; it is used to define type-associated functions
  | { k: T.Maybe; v: Type } // spelled `?T`, acts like Rust `Option<T>` or Zig `?T`; isomorphic to `union(void, T)`
  | { k: T.Path; v: { path: Path; args: TArg[] } } // needs to be checked for "is it actually a type parameter or adt"
>

export function ty<K extends Type["data"]["k"]>(
  k: K,
  v: Extract<Type["data"], { k: K }>["v"],
): Extract<Type["data"], { k: K }> {
  return { k, v } as any
}

// type after resolution
export type TypeR = WithSpan<
  | { k: T.Void; v: null }
  | { k: T.Never; v: null }
  | { k: T.Int; v: null }
  | { k: T.Bool; v: null }
  | { k: T.Array; v: { el: TypeR; len: ConstIntR } }
  | { k: T.Tuple; v: TypeR[] }
  | { k: T.Extern; v: Id }
  | { k: T.UnitIn; v: TypeR }
  | { k: T.Maybe; v: TypeR }
  | { k: T.Param; v: Id } // refers to a type parameter
  | { k: T.Adt; v: { def: AdtDefn; args: TArgR[] } } // refers to some struct or enum defined outside of the current context
>

export function tyr<K extends TypeR["data"]["k"]>(
  k: K,
  v: Extract<TypeR["data"], { k: K }>["v"],
): Extract<TypeR["data"], { k: K }> {
  return { k, v } as any
}

export const void_ = tyr(T.Void, null)
export const never = tyr(T.Never, null)
export const int = tyr(T.Int, null)
export const bool = tyr(T.Bool, null)
// export const num = tyr(T.Extern, idFor("num"))

export type Expr = WithSpan<
  // constructors (LIR)
  | { k: T.Unreachable; v: null }
  | { k: T.Int; v: bigint }
  | { k: T.Bool; v: boolean }
  | { k: T.Opaque; v: { ty: Type; data: unknown } } // not directly writable in text format
  | { k: T.ArrayFill; v: { el: Expr; len: ConstInt } }
  | { k: T.ArrayFrom; v: { idx: Id; el: Expr; len: ConstInt } }
  | { k: T.ArrayElements; v: Expr[] }
  | { k: T.Tuple; v: Expr[] }

  // constructors (MIR-exclusive)
  | { k: T.UnitIn; v: Type }
  | { k: T.Adt; v: { name: Path; targs: TArg[] | null; fields: FieldArg[] } }

  // destructors; `T.CastNever` and `T.UnionVariant` are not applicable here
  | { k: T.IfElse; v: { cond: Expr; if: Expr; else: Expr | null } }
  | { k: T.ArrayIndex; v: { target: Expr; index: Expr } }
  | { k: T.TupleIndex; v: { target: Expr; index: number } }
  | { k: T.FieldIndex; v: { target: Expr; field: Id } } // covers struct and union indexing
  | { k: T.UnionMatch; v: { target: Expr; arms: MatchArm[] } }

  // control flow
  | { k: T.Block; v: Stmt[] }
  | {
      k: T.Label
      v: { loop: WithSpan<null> | null; label: Id | null; body: Expr }
    }
  | { k: T.Return; v: { with: Expr | null } }
  | { k: T.Break; v: { label: Id | null; with: Expr | null } }
  | { k: T.Continue; v: { label: Id | null } }

  // variables
  | { k: T.Path; v: { name: Path; targs: TArg[] | null; args: Expr[] | null } }
>

export function ex<K extends Expr["data"]["k"]>(
  k: K,
  v: Extract<Expr["data"], { k: K }>["v"],
) {
  return { k, v } as Expr["data"]
}

export type MatchArm = WithSpan<{ field: Id; data: Id | null; body: Expr }>

export type Stmt = WithSpan<
  | { k: T.Expr; v: Expr }
  | { k: T.Let; v: { mut: boolean; name: Id; init: Expr } }
  | { k: T.AssignOne; v: { target: Lval; value: Expr } }
  | { k: T.AssignMany; v: { target: Lval[]; value: Expr } }
>

export function st<K extends Stmt["data"]["k"]>(
  k: K,
  v: Extract<Stmt["data"], { k: K }>["v"],
) {
  return { k, v } as Stmt["data"]
}

export type Lval = WithSpan<
  | { k: T.ArrayIndex; v: { target: Lval; field: Expr } }
  | { k: T.TupleIndex; v: { target: Lval; field: number } }
  | { k: T.FieldIndex; v: { target: Lval; field: Id } }
  | { k: T.Local; v: Id }
>

export function lv<K extends Lval["data"]["k"]>(
  k: K,
  v: Extract<Lval["data"], { k: K }>["v"],
) {
  return { k, v } as Lval["data"]
}

export type DeclFn = WithSpan<{
  name: Id
  params: TParam[]
  args: { name: Id; type: Type }[]
  ret: Type
  where: FnSignature[]
  body: Expr
}>

export type FnSignature<T = Type> = WithSpan<{
  name: Id
  args: T[]
  ret: T
}>

export type DeclAdt = WithSpan<{
  name: Id
  params: TParam[]
  kind: T.Struct | T.Union
  fields: { name: Id; type: Type }[]
}>

export type FieldArg = WithSpan<{
  name: Id
  value: Expr
}>
