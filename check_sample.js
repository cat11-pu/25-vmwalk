import fs from "node:fs";
import { vpnOf, indicesOf, entryPathOf } from "./ptable.js";
import { map, unmap, access, flush } from "./ops.js";
import { tablesOk, tlbOk, framesOk, recordsOk } from "./audit.js";

const __lines = [];
function emit(label, value) {
  __lines.push([String(label).replace(/ =$/, ""), value]);
}

const spec = JSON.parse(fs.readFileSync(process.argv[2] || "sample/walk.json", "utf8"));

function copy(state) {
  return JSON.parse(JSON.stringify(state));
}

function apply(state, event) {
  if (event.kind === "map") {
    return map(state, event.vpn, event.frame === undefined ? -1 : event.frame);
  }
  if (event.kind === "unmap") {
    return unmap(state, event.vpn);
  }
  if (event.kind === "access") {
    return access(state, event.address);
  }
  if (event.kind === "flush") {
    return flush(state);
  }
  const error = new Error("E_BAD_EVENT");
  error.code = "E_BAD_EVENT";
  throw error;
}

function run(events) {
  let state = copy(spec.state);
  const failed = [];
  for (const event of events) {
    try {
      state = apply(state, event);
    } catch (error) {
      failed.push([event.kind, error && error.code ? error.code : "E_BAD_EVENT"]);
    }
  }
  return { state: state, failed: failed };
}

function fingerprint(state) {
  return JSON.stringify([state.tables, state.mappings, state.free, state.tlb, state.cursor,
                         state.accesses, state.faults, state.maps, state.unmaps, state.walks,
                         state.hits, state.misses, state.fault_count, state.tables_new,
                         state.tables_freed, state.flushes]);
}

const whole = run(spec.events || []);
const state = whole.state;
const half = Math.ceil((spec.events || []).length / 2);
const part = run((spec.events || []).slice(0, half));
let tail = part.state;
let tailFailed = 0;
for (const event of (spec.events || []).slice(half)) {
  try {
    tail = apply(tail, event);
  } catch (error) {
    tailFailed += 1;
  }
}
const replay = run(spec.events || []);

emit("映射表", state.mappings);
emit("空闲帧", state.free);
emit("页表", state.tables);
emit("TLB槽", [state.tlb, state.cursor]);
emit("访问记录", state.accesses);
emit("缺页记录", state.faults);
emit("下钻次数", state.walks);
emit("命中与缺页", [state.hits, state.misses]);
emit("页故障次数", state.fault_count);
emit("映射与解映射", [state.maps, state.unmaps]);
emit("建表与回收", [state.tables_new, state.tables_freed]);
emit("清空次数", state.flushes);
emit("表自洽", tablesOk(state));
emit("TLB自洽", tlbOk(state));
emit("帧账自洽", framesOk(state));
emit("记录自洽", recordsOk(state));
emit("重放不新增", fingerprint(replay.state) === fingerprint(state) ? 0 : 1);
emit("重放报错", replay.failed.length);
emit("中态不同", fingerprint(part.state) !== fingerprint(state));
emit("拆两轮一致", fingerprint(tail) === fingerprint(state) && tailFailed === whole.failed.length - part.failed.length);
emit("异常事件数", whole.failed.length);

// ---- 异常路径探针：真调用实现，看它报出什么码 ----
try {
  map(copy(spec.state), 512, -1);
  emit("页号越界", "没有报错");
} catch (error) {
  emit("页号越界", error && error.code ? error.code : String(error.message));
}
try {
  let seen = copy(spec.state);
  seen = map(seen, 0, -1);
  map(seen, 0, -1);
  emit("重复映射", "没有报错");
} catch (error) {
  emit("重复映射", error && error.code ? error.code : String(error.message));
}
try {
  unmap(copy(spec.state), 5);
  emit("解映射缺失", "没有报错");
} catch (error) {
  emit("解映射缺失", error && error.code ? error.code : String(error.message));
}
try {
  access(copy(spec.state), 9000);
  emit("地址越界", "没有报错");
} catch (error) {
  emit("地址越界", error && error.code ? error.code : String(error.message));
}
try {
  map(copy(spec.state), 8, 99);
  emit("帧号非法", "没有报错");
} catch (error) {
  emit("帧号非法", error && error.code ? error.code : String(error.message));
}
try {
  let held = copy(spec.state);
  held = map(held, 0, -1);
  map(held, 8, 0);
  emit("帧被占", "没有报错");
} catch (error) {
  emit("帧被占", error && error.code ? error.code : String(error.message));
}

