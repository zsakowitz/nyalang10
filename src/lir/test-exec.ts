import { BLOCK_CONTENTS, DECL } from "../parse/lir"
import { all, cyan, reset } from "../shared/ansi"
import { T } from "../shared/enum"
import { ErrorKind, NLError } from "../shared/error"
import { idFor } from "../shared/id"
import { bool, ex, int, num, ty, void_, type Type } from "./def"
import { lIssue } from "./error"
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
      lIssue(
        `Expected '${JSON.stringify(expecting)}', received '${JSON.stringify(result)}'.`,
      )
    }
    console.log(
      `✅ Test passed with ${cyan}“${JSON.stringify(expecting)}”${reset}.`,
    )
  } catch (e) {
    console.error(`❌ Test failed:`, e instanceof Error ? e.message : e)
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
      console.error(`❌ Test failed:`, e instanceof Error ? e.message : e)
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
      console.error(`❌ Test failed:`, e instanceof Error ? e.message : e)
    }
  }
}

function decl(text: string) {
  const result = DECL.many().parse(text)
  result.forEach((x) => {
    tck.decl(tenv, x)
    itp.decl(ienv, x)
  })
}

declare global {
  interface RegExpConstructor {
    escape(text: string): string
  }
}

ienv.opaqueExterns.set(num.v, {
  fromi(data) {
    return (
      data == "+inf" ? 1 / 0
      : data == "-inf" ? -1 / 0
      : data == "inf" ? 1 / 0
      : data == "nan" ? 0 / 0
      : Number(data)
    )
  },
})

fn("iadd", { x: int, y: int }, int, ([a, b]) => (a + b) | 0)
fn("fadd", { x: num, y: num }, num, ([a, b]) => a + b)
fn("isub", { x: int, y: int }, int, ([a, b]) => (a - b) | 0)
fn("fsub", { x: num, y: num }, num, ([a, b]) => a - b)
fn("imul", { x: int, y: int }, int, ([a, b]) => Math.imul(a, b))
fn("fmul", { x: num, y: num }, num, ([a, b]) => a * b)
fn("idiv", { x: int, y: int }, int, ([a, b]) => (a / b) | 0)
fn("fdiv", { x: num, y: num }, num, ([a, b]) => a / b)
fn("irem", { x: int, y: int }, int, ([a, b]) => a % b | 0)
fn("frem", { x: num, y: num }, num, ([a, b]) => a % b)
fn("imod", { x: int, y: int }, int, ([a, b]) => {
  a = a | 0
  b = b | 0
  return (((a % b | 0) + b) | 0) % b | 0
})
fn("fmod", { x: num, y: num }, num, ([a, b]) => ((a % b) + b) % b)
fn("ineg", { x: int }, int, ([x]) => -x | 0)
fn("fneg", { x: num }, num, ([x]) => -x)
fn("ieq", { x: int, y: int }, bool, ([a, b]) => a == b)
fn("feq", { x: num, y: num }, bool, ([a, b]) => a == b)

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

// fraction manipulation functions
decl(`
  fn @gcd($a int, $b int) int {
    let mut $a = $a;
    let mut $b = $b;
    loop 'a ! {
      if @ieq($b, 0) -> void then return $a else {};
      let $t = $b;
      assign $b = @imod($a, $b);
      assign $a = $t;
    }
  }

  fn @xsimp($a (int, int)) (int, int) {
    let $gcd = @gcd($a.0, $a.1);
    (@idiv($a.0, $gcd), @idiv($a.1, $gcd))
  }

  fn @xadd($a (int, int), $b (int, int)) (int, int) {
    @xsimp((
      @iadd(
        @imul($a.0, $b.1),
        @imul($a.1, $b.0),
      ),
      @imul($a.1, $b.1)
    ))
  }

  fn @xsub($a (int, int), $b (int, int)) (int, int) {
    @xsimp((
      @isub(
        @imul($a.0, $b.1),
        @imul($a.1, $b.0),
      ),
      @imul($a.1, $b.1)
    ))
  }

  fn @xmul($a (int, int), $b (int, int)) (int, int) {
    @xsimp((@imul($a.0, $b.0), @imul($a.1, $b.1)))
  }

  fn @xdiv($a (int, int), $b (int, int)) (int, int) {
    @xsimp((@imul($a.0, $b.1), @imul($a.1, $b.0)))
  }

  fn @xeq($a (int, int), $b (int, int)) bool {
    @ieq(@imul($a.0, $b.1), @imul($a.1, $b.0))
  }
`)

expect(`@xadd((2, 3), (4, 5))`, [22, 15])
expect(`@fadd(@fdiv(2.0, 3.0), @fdiv(4.0, 5.0))`, 2 / 3 + 4 / 5)
expect(`@gcd(25, 5)`, 5)
expect(`@gcd(5, 25)`, 5)
expect(`@gcd(1071, 462)`, 21)
expect(`@xsimp((0, 1))`, [0, 1])
expect(`@xsimp((2, 0))`, [1, 0])
expect(`@xsimp((@ineg(2), 0))`, [1, 0])
expect(`@xsimp((0, 0))`, [0, 0])
expect(`@xeq((0, 0), (2, 3))`, true)

const ibox = ty(T.Extern, idFor("ibox"))

fn("ibox", { x: int }, ibox, ([x]) => ({ v: x }))

fn("ibox_get", { x: ibox }, int, ([x]) => x.v)

fn("ibox_set", { x: ibox, y: int }, void_, ([x, y]) => {
  x.v = y
  return null
})

expect(`@ibox(2)`, { v: 2 })
expect(`let $a = @ibox(2); @ibox_set($a, 3); $a`, { v: 3 })
expect(`let $a = [fill @ibox(2); 2]; @ibox_set($a[0], 4); $a`, [
  { v: 4 },
  { v: 4 },
])
