import { BLOCK_CONTENTS } from "../parse/lir"
import { all, cyan, reset } from "../shared/ansi"
import { T } from "../shared/enum"
import { ErrorKind, issue, NLError } from "../shared/error"
import { idFor } from "../shared/id"
import { ex, T_BOOL, T_INT, T_NUM, type Type } from "./def"
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
        console.log(`✅ Test executed UB ${cyan}“${reason}”${reset}`)
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

function expectTyErr(text: string, reason: string) {
  const pat = new RegExp(
    "^" + RegExp.escape(reason).replaceAll("_XYZ", "_[0-9a-z]+") + "$",
  )

  try {
    const parsed = ex(T.Block, BLOCK_CONTENTS.parse(text))
    tck.expr(tenv, parsed)
    console.log(`❌ Test failed: expected type error '${reason}'.`)
  } catch (e) {
    if (e instanceof NLError && e.kind == ErrorKind.Standard) {
      const msg = all.reduce((msg, x) => msg.replaceAll(x, ""), e.message)
      if (pat.test(msg)) {
        console.log(`✅ Failed tyck with ${cyan}“${reason}”${reset}`)
      } else {
        console.log(
          `❌ Test failed: expected type error '${reason}', but threw '${e.message}'.`,
        )
      }
    } else {
      console.error(`❌ Test failed: ${e instanceof Error ? e.message : e}`)
    }
  }
}

declare global {
  interface RegExpConstructor {
    escape(text: string): string
  }
}

ienv.opaqueExterns.set(T_NUM.v, {
  execi(data) {
    return (
      data == "+inf" ? 1 / 0
      : data == "-inf" ? -1 / 0
      : data == "inf" ? 1 / 0
      : data == "nan" ? 0 / 0
      : Number(data)
    )
  },
})

fn("iadd", { x: T_INT, y: T_INT }, T_INT, ([a, b]) => (a + b) | 0)
fn("fadd", { x: T_NUM, y: T_NUM }, T_NUM, ([a, b]) => a + b)
fn("isub", { x: T_INT, y: T_INT }, T_INT, ([a, b]) => (a - b) | 0)
fn("fsub", { x: T_NUM, y: T_NUM }, T_NUM, ([a, b]) => a - b)
fn("imul", { x: T_INT, y: T_INT }, T_INT, ([a, b]) => Math.imul(a, b))
fn("fmul", { x: T_NUM, y: T_NUM }, T_NUM, ([a, b]) => a * b)
fn("idiv", { x: T_INT, y: T_INT }, T_INT, ([a, b]) => (a / b) | 0)
fn("fdiv", { x: T_NUM, y: T_NUM }, T_NUM, ([a, b]) => a / b)
fn("ineg", { x: T_INT }, T_INT, (x) => -x | 0)
fn("fneg", { x: T_NUM }, T_NUM, (x) => -x)
fn("ieq", { x: T_INT, y: T_INT }, T_BOOL, ([a, b]) => a == b)
fn("feq", { x: T_NUM, y: T_NUM }, T_BOOL, ([a, b]) => a == b)

expect("23", 23)
expect("true", true)
expect("(false, 23)", [false, 23])
expect("[fill 45; 3]", [45, 45, 45])
expect("[$a => $a; 4]", [0, 1, 2, 3])
expect("[each int; 2, 3, 4]", [2, 3, 4])
expect("union(int, void)#0(23)", { k: 0, v: 23 })

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

expect(
  `
  let mut $a = [fill [each int; 1, 2, 3]; 3];
  assign $a[1][0] = 2;
  $a
  `,
  [
    [1, 2, 3],
    [2, 2, 3],
    [1, 2, 3],
  ],
)

expect("'a -> int (break 'a 23).cast(int)", 23) // T.CastNever isn't UB unless `target` returns
expect(`@iadd(2, 3)`, 5)
expect("2.5", 2.5)
expect("4875634875643753647", Number(BigInt.asIntN(32, 4875634875643753647n))) // has same uint and int repr
expect("4875634877843753647", Number(BigInt.asIntN(32, 4875634877843753647n))) // has negative sign in `int` only
expect(`union(int, bool)#0(23)#0`, 23)

expectUB("unreachable", "Reached 'unreachable'.")
expectUB(`[each int; 1, 2, 3][3]`, "Accessed out-of-bounds index '3'.")
expectUB(`union(int, bool)#0(23)#1`, "Indexed union with inactive variant.")

expectTyErr("return 23", "Cannot return from this context.")
expectTyErr(`break 'a 23`, "Label 'a_XYZ does not exist.")
expectTyErr("$a", "Local $a_XYZ does not exist.")
expectTyErr(`@iadd(true, false)`, "Expected 'int', found 'bool'.")
