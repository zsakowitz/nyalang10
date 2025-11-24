# executors: normative required

an “executor” is a compiler or interpreter which can somehow execute a LIR AST,
given the set of opaque constructors and functions in the environment.

all executors must provide a mode in which Undefined Behavior (henceforth called
HB) immediately terminates the program; see "undefined behavior" below. this is
known as the UB-checking mode.

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

# operators, externs, and opaques

the LIR is not concerned with operations such as addition or negation; those are
specified just like any other function by the executor, to avoid bloating the
LIR representation.

similarly, the LIR is not concerned with types like floats, symbolic
expressions, and file descriptors. these are instead called “extern types”, and
are defined by the executor, not the LIR.

extern types are treated just as strictly as other types in the typesystem, but
they have no built-in constructors or destructors. instead, an executor may
provide functions such as `@float(int) ~float` and `@fneg(~float) ~float` to
create and use extern types.

not all extern types have an immediately obvious representation in LIR types.
for this reason, the `T.Opaque` expression may be used to construct extern types
given arbitrary, executor-specific data.

the type checker is unable to validate `T.Opaque` expressions, since by their
nature, they are defined for a specific executor. instead, it assumes all
`T.Opaque` expressions succeed in returning a value of their target type (or
diverge), and ignored the actual data stored in the `T.Opaque`.

all executors in this repository support these methods of instantiation:

- instantiating any data type, given an object with a `evalXYZ(...): Value`
  method, where `XYZ`, the argument types, and `Value` are specific to the
  interpreter in question, so that a higher-level language can pipe a value
  directly through any given LIR implementation
- instantiating a `T.Extern` from a string, assuming the appropriate
  instantiator is provided via some `opaqueExterns` property on the
  executor-specific `Env` type

# available LIR executors

all LIR executors in this repository are single-file, and have an `Env` type
which defines functions, opaques, labels, and locals accessible in the current
context. it can be constructed by the `env()` method exported from a given
executor file.

- `exec-typeck`, the type checker. even though this does not actually execute
  code, it simulates the result of code execution, and therefore is considered
  an executor. since it does not run code, it does not bother to deal with UB.

- `exec-interp`, the interpreter. it runs expression-by-expression, and is
  always UB-checking.

in the future, we expect to have LIR compilers which target JavaScript and GLSL.
however, those will not be started until the MIR and some intermediate forms are
done.
