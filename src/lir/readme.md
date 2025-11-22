it is illegal for an executor to return a value from `T.Extern { ty, data }`
which is not of type `ty`. this is not considered UB, since it is the executor
writer's fault, not the person writing lir script.

# undefined behavior

if a value of type `T.Never` or a `T.Union` with no variants is ever
constructed, it is immediate checked UB. transitively, evaluating a function
call where one of the arguments is a `T.Never` is immediate checked UB.

if these expressions are evaluated, it is immediate checked UB:

- `T.Unreachable`
- `T.CastNever { target, type }` after evaluating `target` (i.e. reaching
  `cast_never` is okay so long as evaluating `target` diverges)
- `T.ArrayIndex { target, index }` with an out-of-bounds `index`
- `T.UnionIndex { target, index }` where `index` is not the active union variant

an executor may either check UB, or drop UB. if checked, every one of the above
conditions must throw some kind of runtime error and halt the program. if
dropped, the above conditions are assumed not to happen, which may be used for
optimization purposes.

for instance, take this code:

```rs
fn @return_assuming($cond: bool, $value: int) -> int {
  if cond {
    $value
  } else {
    unreachable
  }
}
```

a JS compiler which checks UB might compile this to:

```js
function return_assuming(cond, value) {
  if (cond) {
    return value
  } else {
    throw new Error("Reached 'unreachable'.")
  }
}
```

while a JS compiler which drops UB might compile this to:

```js
function return_assuming(cond, value) {
  return value
}
```
