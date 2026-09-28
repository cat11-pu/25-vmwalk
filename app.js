// app.js：把事件流跑成一张仪表台要用的视图（给定，不写）
import { vpnOf, indicesOf } from "./ptable.js";
import { map, unmap, access, flush } from "./ops.js";
import { tablesOk, tlbOk, framesOk, recordsOk } from "./audit.js";

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

export function render(spec) {
  let state = copy(spec.state);
  const failed = [];
  let last = null;
  for (const event of spec.events || []) {
    const before = state.accesses.length;
    try {
      state = apply(state, event);
    } catch (error) {
      failed.push([event.kind, error && error.code ? error.code : "E_BAD_EVENT"]);
      continue;
    }
    if (event.kind === "access" && state.accesses.length > before) {
      last = { address: event.address, row: state.accesses[state.accesses.length - 1] };
    }
  }
  let ruler = null;
  if (last !== null) {
    const cfg = state.config;
    const vpn = last.row[0];
    ruler = {
      address: last.address,
      vpn: vpn,
      indices: indicesOf(vpn, cfg),
      offset: last.address - vpn * Math.pow(2, cfg.offset_bits),
      hit: last.row[1],
      frame: last.row[2],
      probes: last.row[3]
    };
  }
  return {
    config: state.config,
    tables: state.tables,
    mappings: state.mappings,
    free: state.free,
    tlb: state.tlb,
    cursor: state.cursor,
    accesses: state.accesses,
    faults: state.faults,
    maps: state.maps,
    unmaps: state.unmaps,
    walks: state.walks,
    hits: state.hits,
    misses: state.misses,
    fault_count: state.fault_count,
    tables_new: state.tables_new,
    tables_freed: state.tables_freed,
    flushes: state.flushes,
    tables_ok: tablesOk(state),
    tlb_ok: tlbOk(state),
    frames_ok: framesOk(state),
    records_ok: recordsOk(state),
    ruler: ruler,
    count_events: (spec.events || []).length,
    failed_events: failed.length,
    failed_marks: failed,
    tail: vpnOf(3, state.config) + indicesOf(3, state.config).length
  };
}
