tasks sorted by priority and whether or not they have concrete use cases:

- string literals (for markup)
- markup literals (for markup)
- ensure every function has at least one test (check for implementation errors)
- non-concrete structs (generic matrices and geometric types)
- coercion from `[!; 0]` to any `[U]` (array literals work)
- recursive types (surreal numbers)
- `context` (heading indices, etc.)
- bounded-length arrays (`.filter` and `.unique` in shaders)
- `dyn fn`
- `dyn str`
- proper constructor for `dyn [T]`
- html syntax
