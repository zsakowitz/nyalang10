import { idFor } from "@/shared/id"
import * as li from "./exec-interp"
import * as lt from "./exec-typeck"

export function fn(
  ienv: li.Env,
  tenv: lt.Env,
  name: string,
  f: li.IFn & lt.IFn,
) {
  ienv.fns.set(idFor(name), f)
  tenv.fns.set(idFor(name), f)
}
