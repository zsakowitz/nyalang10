## idea for simplification

instead of having strict typing and generics and stuff, make typing much more
relaxed, and do type checking much later. for instance, the following function
definition now compiles:

```rs
fn double(x: num | complex) -> num | complex {
  x + x
}
```

how does it work? when called, this particular overload of `double` only accepts
inputs of type `num` or `complex`; anything else is rejected, and another
overload tries to accept it. then, the body of the function is instantiated, and
the expression is checked for a proper return type, sort of like if everything
were `anytype` in Zig. so `double(x): num` if `x: num`, but `double(x): complex`
otherwise.

to switch, we can use the `is` operator mid-function.

```rs
fn two_if_num_else_zero(x: num | complex) -> int {
  if (x is num) 2 else 0
}
```

there is now an `any` type, to which anything can be assigned. it replaces type
generics entirely. unspecified function parameters have `any` type, and
unspecified function returns have `any` type.

```rs
fn preserve(x) {
  x
}

preserve(2) // 2 :: int
preserve(23) // 23 :: void
```

however, to make sure we can output this to another language without
combinatorial explosion, things like `if` statements still need to have matching
types for all outputs.

```rs
if (true) 2 else "34" //~ ERROR: mismatched types in 'if-else' expression
```

there are now two array types: `[T; N]` and `[T]`. `[T; N]` is the normal array
type (`N` elements of type `T`), while `[T]` is an array of any length
containing elements of type `T`.

```rs
fn sum_both(a: [int], b: [int]) -> int {
  let mut sum = 0
  for a in a { sum += a }
  for b in b { sum += b }
  sum
}
```

we will still do as many checks on functions ahead-of-time as possible. at a
minimum, we will ensure that referenced variables exist.

geometry things still work, very easily:

```rs
struct Point { x: num, y: num }
struct Line(Point, Point)

fn y_intercept(line: Line) -> Point {
  let slope = (line.0.y - line.1.y) / (line.0.x - line.1.x);
  let y = -slope * line.0.x + line.0.y;
  Point { x: 0, y }
}
```

we probably want things like the fibonacci numbers to work.

```rs
fn fib(n: int) int {
  if (n <= 1) n else fib(n - 1) + fib(n - 2)
}
```

the `len()` function to get the length of an array returns a constant if
possible. this is needed for glsl and static typing purposes.

```rs
fn double(x: [int]) [int] {
  [i => x[i]; len(x)]
}

__bikeshed_shader {
  double([2, 3, 4]) // should return `[int; 3]`
}
```

if fibonacci numbers work, we should also introduce dynamic-length arrays, so
that surreal numbers also work.

```rs
struct Surreal { lhs: dyn [Surreal], rhs: dyn [Surreal] }
```
