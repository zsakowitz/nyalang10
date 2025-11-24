# type coercion

# type-associated functions

to allow working with groups from abstract algebra, we must be able to define
the `id` function for a given type. however, how do we declare it?

```rs
fn id() int = 0;
fn id() str = "";
```

trivially, these two functions conflict. allowing multiple overloads with
identical argument lists is not an option, and neither do we want to use the
return type as part of inference, since that makes type checking bidirectional,
which is not part of the MVP.

instead, we will have some builtin type which is like `void`, but has the
additional context of being related to some type. my preferred way to spell it
would be `for T`, since it makes sense as a type and value, but that conflicts
with iterator notation, which is way more important. `in T` is an alternative
spelling which makes sense, and does not directly conflict with iterators.

```rs
fn id(in int) int = 0;
fn id(in str) str = 0;

id(in int) // so easy!
```

so type-associated functions are not real. even if we make them real via `trait`
syntax or something, that can always be syntax sugar for `in T` types.

# function overloading and generics

these two features do not compose well. overloading means checking a bunch of
overloads top-to-bottom, and generics mean inferring and checking parameters
types and arbitrary requirements. both of these are bad for performance, but we
need MIR to be quickly reevaluatable so project nya is fast, so we must make
sure to avoid creating an overload resolution mechanic which is `O(mn)` in
number of overloads and complexity of each overload.

we would like for it to be possible to immediately determine which overload of a
particular function we want to use, without trying multiple candidates, and only
run final checks on that single overload.

our rough strategy will be to take the "shape" of each type, and match overloads
against that, so that `fn((int, bool))` and `fn(bool)` are allowed, but not
`fn((int, bool))` and `fn((T, bool))` or `fn((bool, int))`.

we thus define the "shell" of a type. here is the shell for each MIR type:

| MIR type      | Shell                                            |
| ------------- | ------------------------------------------------ |
| `void`        | `void`                                           |
| `!`           | `never`                                          |
| `int`         | `int`                                            |
| `bool`        | `bool`                                           |
| `[T; N]`      | `array`                                          |
| `(A, B, ...)` | `tuple(N)`, where `N` is the length of the tuple |
| `T`           | `any`                                            |
| `Adt`         | `adt(I)`, where `I` is the adt id                |
| `Extern`      | `extern(I)`, where `I` is the extern id          |
| `in T`        | the shell of `T`                                 |

two type shells `A` and `B` are disjoint when neither is `any`, and `A != B`. so
`int` and `bool` have disjoint shells, but `(int, bool)` and `(bool, str)` do
not.

then, for a function declaration `fn name(arg1, arg2, arg3, ...) ret`, its
"function shell" is the array `[shell(arg1), shell(arg2), ...]`.

two function declarations with shells `[a0, a1, ...]` and `[b0, b1, ...]` have
disjoint shells if `disjoint(a0, b0) || disjoint(a1, b1) || ...`, although the
condition of disjointness can only apply if their argument lists are equally
long.

any two distinct function overloads must then:

- have different names, or
- have different argument counts, or
- have disjoint function shells

this means that, once we know the types of arguments of a function call, we
subsequently only have to resolve generic arguments and `where` clauses of a
single overload, even if twenty are defined, since we can quickly skip over all
the overloads with non-matching shapes.

this does unfortunately mean that function declaration is `O(n²)` in typeck,
since every declaration needs to check for conflicts with every other shape.
however, computers are fast, and even with 50 overloads, that will still be only
around a thousand checks. until that's an actual problem, we won't bother
optimizing.
