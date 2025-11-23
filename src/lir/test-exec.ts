import { BLOCK_CONTENTS } from "../parse/lir"
import { cyan, reset, yellow } from "../shared/ansi"
import { T } from "../shared/enum"
import { ErrorKind, issue, NLError } from "../shared/error"
import { idFor } from "../shared/id"
import { ex, T_INT, type Type } from "./def"
import * as itp from "./exec-interp"
import * as tck from "./exec-typeck"

const tenv = tck.env()
const ienv = itp.env()

function fn(
  name: string,
  args: Record<string, Type>,
  ret: Type,
  execi: (values: any[]) => unknown,
) {
  tenv.fns.set(idFor(name), { args: Object.values(args), ret })
  ienv.fns.set(idFor(name), { execi })
}

function expect(text: string, expecting: unknown) {
  try {
    const parsed = ex(T.Block, BLOCK_CONTENTS.parse(text))
    tck.expr(tenv, parsed)
    const result = itp.expr(ienv, parsed)
    if (JSON.stringify(result) != JSON.stringify(expecting)) {
      issue(
        `Expected '${JSON.stringify(expecting)}', received '${JSON.stringify(result)}'.`,
      )
    }
    console.log(
      `✅ Test passed with ${cyan}“${JSON.stringify(expecting)}”${reset}.`,
    )
  } catch (e) {
    console.error(`❌ Test failed: ${e instanceof Error ? e.message : e}`)
  }
}

function expectUB(text: string, reason: string) {
  try {
    const parsed = ex(T.Block, BLOCK_CONTENTS.parse(text))
    tck.expr(tenv, parsed)
    const result = itp.expr(ienv, parsed)
    console.log(
      `❌ Test failed: expected UB '${reason}', but returned '${JSON.stringify(result)}'.`,
    )
  } catch (e) {
    if (e instanceof NLError && e.kind == ErrorKind.UB) {
      if (e.message == "[ub] " + reason) {
        console.log(`✅ Test UB'd with ${yellow}“${reason}”${reset}`)
      } else {
        console.log(
          `❌ Test failed: expected UB '${reason}', but UB'd with '${e.message}'.`,
        )
      }
    } else {
      console.error(`❌ Test failed: ${e instanceof Error ? e.message : e}`)
    }
  }
}

fn("iadd", { x: T_INT, y: T_INT }, T_INT, ([a, b]) => a + b)

expectUB("unreachable", "Reached 'unreachable'.")
expect("23", 23)
expect("true", true)
expect("(false, 23)", [false, 23])
expect("[fill 45; 3]", [45, 45, 45])
expect("[$a => $a; 4]", [0, 1, 2, 3])
expect("[each int; 2, 3, 4]", [2, 3, 4])
expect("union(int, void)#0(23)", { k: 0, v: 23 })

// evaluation order of assignments
expect("let mut $a = 23; assign ($a, $a) = (4, 5); $a", 5)

expect(
  `
  let mut $a = [each int; 7, 5, 9];
  assign $a[{
    assign $a = [each int; 3, 4, 1];
    1
  }] = 2;
  $a
  `,
  [3, 2, 1],
)

expect(
  `
  let mut $a = [each [int; 3]; [each int; 1, 2, 3], [each int; 4, 5, 6], [each int; 7, 8, 9]];
  let mut $changes = 0;
  assign $a[{
    assign $changes = @iadd($changes, 1);
    0
  }][{
    assign $changes = @iadd($changes, 1);
    0
  }] = 5;
  ($a, $changes)
  `,
  [
    [
      [5, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ],
    2,
  ],
)

expect("'a -> int (break 'a 23).cast(int)", 23) // T.CastNever isn't UB unless `target` returns
