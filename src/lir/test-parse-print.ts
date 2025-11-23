import { DECL, EXPR } from "../parse/lir"
import { printDecl, printExpr } from "./def-debug"

for (const line of `
23
true
unreachable
2.5
[fill true; 3]
[$a => $a; 3]
[each int; 2, 3, 4]
(7, 8, 9)
union(int, void)#0(34)
unreachable.cast(int)
if true -> int then 23 else 45
[each int; 2, 1, 0][2]
$val.variant
$val#2
match $val as $data -> int ($data, 45)
{}
{ 2; 3 }
'h -> int 2
loop 'h -> int 2
return 23
break 'a 23
continue 'a
$val
@double($val)
{ 2; let $a = 23; assign $a = 4; assign ($a, $b) = (3, 4); }
`
  .split("\n")
  .map((x) => x.trim())
  .filter((x) => x)) {
  console.log(printExpr(EXPR.parse(line)))
}

console.log(
  printDecl(
    DECL.parse(`
fn @hi($param1 int, $param2 bool,) void { 45; {}; 2; }
`),
  ),
)
