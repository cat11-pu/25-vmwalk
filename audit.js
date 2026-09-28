// audit.js：四条不变量（给定，不写）
import { indicesOf } from "./ptable.js";

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

export function tablesOk(state) {
  try {
    const cfg = state.config || {};
    const tables = state.tables || [];
    const mappings = state.mappings || [];
    const levels = cfg.levels;
    if (tables.length === 0 || tables[0][0].length !== 0) {
      return false;
    }
    for (let at = 0; at < tables.length; at += 1) {
      if (at > 0 && !pathLess(tables[at - 1][0], tables[at][0])) {
        return false;
      }
      const level = tables[at][0].length + 1;
      const entries = tables[at][1] || [];
      for (let spot = 0; spot < entries.length; spot += 1) {
        if (spot > 0 && entries[spot - 1][0] >= entries[spot][0]) {
          return false;
        }
        if (entries[spot][0] < 0 || entries[spot][0] >= Math.pow(2, cfg.index_bits)) {
          return false;
        }
        const value = entries[spot][1];
        if (level < levels) {
          if (!Array.isArray(value) || value.length !== level) {
            return false;
          }
        } else if (level === levels) {
          if (typeof value !== "number" || value < 0 || value >= cfg.frames) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    const refs = {};
    for (const row of tables) {
      for (const pair of row[1]) {
        if (Array.isArray(pair[1])) {
          const child = row[0].concat([pair[0]]);
          if (JSON.stringify(child) !== JSON.stringify(pair[1])) {
            return false;
          }
          const tag = JSON.stringify(pair[1]);
          if (refs[tag]) {
            return false;
          }
          refs[tag] = true;
        }
      }
    }
    for (const row of tables) {
      if (row[0].length === 0) {
        continue;
      }
      if (!refs[JSON.stringify(row[0])]) {
        return false;
      }
    }
    const leaves = {};
    for (const row of tables) {
      if (row[0].length !== levels - 1) {
        continue;
      }
      for (const pair of row[1]) {
        leaves[JSON.stringify(row[0].concat([pair[0]]))] = pair[1];
      }
    }
    if (Object.keys(leaves).length !== mappings.length) {
      return false;
    }
    for (const pair of mappings) {
      const tag = JSON.stringify(indicesOf(pair[0], cfg));
      if (!(tag in leaves) || leaves[tag] !== pair[1]) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function tlbOk(state) {
  try {
    const cfg = state.config || {};
    const tlb = state.tlb || [];
    if (tlb.length !== cfg.tlb_size) {
      return false;
    }
    if (!Number.isInteger(state.cursor) || state.cursor < 0 || state.cursor >= cfg.tlb_size) {
      return false;
    }
    const seen = {};
    for (const slot of tlb) {
      if (slot < 0) {
        continue;
      }
      if (seen[slot]) {
        return false;
      }
      seen[slot] = true;
      let frame = -1;
      for (const pair of state.mappings || []) {
        if (pair[0] === slot) {
          frame = pair[1];
        }
      }
      if (frame < 0) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

export function framesOk(state) {
  try {
    const cfg = state.config || {};
    const free = state.free || [];
    const used = {};
    for (const pair of state.mappings || []) {
      used[pair[1]] = true;
    }
    for (let at = 0; at < free.length; at += 1) {
      if (at > 0 && free[at - 1] >= free[at]) {
        return false;
      }
      if (free[at] < 0 || free[at] >= cfg.frames) {
        return false;
      }
      if (used[free[at]]) {
        return false;
      }
    }
    return free.length + (state.mappings || []).length === cfg.frames;
  } catch (error) {
    return false;
  }
}

export function recordsOk(state) {
  try {
    const cfg = state.config || {};
    const accesses = state.accesses || [];
    const faults = state.faults || [];
    if (state.hits + state.misses !== accesses.length) {
      return false;
    }
    if (state.fault_count !== faults.length) {
      return false;
    }
    let probes = 0;
    let faulted = 0;
    for (const row of accesses) {
      probes += row[3];
      if (row[3] < 0 || row[3] > cfg.levels) {
        return false;
      }
      if (row[1] === 1) {
        if (row[3] !== 0 || row[2] < 0) {
          return false;
        }
      } else if (row[2] < 0) {
        faulted += 1;
      }
    }
    if (state.walks !== probes) {
      return false;
    }
    return faulted === faults.length;
  } catch (error) {
    return false;
  }
}
