import { VSPAN, type Span } from "@/parse/span"
import { T } from "../shared/enum"
import { idFor, type Id } from "../shared/id"

export type Type =
  | { k: T.Void; v: null; s: Span }
  | { k: T.Never; v: null; s: Span }
  | { k: T.Int; v: null; s: Span }
  | { k: T.Bool; v: null; s: Span }
  | { k: T.Extern; v: Id; s: Span }
  | { k: T.Array; v: { el: Type; len: number }; s: Span }
  | { k: T.DynArray; v: Type; s: Span }
  | { k: T.Tuple; v: Type[]; s: Span }
  | { k: T.Union; v: Type[]; s: Span }
  | { k: T.Named; v: Id; s: Span }

export function ty<K extends Type["k"]>(
  k: K,
  v: Extract<Type, { k: K }>["v"],
  s: Span,
): Extract<Type, { k: K }> {
  return { k, v, s } as any
}

export const void_ = ty(T.Void, null, VSPAN)
export const never = ty(T.Never, null, VSPAN)
export const bool = ty(T.Bool, null, VSPAN)
export const int = ty(T.Int, null, VSPAN)
export const num = ty(T.Extern, idFor("num"), VSPAN)
export const str = ty(T.Extern, idFor("str"), VSPAN)

// the target of an assignment
export type Lval =
  | { k: T.ArrayIndex; v: { target: Lval; index: Expr }; s: Span }
  | { k: T.DynArrayIndex; v: { target: Lval; index: Expr }; s: Span }
  | { k: T.TupleIndex; v: { target: Lval; index: number }; s: Span }
  | { k: T.Local; v: Id; s: Span }

export function lv<K extends Lval["k"]>(
  k: K,
  v: Extract<Lval, { k: K }>["v"],
  s: Span,
): Lval {
  return { k, v, s } as any
}

null! as Lval satisfies Expr

