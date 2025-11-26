# type coercion

we need some form of type coercion, so that `num` and `complex` behave well
together.

can we implement it without actual language support? sort of:

```rs
fn into(a: num, in num) -> num { a }
fn into(a: num, in complex) -> complex { complex_xy(a, 0.0) }
fn into(a: complex, in num) -> complex { a }
fn into(a: complex, in complex) -> complex { a }

fn add_raw(a: num, b: num) -> num; // provided by executor
fn add_raw(a: complex, b: complex) -> complex { ... }

fn +<A, B, Result, Final>(a: A, b: B) -> Final
where
  fn into(A, in B) -> Result,
  fn into(B, in A) -> Result,
  fn add_raw(Result, Result) -> Final,
{
  add_raw(into(a, in B), into(b, in A))
}
```

but that looks bad, and would also still result in n² explosion for
`directedangle`, `int`, `num`, `complex`, and `quaternion`, so maybe we want to
avoid it.

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

we thus define the "shell" of a type. here is the shell for each MIR type
(excluding type aliases, which are just syntax sugar):

| MIR type      | Shell                                           |
| ------------- | ----------------------------------------------- |
| `void`        | `void`                                          |
| `!`           | `never`                                         |
| `int`         | `int`                                           |
| `bool`        | `bool`                                          |
| `[T; N]`      | `array`                                         |
| `(A, B, ...)` | `tuple N`, where `N` is the length of the tuple |
| `Extern`      | `extern I`, where `I` is the extern id          |
| `in T`        | `in I`, where `I` is the shell of `T`           |
| `Adt`         | `adt I`, where `I` is the adt id                |
| `T`           | `any`                                           |

the only shell there which allows infinite nesting is `in`; this is considered
acceptable.

to whether two type shells `A` and `B` are disjoint:

- if `A` or `B` is `any`, they are joint
- if `A` is `in T` and `B` is `in U`, return whether `T` and `U` are disjoint
- otherwise, they are disjoint

so `int` and `bool` have disjoint shells, but `(int, bool)` and `(bool, str)` do
not.

then, for a function declaration `fn name(arg1, arg2, arg3, ...) ret`, its
"function shell" is the array `[shell(arg1), shell(arg2), ...]`. note than no
argument may be of type `in T` where `T` contains a generic parameter.

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

# all ascii puncutation on a standard keyboard

| character | usage                                      |
| --------- | ------------------------------------------ |
| `~`       | op: symmetric difference                   |
| backtick  | md: code                                   |
| `!`       | op: negate, compare                        |
| `@`       | syntax: builtin                            |
| `#`       | ctx: starts scripting                      |
| `$`       | ctx: delimits math                         |
| `%`       | op: modulus                                |
| `^`       | op: power                                  |
| `&`       | op: and/intersection; starts html literals |
| `*`       | op: product                                |
| `()`      | op: parenthesize, tuple, call              |
| `-`       | op: negate, subtract                       |
| `_`       | identifier, hole                           |
| `=`       | op: compare, assign                        |
| `+`       | op: add                                    |
| `[]`      | op: array, index                           |
| `{}`      | syntax: block, instantiate struct          |
| backslash | md: escape                                 |
| bar       | op: or/union                               |
| `;`       | syntax: terminate statement                |
| `:`       | syntax: type definition                    |
| `'`       | md: apostrophe                             |
| `"`       | syntax: string                             |
| `,`       | syntax: separate items                     |
| `.`       | md: period, numeric list                   |
| `<`       | op: compare                                |
| `>`       | op: compare                                |
| `?`       | op: option                                 |
| `/`       | op: divide                                 |

seeing how we expect to use this language both for serious scripting (e.g.
advent of code, where arrays should be compact; or meowboxes, where computation
is more important than display) and for markup (where it should be easy to embed
markup into other regions of text), we would like syntax which is concise for
both cases.

our current syntax shall be the following. it is subject to change based on
whether it is easy to use.

| what it is         | syntax                      |
| ------------------ | --------------------------- |
| array by fill      | `(el; len)`                 |
| array by index     | `(index => el; len)`        |
| array by elements  | `array(el0, el1, el2, ...)` |
| array index        | `data.(N)`                  |
| array type         | `(T; N)`                    |
| embedded markup    | `[= _markup_ goes *here*]`  |
| markup as argument | `table_cell[23]`            |

# named function parameters

typst has named function parameters and it seems useful; why not add them to our
system? the simple solution is that `join(2, 3, hi: [world])` is rewritten as
`join(2, 3).hi[world]`, no fuss needed, but that would interact badly with
`#set` equivalents, since it's converted to a `hi` and `join` call.

idea: named arguments are always optional, and so they are declared via `?:`
instead.

```rs
fn scaled(base: int, scale?: int) int {
  base * (scale ?? 1)
}

scaled(2); // 2
scaled(2, scale: 3); // 6
```

is that too much bloat? probably. do i care? no. wait actually, yes. because it
means `where` clauses become extra complicated.

(this is now an existential crisis.)

maybe this shouldn't be a statically typed language.

no. that's wrong, because then shaders will be impossible. so it still needs to
be statically typed. it just also need to be dynamic enough to do well in a
markup environment. ugh, language design is difficult when you're trying to
write one language which can do ten unrelated things. it should just be two
high-level ones, one for code and one for markup. but typst proved it works so
much better when you allow them to be combined! why are they so cool...

we'll just ignore named parameters for now, since they interact annoyingly with
everything else.

# syntax re-decisions

with Rust arrays, `()` blocks, `{}` markup

```rs
fn hi(a: int, b: int) (a, b) {
  let array: [int; 4] = [7, 8, 9, 5];
  [i => array[i]; 2];
  [array; 3];

  let mut a = 23;
  if (a < 23) (
    let mut people = 45;
    people_dict.set(78, (
      let c = {#people #(
        if (people == 1) {person} else {people}
      ) currently exist.};
      c.resolve()
    ));
    (people + 3) * (4 - (x ~ y));
    4 + 5
  ) else (
    for i in 0..n (
      print({hello! my name is #i});
    )
  )
  list{my name}{your name}{someone else's name}{a fourth name};
  table(cell_spacing: 4px, columns: 3){AaBb}{AB}{BA}{...};
  a
}
```

with Rust arrays, `.[]` indexing, `{}` blocks, and `[[]]` markup

```rs
fn hi(a: int, b: int) (a, b) {
  let array: [int; 4] = [7, 8, 9, 5];
  [i => array.[i]; 2];
  [array; 3];

  let mut a = 23;
  if (a < 23) (
    let mut people = 45;
    people_dict.set(78, (
      let c = [[ #people #(
        if (people == 1) [[ person ]] else [[ people ]]
      ) currently exist. ]];
      c.resolve()
    ));
    (people + 3) * (4 - (x ~ y));
    4 + 5
  ) else (
    for i in 0..n (
      print([[hello! my name is #i]]);
    )
  )
  list[my name][your name][someone else's name][a fourth name];
  table(cell_spacing: 4px, columns: 3)[AaBb][AB][BA][...];
  a
}
```

nope. syntax is stupid because it can change later. i only want enough syntax
that i know this will eventually be possible.

# idea

for tuples, use `@(...)`; reserve `(...)` for arrays.

use `.+` and the like to vectorize operators. so `(2, 3) + (4, 5)` isn't
defined, but `(7, 3) .+ (4, 5)` is, similarly to
`(x => (7, 3)(x) + (4, 5)(x); 2)`

for coercions, instead of matching on coercions at the function call site,
declare combinatorial explosions of functions ahead-of-time, and enforce that
functions \[left unfinished\]
