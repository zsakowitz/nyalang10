import { type OpaqueData } from "../lir/def"
import type { T } from "../shared/enum"
import type { Id } from "../shared/id"

export interface Path {
  v: [Id, ...Id[]]
}

export type ConstInt = { k: T.Param; v: Id } | { k: T.Int; v: number }

export type TParam<T = Type> = { k: T.Type; v: null } | { k: T.Const; v: T }

export type TArg<T = Type> =
  | { k: T.Infer; v: null }
  | { k: T.TypeOrConst; v: Path }
  | { k: T.Type; v: T }
  | { k: T.Const; v: ConstInt }

// INVARIANT: two `AdtDefn`s with the same `id` are the same
export interface AdtDefn<T = TypeR> {
  id: Id
  kind: T.Struct | T.Union
  params: { name: Id; kind: TParam<T> }[]
  fields: { name: Id; type: T }[]
}

// type before aliases are resolved
export type Type =
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

// type after aliases are resolved
export type TypeR =
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

// being an object means this can have position information
export type Lit<T> = { v: T }

export type Expr =
  // constructors (LIR)
  | { k: T.Unreachable; v: null }
  | { k: T.Int; v: bigint }
  | { k: T.Bool; v: boolean }
  | { k: T.Opaque; v: { ty: Type; data: OpaqueData } }
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
        arms: { field: Id; dataBinder: Id | null; body: Expr }[]
      }
    } // in the future, will be expanded to more general pattern matching

  // control flow
  | { k: T.Block; v: Stmt[] }
  | { k: T.Label; v: { loop: Lit<boolean>; label: Id | null; body: Expr } }
  | { k: T.Return; v: { with: Expr | null } }
  | { k: T.Break; v: { label: Id | null; with: Expr | null } }
  | { k: T.Continue; v: { label: Id | null } }

  // variables
  | { k: T.Local; v: Id }
  | { k: T.Call; v: { name: Path; targs: TArg[] | null; args: Expr[] } }

  // MIR-specific constructs
  | { k: T.Range; v: { lo: Expr; hi: Expr } } // for now, ranges are restricted to 0..n
  | { k: T.Closure; v: { args: { k: Id; v: Type | null }[]; body: Expr } }
  | { k: T.Builtin; v: { name: Id; args: Expr[] } }
  | { k: T.ForIn; v: { label: Id | null; item: Id; source: Expr; body: Expr } }
  | { k: T.Xml; v: Xml }

export interface Xml {
  tag: Lit<string>
  props: XmlProp[]
  contents: Expr[] | null
}

export type XmlProp =
  | { k: T.XmlId; v: Lit<string> }
  | { k: T.XmlClass; v: Lit<string> }
  | { k: T.XmlAttrs; v: { k: Lit<string>; v: Expr }[] }

export type Stmt =
  | { k: T.Expr; v: Expr }
  | { k: T.Let; v: { mut: boolean; name: Id; init: Expr } }
  | { k: T.AssignOne; v: { target: Lval; value: Expr } }
  | { k: T.AssignMany; v: { target: Lval[]; value: Expr } }

export type Lval =
  | { k: T.ArrayIndex; v: { target: Lval; field: Expr } }
  | { k: T.TupleIndex; v: { target: Lval; field: number } }
  | { k: T.FieldIndex; v: { target: Lval; field: Id } }
  | { k: T.Local; v: Id }

export interface DeclFn {
  name: Id
  params: TParam[]
  args: { name: Id; type: Type }[]
  ret: Type
  where: FnSignature[]
  body: Expr
}

export interface FnSignature {
  name: Id
  args: Type[]
  ret: Type
}

export interface DeclAdt {
  name: Id
  params: TParam[]
  kind: T.Struct | T.Union
  fields: { name: Id; type: Type }[]
}
