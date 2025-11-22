# undefined behavior

it is illegal for a compiler or interpreter to return a value from
`T.Extern { ty, data }` which is not of type `ty`. this is not considered UB,
since it is the compiler writer's fault, not the person writing script in the
lir.

all sources of undefined behavior:

- `T.Unreachable` being evaluated
- `T.CastNever` being evaluated
- `T.ArrayIndex { target, index }` being evaluated with an out-of-bounds `index`
- `T.UnionIndex { target, index }` being evaluated with an `index` which is not
  the currently active union variant