// ---- 期望值（参考模型算出）----
const EXPECTED = {
  "映射表": [
    [
      0,
      0
    ],
    [
      64,
      2
    ],
    [
      72,
      1
    ]
  ],
  "空闲帧": [
    3,
    4,
    5,
    6,
    7
  ],
  "页表": [
    [
      [],
      [
        [
          0,
          [
            0
          ]
        ],
        [
          1,
          [
            1
          ]
        ]
      ]
    ],
    [
      [
        0
      ],
      [
        [
          0,
          [
            0,
            0
          ]
        ]
      ]
    ],
    [
      [
        1
      ],
      [
        [
          0,
          [
            1,
            0
          ]
        ],
        [
          1,
          [
            1,
            1
          ]
        ]
      ]
    ],
    [
      [
        0,
        0
      ],
      [
        [
          0,
          0
        ]
      ]
    ],
    [
      [
        1,
        0
      ],
      [
        [
          0,
          2
        ]
      ]
    ],
    [
      [
        1,
        1
      ],
      [
        [
          0,
          1
        ]
      ]
    ]
  ],
  "TLB槽": [
    [
      72,
      0,
      -1,
      -1
    ],
    2
  ],
  "访问记录": [
    [
      0,
      0,
      0,
      3
    ],
    [
      8,
      0,
      1,
      3
    ],
    [
      0,
      1,
      0,
      0
    ],
    [
      72,
      0,
      1,
      3
    ],
    [
      72,
      0,
      1,
      3
    ],
    [
      100,
      0,
      -1,
      2
    ],
    [
      0,
      0,
      0,
      3
    ]
  ],
  "缺页记录": [
    100
  ],
  "下钻次数": 17,
  "命中与缺页": [
    1,
    6
  ],
  "映射与解映射": [
    5,
    2
  ],
  "建表与回收": [
    8,
    3
  ],
  "表自洽": true,
  "TLB自洽": true,
  "帧账自洽": true,
  "记录自洽": true,
  "重放不新增": 0,
  "重放报错": 1,
  "中态不同": true,
  "拆两轮一致": true,
  "异常事件数": 1,
  "页号越界": "E_BAD_VPN",
  "重复映射": "E_DUP_MAP",
  "解映射缺失": "E_NO_MAP",
  "地址越界": "E_BAD_ADDR",
  "帧号非法": "E_BAD_FRAME",
  "帧被占": "E_FRAME_TAKEN"
};
function __same(got, want) {
  if (typeof got === "string") {
    try {
      const parsed = JSON.parse(got);
      if (JSON.stringify(parsed) === JSON.stringify(want)) {
        return true;
      }
    } catch (error) {
      return JSON.stringify(got) === JSON.stringify(want);
    }
  }
  return JSON.stringify(got) === JSON.stringify(want);
}
let __bad = 0;
for (const [label, want] of Object.entries(EXPECTED)) {
  const found = __lines.find((pair) => pair[0] === label);
  if (!found) {
    __bad += 1;
    console.log("缺失验收项 " + label);
    continue;
  }
  if (__same(found[1], want)) {
    console.log("一致 " + label + " = " + JSON.stringify(found[1]));
  } else {
    __bad += 1;
    console.log("不一致 " + label + " 期望 " + JSON.stringify(want) + " 实际 " + JSON.stringify(found[1]));
  }
}
console.log("验收项 " + (Object.keys(EXPECTED).length - __bad) + "/" + Object.keys(EXPECTED).length + " 通过");
process.exit(__bad === 0 ? 0 : 1);
