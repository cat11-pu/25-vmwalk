import assert from "node:assert";
import { vpnOf, indicesOf, entryPathOf } from "../ptable.js";
import { map, unmap, access, flush } from "../ops.js";
import { render } from "../app.js";

const config = { offset_bits: 4, index_bits: 3, levels: 3, frames: 8, tlb_size: 4 };
const base = {
  config: config,
  tables: [[[], []]],
  mappings: [],
  free: [0, 1, 2, 3, 4, 5, 6, 7],
  tlb: [-1, -1, -1, -1],
  cursor: 0,
  accesses: [],
  faults: [],
  maps: 0,
  unmaps: 0,
  walks: 0,
  hits: 0,
  misses: 0,
  fault_count: 0,
  tables_new: 0,
  tables_freed: 0,
  flushes: 0
};
const spec = { state: base, events: [{ kind: "map", vpn: 3, frame: -1 }, { kind: "access", address: 50 }] };

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log("ok " + name);
  } catch (error) {
    failed += 1;
    console.log("FAIL " + name + " :: " + error.message);
  }
}

check("vpnOf 给数字", () => {
  assert.strictEqual(typeof vpnOf(50, config), "number");
});

check("indicesOf 给数组", () => {
  assert.ok(Array.isArray(indicesOf(50, config)));
});

check("entryPathOf 给数组", () => {
  assert.ok(Array.isArray(entryPathOf([1, 2, 3], 2)));
});

check("map 给状态", () => {
  assert.ok(Array.isArray(map(base, 3, -1).mappings));
});

check("render 数事件", () => {
  assert.strictEqual(render(spec).count_events, 2);
});

console.log("5 cases, " + failed + " failed");
process.exit(failed === 0 ? 0 : 1);
