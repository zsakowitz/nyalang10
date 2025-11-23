import { T } from "../shared/enum"
import { idFor, type Id } from "../shared/id"

export type Type =
  | { k: T.Void; v: null }
  | { k: T.Never; v: null }
  | { k: T.Int; v: null }
  | { k: T.Bool; v: null }
  | { k: T.Extern; v: Id }
  | { k: T.Array; v: { el: Type; len: number } }
  | { k: T.Tuple; v: Type[] }
  | { k: T.Union; v: Type[] }

export function ty<K extends Type["k"]>(
  k: K,
  v: Extract<Type, { k: K }>["v"],
): Extract<Type, { k: K }> {
  return { k, v } as any
}

export const T_VOID = ty(T.Void, null)
export const T_NEVER = ty(T.Never, null)
export const T_BOOL = ty(T.Bool, null)
export const T_INT = ty(T.Int, null)
export const T_NUM = ty(T.Extern, idFor("num"))
export const T_STR = ty(T.Extern, idFor("str"))

// the target of an assignment
export type Lval =
  | { k: T.ArrayIndex; v: { target: Lval; index: Expr } }
  | { k: T.TupleIndex; v: { target: Lval; index: number } }
  | { k: T.Local; v: Id }

export function lv<K extends Lval["k"]>(
  k: K,
  v: Extract<Lval, { k: K }>["v"],
): Lval {
  return { k, v } as any
}

null! as Lval satisfies Expr

// an expression with a return value. expressions cannot modify data except through nested statements via T.Block
export type Expr =
  // constructors; T.Void is constructed via `T.Block`
  | { k: T.Unreachable; v: null } // reaching this statement is immediate UB; used for optimization
  | { k: T.Int; v: bigint } // returns an `int` with the specified value
  | { k: T.Bool; v: boolean } // returns a `bool` with the specified value
  | { k: T.Opaque; v: { ty: Type; data: unknown } } // constructs a value of type `ty` by some mechanism specific to the compiler or interpreter used
  | { k: T.ArrayFill; v: { el: Expr; len: number } } // evaluates `el`, then constructs a `[typeof el; len]` with the given length, where every element is `el`
  | { k: T.ArrayFrom; v: { idx: Id; el: Expr; len: number } } // constructs an array of length `len` by evaluating `v.el` with `index` bound to 0, 1, 2, ..., `len-1`
  | { k: T.ArrayElements; v: { elTy: Type; els: Expr[] } } // constructs an array by evaluating each element in `.els` in order; each element must have type `.elTy`
  | { k: T.Tuple; v: Expr[] } // constructs a tuple which is each element of `v` evaluated, in order, then assembled into a tuple
  | { k: T.Union; v: { unionTy: Type; variant: number; data: Expr } } // `.unionTy` must be a union type, `variant` must be in the range [0,unionTy.v.length), and `data` must be of type `unionTy.v[variant]`; constructs a union given a variant index and its appropriate data

  // destructors
  | { k: T.CastNever; v: { target: Expr; into: Type } } // `target` must be of type `!`; returns an element of type `into` by relying on the unreachability of this statement
  | { k: T.IfElse; v: { condition: Expr; type: Type; if: Expr; else: Expr } } // `condition` must be a `bool`; returns `if` if `condition` evaluates `true`, and `false` otherwise. only one branch is ever evaluated. each branch must return `type`.
  | { k: T.ArrayIndex; v: { target: Expr; index: Expr } } // gets the `index`th element of `array`. it is instant UB for `index` to be out of bounds; this transitively means any access on an array of length zero is instant UB.
  | { k: T.TupleIndex; v: { target: Expr; index: number } } // index into a constant position in a tuple
  | { k: T.UnionVariant; v: Expr } // `v` must be a union; returns the variant index of `v` as an `int`
  | { k: T.UnionIndex; v: { target: Expr; index: number } } // `target` must be a union. if the active variant is not `index`, instant UB follows. returns the data stored in the union in variant `index`.
  | { k: T.UnionMatch; v: { target: Expr; type: Type; data: Id; arms: Expr[] } } // there must be as many `arms` as variants in the type of `target`, and `target` must be a union. finds the arm with index of the currently active variant, binds the union's data to `data`, and returns the matched arm. each clause must return `type`.

  // control flow
  | { k: T.Block; v: Stmt[] } // evaluates each statement in `v`, returning the last one's value. if no statements are present, returns `void`
  | { k: T.Label; v: { loop: boolean; label: Id; type: Type; body: Expr } } // if `loop`, evaluates `body` forever. otherwise, evaluates and returns `body`. `label` may be the target of `break` statements in `expr`. if `loop`, `continue` statements may also target `label`. `break` statements must return `type`, and if `!loop`, the returned `body` must also return `type`.
  | { k: T.Return; v: Expr } // evaluates and returns `v` from the currently executing function or example.
  | { k: T.Break; v: { label: Id; body: Expr } } // breaks from the given label construct with `body`
  | { k: T.Continue; v: Id } // jumps to the beginning of the nearest loop labeled `v`; must match a loop within the current function

  // variables
  | { k: T.Local; v: Id } // gets the value of `v`, which must be accessible in the current context
  | { k: T.Call; v: { name: Id; args: Expr[] } } // evaluates `args`, then passes those arguments to the function `name`

export function ex<K extends Expr["k"]>(
  k: K,
  v: Extract<Expr, { k: K }>["v"],
): Expr {
  return { k, v } as any
}

// an executable statement. statements can create scopes, so they must always be contained in a T.Block, to make it clear where their scopes start and end
export type Stmt =
  | { k: T.Expr; v: Expr } // evaluates `v`, returning its value
  | { k: T.Let; v: { name: Id; mut: boolean; val: Expr } } // evaluates `val`, then creates a new scope for the rest of the block with the result bound as `name`. returns the value of type `void`. only `mut` bindings can be mutated
  | { k: T.AssignOne; v: { target: Lval; value: Expr } } // evaluates `value`, then stores it in `target`. in particular, `target`'s array indices are evaluated AFTER `value`.
  | { k: T.AssignMany; v: { target: Lval[]; value: Expr } } // evaluates `value`, which must be a tuple of the same length as `targets`, and assigns each member of the result to the corresponding lvalue in `targets`

export function st<K extends Stmt["k"]>(
  k: K,
  v: Extract<Stmt, { k: K }>["v"],
): Stmt {
  return { k, v } as any
}

// a function declaration, the only kind of declaration in this lir
export interface Decl {
  name: Id
  args: { name: Id; type: Type }[]
  ret: Type
  body: Expr
}
