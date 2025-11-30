tasks sorted by priority and whether or not they have concrete use cases:

- string literals (for markup)
- rewrite parser in terms of tokens (better errors, less duplicate space-eating
  work, and alternate structure for markup)
- markup literals (for markup)
- ensure every function has at least one test (check for implementation errors)
- non-concrete structs (generic matrices and geometric types)
- coercion from `[!; 0]` to any `[U]` (array literals work)
- `join` for arrays (some weird variadic builtin operator)
- recursive types (surreal numbers)
- `context` (heading indices, etc.)
- bounded-length arrays (`.filter` and `.unique` in shaders)
- `dyn fn`
- `dyn str`
- proper constructor for `dyn [T]`
- html syntax
