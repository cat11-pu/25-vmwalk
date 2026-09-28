// ops.js：映射、解映射、访问、清空
import { vpnOf, indicesOf, entryPathOf } from "./ptable.js";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function copy(state) {
  return JSON.parse(JSON.stringify(state));
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

function getTable(tables, path) {
  const tag = JSON.stringify(path);
  for (const row of tables) {
    if (JSON.stringify(row[0]) === tag) {
      return row;
    }
  }
  return null;
}

function insertTable(tables, row) {
  let at = tables.length;
  for (let spot = 0; spot < tables.length; spot += 1) {
    if (pathLess(row[0], tables[spot][0])) {
      at = spot;
      break;
    }
  }
  tables.splice(at, 0, row);
}

function frameOf(mappings, vpn) {
  for (const pair of mappings) {
    if (pair[0] === vpn) {
      return pair[1];
    }
  }
  return -1;
}

export function map(state, vpn, frame) {
  const cfg = state.config;
  const indices = indicesOf(vpn, cfg);
  const next = copy(state);
  if (frameOf(next.mappings, vpn) >= 0) {
    fail("E_DUP_MAP");
  }
  let useFrame = frame;
  if (frame === -1) {
    if (next.free.length === 0) {
      fail("E_NO_FRAME");
    }
    useFrame = next.free[0];
  } else {
    if (!Number.isInteger(frame) || frame < 0 || frame >= cfg.frames) {
      fail("E_BAD_FRAME");
    }
    if (next.free.indexOf(frame) === -1) {
      fail("E_FRAME_TAKEN");
    }
  }
  for (let level = 1; level <= cfg.levels; level += 1) {
    const path = entryPathOf(indices, level);
    let table = getTable(next.tables, path);
    if (!table) {
      table = [path, []];
      insertTable(next.tables, table);
      next.tables_new += 1;
    }
    const index = indices[level - 1];
    const found = table[1].some((pair) => pair[0] === index);
    if (!found) {
      if (level < cfg.levels) {
        const childPath = path.concat([index]);
        table[1].push([index, childPath]);
        insertTable(next.tables, [childPath, []]);
        next.tables_new += 1;
      } else {
        table[1].push([index, useFrame]);
      }
      table[1].sort((left, right) => left[0] - right[0]);
    }
  }
  next.free = next.free.filter((spot) => spot !== useFrame);
  next.mappings.push([vpn, useFrame]);
  next.mappings.sort((left, right) => left[0] - right[0]);
  next.maps += 1;
  return next;
}

export function unmap(state, vpn) {
  const cfg = state.config;
  const indices = indicesOf(vpn, cfg);
  const next = copy(state);
  const frame = frameOf(next.mappings, vpn);
  if (frame < 0) {
    fail("E_NO_MAP");
  }
  next.mappings = next.mappings.filter((pair) => pair[0] !== vpn);
  next.free.push(frame);
  next.free.sort((left, right) => left - right);
  const leaf = getTable(next.tables, entryPathOf(indices, cfg.levels));
  leaf[1] = leaf[1].filter((pair) => pair[0] !== indices[cfg.levels - 1]);
  for (let level = cfg.levels; level > 1; level -= 1) {
    const table = getTable(next.tables, entryPathOf(indices, level));
    if (!table || table[1].length > 0) {
      break;
    }
    next.tables = next.tables.filter((row) => row !== table);
    next.tables_freed += 1;
    const parent = getTable(next.tables, entryPathOf(indices, level - 1));
    if (parent) {
      parent[1] = parent[1].filter((pair) => pair[0] !== indices[level - 2]);
    }
  }
  next.tlb = next.tlb.map((slot) => (slot === vpn ? -1 : slot));
  next.unmaps += 1;
  return next;
}

export function access(state, address) {
  const cfg = state.config;
  const vpn = vpnOf(address, cfg);
  const next = copy(state);
  if (next.tlb.indexOf(vpn) !== -1) {
    next.accesses.push([vpn, 1, frameOf(next.mappings, vpn), 0]);
    next.hits += 1;
    return next;
  }
  const indices = indicesOf(vpn, cfg);
  let probes = 0;
  let frame = -1;
  for (let level = 1; level <= cfg.levels; level += 1) {
    probes += 1;
    const table = getTable(next.tables, entryPathOf(indices, level));
    if (!table) {
      break;
    }
    const entry = table[1].find((pair) => pair[0] === indices[level - 1]);
    if (!entry) {
      break;
    }
    if (level === cfg.levels) {
      frame = entry[1];
    }
  }
  next.walks += probes;
  next.misses += 1;
  if (frame >= 0) {
    next.tlb[next.cursor] = vpn;
    next.cursor = (next.cursor + 1) % cfg.tlb_size;
    next.accesses.push([vpn, 0, frame, probes]);
  } else {
    next.faults.push(vpn);
    next.fault_count += 1;
    next.accesses.push([vpn, 0, -1, probes]);
  }
  return next;
}

export function flush(state) {
  const next = copy(state);
  next.tlb = next.tlb.map(() => -1);
  next.cursor = 0;
  next.flushes += 1;
  return next;
}
