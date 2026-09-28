// ops.js：映射、解映射、访问、清空
import { vpnOf, indicesOf, entryPathOf } from "./ptable.js";

function copyState(state) {
  return JSON.parse(JSON.stringify(state));
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function pathLess(left, right) {
  if (left.length !== right.length) {
    return left.length < right.length;
  }
  for (let at = 0; at < left.length; at += 1) {
    if (left[at] !== right[at]) {
      return left[at] < right[at];
    }
  }
  return false;
}

function findTable(state, path) {
  const tag = JSON.stringify(path);
  for (const row of state.tables) {
    if (JSON.stringify(row[0]) === tag) {
      return row;
    }
  }
  return null;
}

function addTable(state, path) {
  const row = [path.slice(), []];
  let at = 0;
  while (at < state.tables.length && pathLess(state.tables[at][0], path)) {
    at += 1;
  }
  state.tables.splice(at, 0, row);
  state.tables_new += 1;
  return row;
}

function putEntry(table, index, value) {
  table[1].push([index, value]);
  table[1].sort(function (left, right) {
    return left[0] - right[0];
  });
}

function dropEntry(table, index) {
  for (let at = 0; at < table[1].length; at += 1) {
    if (table[1][at][0] === index) {
      table[1].splice(at, 1);
      return;
    }
  }
}

function frameOf(state, vpn) {
  for (const pair of state.mappings) {
    if (pair[0] === vpn) {
      return pair[1];
    }
  }
  return -1;
}

export function map(input, vpn, frame) {
  const state = copyState(input);
  const cfg = state.config;
  const indices = indicesOf(vpn, cfg);
  if (frame !== -1 && (!Number.isInteger(frame) || frame < 0 || frame >= cfg.frames)) {
    fail("E_BAD_FRAME");
  }
  if (frameOf(state, vpn) !== -1) {
    fail("E_DUP_MAP");
  }
  let target = frame;
  if (frame === -1) {
    if (state.free.length === 0) {
      fail("E_NO_FRAME");
    }
    target = state.free[0];
  } else if (state.free.indexOf(frame) === -1) {
    fail("E_FRAME_TAKEN");
  }
  for (let level = 1; level <= cfg.levels; level += 1) {
    const path = entryPathOf(indices, level);
    let table = findTable(state, path);
    if (table === null) {
      table = addTable(state, path);
      const parent = findTable(state, entryPathOf(indices, level - 1));
      putEntry(parent, indices[level - 2], path.slice());
    }
    if (level === cfg.levels) {
      putEntry(table, indices[level - 1], target);
    }
  }
  state.mappings.push([vpn, target]);
  state.mappings.sort(function (left, right) {
    return left[0] - right[0];
  });
  state.free.splice(state.free.indexOf(target), 1);
  state.maps += 1;
  return state;
}

export function unmap(input, vpn) {
  const state = copyState(input);
  const cfg = state.config;
  const indices = indicesOf(vpn, cfg);
  const frame = frameOf(state, vpn);
  if (frame === -1) {
    fail("E_NO_MAP");
  }
  for (let at = 0; at < state.mappings.length; at += 1) {
    if (state.mappings[at][0] === vpn) {
      state.mappings.splice(at, 1);
      break;
    }
  }
  dropEntry(findTable(state, entryPathOf(indices, cfg.levels)), indices[cfg.levels - 1]);
  for (let level = cfg.levels; level > 1; level -= 1) {
    const path = entryPathOf(indices, level);
    const table = findTable(state, path);
    if (table === null || table[1].length > 0) {
      break;
    }
    state.tables.splice(state.tables.indexOf(table), 1);
    state.tables_freed += 1;
    dropEntry(findTable(state, entryPathOf(indices, level - 1)), indices[level - 2]);
  }
  state.free.push(frame);
  state.free.sort(function (left, right) {
    return left - right;
  });
  for (let at = 0; at < state.tlb.length; at += 1) {
    if (state.tlb[at] === vpn) {
      state.tlb[at] = -1;
    }
  }
  state.unmaps += 1;
  return state;
}

export function access(input, address) {
  const state = copyState(input);
  const cfg = state.config;
  const vpn = vpnOf(address, cfg);
  if (state.tlb.indexOf(vpn) !== -1) {
    state.accesses.push([vpn, 1, frameOf(state, vpn), 0]);
    state.hits += 1;
    return state;
  }
  const indices = indicesOf(vpn, cfg);
  let frame = -1;
  let probes = 0;
  for (let level = 1; level <= cfg.levels; level += 1) {
    probes += 1;
    const table = findTable(state, entryPathOf(indices, level));
    if (table === null) {
      break;
    }
    let value = null;
    for (const pair of table[1]) {
      if (pair[0] === indices[level - 1]) {
        value = pair[1];
        break;
      }
    }
    if (value === null) {
      break;
    }
    if (level === cfg.levels) {
      frame = value;
    }
  }
  state.walks += probes;
  state.misses += 1;
  if (frame >= 0) {
    state.tlb[state.cursor] = vpn;
    state.cursor = (state.cursor + 1) % cfg.tlb_size;
    state.accesses.push([vpn, 0, frame, probes]);
  } else {
    state.fault_count += 1;
    state.faults.push(vpn);
    state.accesses.push([vpn, 0, -1, probes]);
  }
  return state;
}

export function flush(state) {
  for (let at = 0; at < state.tlb.length; at += 1) {
    state.tlb[at] = -1;
  }
  state.cursor = 0;
  state.flushes += 1;
  return state;
}
