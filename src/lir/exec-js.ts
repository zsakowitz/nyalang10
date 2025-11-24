// UNFINISHED

import { T } from "../shared/enum"
import type { Id } from "../shared/id"

// for simplicity, this exactly matches `exec-interp`'s system. this is only
// guaranteed for now, and may change as lir-js becomes more optimized
interface VData {
  [T.Void]: null
  [T.Never]: never
  [T.Int]: number
  [T.Bool]: boolean
  [T.Extern]: unknown
  [T.Array]: unknown[]
  [T.Tuple]: unknown[]
  [T.Union]: { k: number; v: unknown }
}

type Value = string | null

export interface Block {
  globals: Set<string>
  block: string[]
}

export function block(): Block {
  return {
    globals: new Set(),
    block: [],
  }
}

export interface Env {
  opaqueExterns: Map<Id, IOpaque>
  fns: Map<Id, IFn>
  locals: Map<Id, ILocal>
}

function forkBlock(block: Block): Block {
  return {
    globals: block.globals,
    block: [],
  }
}
