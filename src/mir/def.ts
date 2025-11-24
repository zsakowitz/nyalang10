import type { WithSpan } from "../parse"
import type { T } from "../shared/enum"
import type { Id as IdRaw } from "../shared/id"

type Id = WithSpan<IdRaw>

export type TypedArg = WithSpan<{ name: Id; type: Type }>

export type Path = WithSpan<[Id, ...Id[]]>

export type ConstInt = WithSpan<{ k: T.Param; v: Id } | { k: T.Int; v: number }>

export type TParam<T = Type> = WithSpan<
  { name: Id; kind: T.Type; type: null } | { name: Id; kind: T.Const; type: T }
>

export type TArg<T = Type> = WithSpan<
  | { k: T.Infer; v: null }
  | { k: T.TypeOrConst; v: Path }
  | { k: T.Type; v: T }
  | { k: T.Const; v: ConstInt }
>

// INVARIANT: two `AdtDefn`s with the same `id` are the same
// intentionally has no span; this is the final form of an Adt
export interface AdtDefn {
  id: Id
  kind: T.Struct | T.Union
  params: TParam<TypeR>[]
  fields: TypedArg[]
}

// type before aliases are resolved
export type Type = WithSpan<
  // all below are same as LIR unless otherwise noted
  | { k: T.Void; v: null }
  | { k: T.Never; v: null }
  | { k: T.Int; v: null }
  | { k: T.Bool; v: null }
  | { k: T.Array; v: { el: Type; len: ConstInt } }
  | { k: T.Tuple; v: Type[] }
  | { k: T.Extern; v: Id }
  // all below are unique to MIR, and are lowered to alternative LIR forms
  | { k: T.Alias; v: Path }
  | { k: T.UnitIn; v: Type } // the type `in T` has a single value for any type `T`; it is used to define type-associated functions
  | { k: T.Param; v: Id } // refers to a type parameter
  | { k: T.Adt; v: { def: AdtDefn; args: TArg<Type>[] } } // refers to some struct or enum defined outside of the current context
>

// type after aliases are resolved
export type TypeR = WithSpan<
  | { k: T.Void; v: null }
  | { k: T.Never; v: null }
  | { k: T.Int; v: null }
  | { k: T.Bool; v: null }
  | { k: T.Array; v: { el: TypeR; len: ConstInt } }
  | { k: T.Tuple; v: TypeR[] }
  | { k: T.Extern; v: Id }
  | { k: T.UnitIn; v: TypeR } // the type `in T` has a single value for any type `T`; it is used to define type-associated functions
  | { k: T.Param; v: Id } // refers to a type parameter
  | { k: T.Adt; v: { def: AdtDefn; args: TArg<TypeR>[] } } // refers to some struct or enum defined outside of the current context
>

export type Expr = WithSpan<
  // constructors (LIR)
  | { k: T.Unreachable; v: null }
  | { k: T.Int; v: bigint }
  | { k: T.Bool; v: boolean }
  | { k: T.Opaque; v: { ty: Type; data: unknown } }
  | { k: T.ArrayFill; v: { el: Expr; len: ConstInt } }
  | { k: T.ArrayFrom; v: { idx: Id; el: Expr; len: ConstInt } }
  | { k: T.ArrayElements; v: Expr[] }
  | { k: T.Tuple; v: Expr[] }
  // constructors (MIR-exclusive)
  | { k: T.UnitIn; v: Type }
  | {
      // same syntax for structs and unions; users can create wrapper functions if they want
      k: T.Adt
      v: {
        name: Path
        targs: TArg[] | null
        fields: { name: Id; value: Expr }[]
      }
    }

  // destructors
  // never is implicitly promoted, so no need for `T.CastNever`
  | { k: T.IfElse; v: { cond: Expr; if: Expr; else: Expr | null } }
  | { k: T.ArrayIndex; v: { target: Expr; index: Expr } }
  | { k: T.TupleIndex; v: { target: Expr; index: number } }
  | { k: T.FieldIndex; v: { target: Expr; field: Id } } // covers struct and union indexing
  | { k: T.UnionVariant; v: { target: Expr } }
  | {
      k: T.Match
      v: {
        target: Expr
        arms: WithSpan<{ field: Id; dataBinder: Id | null; body: Expr }>[]
      }
    } // in the future, will be expanded to more general pattern matching

  // control flow
  | { k: T.Block; v: Stmt[] }
  | {
      k: T.Label
      v: {
        loop: WithSpan<null> | null // either the 'loop' keyword or nothing
        label: Id | null
        body: Expr
      }
    }
  | { k: T.Return; v: { with: Expr | null } }
  | { k: T.Break; v: { label: Id | null; with: Expr | null } }
  | { k: T.Continue; v: { label: Id | null } }

  // variables
  | { k: T.Local; v: Id }
  | { k: T.Call; v: { name: Path; targs: TArg[] | null; args: Expr[] } }

  // MIR-specific constructs
  | { k: T.Range; v: { start: Expr | null; end: Expr | null } } // for now, ranges are restricted to 0..n
  | { k: T.Closure; v: { args: { k: Id; v: Type | null }[]; body: Expr } }
  | { k: T.Builtin; v: { name: Id; args: Expr[] } }
  | { k: T.ForIn; v: { label: Id | null; item: Id; source: Expr; body: Expr } }
  | { k: T.Xml; v: Xml }
>

export interface Xml {
  tag: WithSpan<Id>
  props: XmlProp[]
  contents: WithSpan<Expr[]> | null
}

type Str = WithSpan<string>

export type XmlProp = WithSpan<
  | { k: T.XmlId; v: Str }
  | { k: T.XmlClass; v: Str }
  | { k: T.XmlAttrs; v: { k: Str; v: Expr }[] }
>

export type Stmt = WithSpan<
  | { k: T.Expr; v: Expr }
  | { k: T.Let; v: { mut: boolean; name: Id; init: Expr } }
  | { k: T.AssignOne; v: { target: Lval; value: Expr } }
  | { k: T.AssignMany; v: { target: Lval[]; value: Expr } }
>

export type Lval = WithSpan<
  | { k: T.ArrayIndex; v: { target: Lval; field: Expr } }
  | { k: T.TupleIndex; v: { target: Lval; field: number } }
  | { k: T.FieldIndex; v: { target: Lval; field: Id } }
  | { k: T.Local; v: Id }
>

export type DeclFn = WithSpan<{
  name: Id
  params: TParam[]
  args: { name: Id; type: Type }[]
  ret: Type
  where: FnSignature[]
  body: Expr
}>

export type FnSignature = WithSpan<{
  name: Id
  args: Type[]
  ret: Type
}>

export type DeclAdt = WithSpan<{
  name: Id
  params: TParam[]
  kind: T.Struct | T.Union
  fields: { name: Id; type: Type }[]
}>