// an expression with a return value. expressions cannot modify data except through nested statements via T.Block
export type Expr =
  // constructors; T.Void is constructed via `T.Block`
  | { k: T.Unreachable; v: null; s: Span } // reaching this statement is immediate UB; used for optimization
  | { k: T.Int; v: bigint; s: Span } // returns an `int` with the specified value
  | { k: T.Bool; v: boolean; s: Span } // returns a `bool` with the specified value
  | { k: T.Opaque; v: { ty: Type; data: unknown }; s: Span } // constructs a value of type `ty` by some mechanism specific to the compiler or interpreter used
  | { k: T.ArrayFill; v: { el: Expr; len: number }; s: Span } // evaluates `el`, then constructs a `[typeof el; len]` with the given length, where every element is `el`
  | { k: T.ArrayFrom; v: { idx: Id; el: Expr; len: number }; s: Span } // constructs an array of length `len` by evaluating `v.el` with `index` bound to 0, 1, 2, ..., `len-1`
  | { k: T.ArrayElements; v: { elTy: Type; els: Expr[] }; s: Span } // constructs an array by evaluating each element in `.els` in order; each element must have type `.elTy`
  | { k: T.DynArrayOf; v: Expr; s: Span } // converts a fixed-size array to a dyn-sized array
  | { k: T.DynArrayFill; v: { el: Expr; len: Expr }; s: Span } // same as for fixed-length arrays, but constructs a dynamic-length array
  | { k: T.DynArrayFrom; v: { idx: Id; el: Expr; len: Expr }; s: Span } // same as for fixed-length arrays, but constructs a dynamic-length array
  | { k: T.DynArrayElements; v: { elTy: Type; els: Expr[] }; s: Span } // same as for fixed-length arrays, but constructs a dynamic-length array
  | { k: T.Tuple; v: Expr[]; s: Span } // constructs a tuple which is each element of `v` evaluated, in order, then assembled into a tuple
  | { k: T.Union; v: { unionTy: Type; variant: number; data: Expr }; s: Span } // `.unionTy` must be a union type, `variant` must be in the range [0,unionTy.v.length), and `data` must be of type `unionTy.v[variant]`; constructs a union given a variant index and its appropriate data

  // destructors
  | { k: T.CastNever; v: { target: Expr; into: Type }; s: Span } // `target` must be of type `!`; returns an element of type `into` by relying on the unreachability of this statement
  | {
      k: T.IfElse
      v: { condition: Expr; type: Type; if: Expr; else: Expr }
      s: Span
    } // `condition` must be a `bool`; returns `if` if `condition` evaluates `true`, and `false` otherwise. only one branch is ever evaluated. each branch must return `type`.
  | { k: T.ArrayIndex; v: { target: Expr; index: Expr }; s: Span } // gets the `index`th element of `array`. it is instant UB for `index` to be out of bounds; this transitively means any access on an array of length zero is instant UB.
  | { k: T.DynArrayIndex; v: { target: Expr; index: Expr }; s: Span } // same as for fixed-length arrays, but on a dynamic-length array
  | { k: T.TupleIndex; v: { target: Expr; index: number }; s: Span } // index into a constant position in a tuple
  | { k: T.DynArrayLen; v: Expr; s: Span } // get the length of a `dyn [T]`
  | { k: T.UnionVariant; v: Expr; s: Span } // `v` must be a union; returns the variant index of `v` as an `int`
  | { k: T.UnionIndex; v: { target: Expr; index: number }; s: Span } // `target` must be a union. if the active variant is not `index`, instant UB follows. returns the data stored in the union in variant `index`.
  | {
      k: T.UnionMatch
      v: { target: Expr; type: Type; data: Id; arms: Expr[] }
      s: Span
    } // there must be as many `arms` as variants in the type of `target`, and `target` must be a union. finds the arm with index of the currently active variant, binds the union's data to `data`, and returns the matched arm. each clause must return `type`.

  // control flow
  | { k: T.Block; v: Stmt[]; s: Span } // evaluates each statement in `v`, returning the last one's value. if no statements are present, returns `void`
  | {
      k: T.Label
      v: { loop: boolean; label: Id; type: Type; body: Expr }
      s: Span
    } // if `loop`, evaluates `body` forever. otherwise, evaluates and returns `body`. `label` may be the target of `break` statements in `expr`. if `loop`, `continue` statements may also target `label`. `break` statements must return `type`, and if `!loop`, the returned `body` must also return `type`.
  | { k: T.Return; v: Expr; s: Span } // evaluates and returns `v` from the currently executing function or example.
  | { k: T.Break; v: { label: Id; body: Expr }; s: Span } // breaks from the given label construct with `body`
  | { k: T.Continue; v: Id; s: Span } // jumps to the beginning of the nearest loop labeled `v`; must match a loop within the current function

  // variables
  | { k: T.Local; v: Id; s: Span } // gets the value of `v`, which must be accessible in the current context
  | { k: T.Call; v: { name: Id; args: Expr[] }; s: Span } // evaluates `args`, then passes those arguments to the function `name`

  // named type
  | { k: T.Wrap; v: { target: Expr; with: Id }; s: Span } // converts a `typeof target` into a `$with` by wrapping it
  | { k: T.Unwrap; v: Expr; s: Span } // unwraps a named type into its constitutient elements

export function ex<K extends Expr["k"]>(
  k: K,
  v: Extract<Expr, { k: K }>["v"],
  s: Span,
): Expr {
  return { k, v, s } as any
}

// an executable statement. statements can create scopes, so they must always be contained in a T.Block, to make it clear where their scopes start and end
export type Stmt =
  | { k: T.Expr; v: Expr; s: Span } // evaluates `v`, returning its value
  | { k: T.Let; v: { name: Id; mut: boolean; val: Expr }; s: Span } // evaluates `val`, then creates a new scope for the rest of the block with the result bound as `name`. returns the value of type `void`. only `mut` bindings can be mutated
  | { k: T.AssignOne; v: { target: Lval; value: Expr }; s: Span } // evaluates `value`, then stores it in `target`. in particular, `target`'s array indices are evaluated AFTER `value`.
  | { k: T.AssignMany; v: { target: Lval[]; value: Expr }; s: Span } // evaluates `value`, which must be a tuple of the same length as `targets`, and assigns each member of the result to the corresponding lvalue in `targets`

export function st<K extends Stmt["k"]>(
  k: K,
  v: Extract<Stmt, { k: K }>["v"],
  s: Span,
): Stmt {
  return { k, v, s } as any
}

// a function declaration, the only kind of declaration in this lir
export interface Decl {
  name: Id
  args: { name: Id; type: Type }[]
  ret: Type
  body: Expr
  s: Span
}

// a named type declaration, like `named &MyInt = int`. used to enable recursive
// types, such as `named &Tree = union(int, &Tree)`, which can then be handled
// without using extern types.
//
// not all named types are necessarily recursive; anything which compiles to a
// language without recursion (such as glsl) must not ban named types outright,
// and should instead do proper checks to avoid recursion.
export interface DeclNamed {
  name: Id
  body: Type
  s: Span
}
