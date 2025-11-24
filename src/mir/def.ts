import { int } from "../lir/def";
import type { T } from "../shared/enum"
import type { Id } from "../shared/id"

export type ConstInt = { k: T.Param; v: Id } | { k: T.Int; v: number }

export interface Trait {
  name :Id
  params: Id[]

  associatedTypes: Id[]
  methods: FnDecl[]
}

export type Type =
  | { k: T.Void; v: null }
  | { k: T.Never; v: null }
  | { k: T.Int; v: null }
  | { k: T.Bool; v: null }
  | { k: T.Array; v: { el: Type; len: ConstInt } }
  | { k: T.Tuple; v: Type[] }
  | {k: T.}
  | {k: T.Param, v: Id}
