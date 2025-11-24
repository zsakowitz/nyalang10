# executors: normative required

an “executor” is a compiler or interpreter which can somehow execute a LIR AST,
given the set of opaque constructors and functions in the environment.

not all executors use the set of opaque constructors. for instance, the type
checker assumes that all `opaque ty` statements successfully return a value of
type `ty`. this specific case means all executors must verify correctness of
their opaque values themselves, which is considered fine.

all executors must provide a mode in which UB immediately terminates the
program. this is known as the UB-checking mode.

it is illegal for an executor to return a value from `T.Opaque { ty, data }`
which is not of type `ty`. this is not UB, since it is the executor's fault, not
the author of the LIR.

## normative optional

an executor may optionally provide a secondary mode where UB is assumed not to
happen. this is known as the UB-dropping mode.

if an executor provides a numeric type, it is recommended to name it `~num` with
`idFor("num")` for compatibility with the LIR text format; similarly, a string
type is recommended to be `~str`.

if an executor provides a function which immediately terminates the program, it
is recommended to call it `@panic`, where the specific `Id` is derived from
`idFor("panic")`. it should either take `void`, `~str`, or a platform-specific
type.

# undefined behavior

there is no unchecked UB in the LIR; everything which could error can be easily
validated.

it is UB to evaluate:

- `T.Unreachable`
- `T.CastNever { target, .. }` where `target` does not diverge
- `T.ArrayIndex { target, index }` with an out-of-bounds `index`
- `T.UnionIndex { target, index }` where `index` is not the active union variant

it is also UB to be able to construct a value of type `!` without diverging.
since this is hard to exhaustively check, executors are not required to check
it, although they may use this for optimizations (e.g. a function with a
parameter of type `(!, int)` will never be called). transitively, it is UB to:

- enter a function body where one of the parameters is of type `!`
- enter a function body where one of the parameters is of type `[(!, int); 2]`,
  since you can run `$target[1].0` to extract a `!` from it
- have a value of a union type with no variants, since you can `match` on it
  with no arms and obtain a value of type `!`

# unrecoverable errors

many functions probably have some precondition which the author must follow in
order for it to be a correct usage. to enforce this, either:

1. declare the invalid precondition as UB, and call `unreachable` if it's met;
   whether it is checked UB or not depends on the executor
2. use an executor which provides an `@panic` function which returns `!` and
   throws in some executor-specific manner
