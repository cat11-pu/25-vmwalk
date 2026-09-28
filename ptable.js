// ptable.js：页号、各级索引与表路径
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function pageSizeOf(config) {
  return Math.pow(2, config.offset_bits);
}

function vpnSpaceOf(config) {
  return Math.pow(2, config.index_bits * config.levels);
}

export function vpnOf(address, config) {
  const space = pageSizeOf(config) * vpnSpaceOf(config);
  if (!Number.isInteger(address) || address < 0 || address >= space) {
    fail("E_BAD_ADDR");
  }
  return Math.floor(address / pageSizeOf(config));
}

export function indicesOf(vpn, config) {
  const span = vpnSpaceOf(config);
  if (!Number.isInteger(vpn) || vpn < 0 || vpn >= span) {
    fail("E_BAD_VPN");
  }
  const width = Math.pow(2, config.index_bits);
  const indices = [];
  for (let level = config.levels - 1; level >= 0; level -= 1) {
    const scale = Math.pow(2, config.index_bits * level);
    indices.push(Math.floor(vpn / scale) % width);
  }
  return indices;
}

export function entryPathOf(indices, level) {
  if (!Number.isInteger(level) || level < 1 || level > indices.length) {
    fail("E_BAD_LEVEL");
  }
  return indices.slice(0, level - 1);
}
