it has function overloading:

```rs
fn inc(x: int) int { x + 1 }
fn inc(x: complex) complex { x + complex(1, 0) }

inc(2) // returns 3
inc(complex(3, 7)) // returns complex(4, 7)
```

functions can be generic, but types are inferred once called:

```rs
fn inc_twice(x: any) any { inc(inc(x)) }

inc_twice(4) // returns 6
inc_twice(complex(3, 7)) // returns complex(5, 7)
```

this even extends to complex array expressions:

```rs
fn replace_with_two(x: [any]) [int] { [2; len(x)] }
// `len(x)` returns a constant integer; the array creation syntax leverages this to return a fixed-size array, even though the size is technically a normal expression

replace_with_two([19, 3, 4, 5]) // returns an `[int; 4]`
replace_with_two([7]) // returns an `[int; 1]`
```

the benefits are many:

- good as a desmos compiler, since desmos has the same idea (functions have
  `any` type, but do type checking when called)
- good for abstract algebra, since you can define `*` for ints, complexes,
  groups, etc.
- good for fractals, since everything still compiles down to fixed-size types
  which glsl can manipulate
- late type checking is easy to compile, since you don't need to deal with type
  parameters, const parameters, traits, associated types, or `where` clauses
