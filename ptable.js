// ptable.js：页号、各级索引与表路径
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function vpnOf(address, config) {
  const bits = config.offset_bits + config.index_bits * config.levels;
  if (!Number.isInteger(address) || address < 0 || address >= Math.pow(2, bits)) {
    fail("E_BAD_ADDR");
  }
  return Math.floor(address / Math.pow(2, config.offset_bits));
}

export function indicesOf(vpn, config) {
  const space = Math.pow(2, config.index_bits * config.levels);
  if (!Number.isInteger(vpn) || vpn < 0 || vpn >= space) {
    fail("E_BAD_VPN");
  }
  const indices = [];
  for (let level = 0; level < config.levels; level += 1) {
    const shift = config.index_bits * (config.levels - 1 - level);
    indices.push(Math.floor(vpn / Math.pow(2, shift)) % Math.pow(2, config.index_bits));
  }
  return indices;
}

export function entryPathOf(indices, level) {
  if (!Number.isInteger(level) || level < 1 || level > indices.length) {
    fail("E_BAD_LEVEL");
  }
  return indices.slice(0, level - 1);
}
