tasks sorted by priority and whether or not they have concrete use cases:

- rewrite parser in terms of tokens (better errors, less duplicate space-eating
  work, and alternate structure for markup)
- markup literals (for markup)
- non-concrete structs (generic matrices and geometric types)
- `join` for arrays (some weird variadic builtin operator)
- loop constructs, break, continue, return with non-specified type
- `context` (heading indices, etc.)
- bounded-length arrays (`.filter` and `.unique` in shaders)
- closures over outer variables (better `.map` and `.filter`)
- `dyn fn`
- `dyn str`
- proper constructor for `dyn [T]`
- html syntax
