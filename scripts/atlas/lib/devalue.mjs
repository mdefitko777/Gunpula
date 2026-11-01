// Minimal SvelteKit `devalue` unflatten, enough for soshage.com `__data.json` payloads.
// A payload node is {type: "data", data: [...]}: data[0] is the root, every other value is
// referenced by index. Negative indices are the special constants below.
const UNDEFINED = -1;
const HOLE = -2;
const NAN = -3;
const POSITIVE_INFINITY = -4;
const NEGATIVE_INFINITY = -5;
const NEGATIVE_ZERO = -6;

export function unflatten(values) {
  if (typeof values === "number") return hydrateConstant(values);
  if (!Array.isArray(values) || !values.length) return null;
  const hydrated = new Array(values.length);
  const done = new Array(values.length).fill(false);

  function hydrate(index) {
    if (index < 0) return hydrateConstant(index);
    if (done[index]) return hydrated[index];
    done[index] = true;
    const value = values[index];
    if (Array.isArray(value)) {
      if (value.length && typeof value[0] === "string") {
        const [type] = value;
        if (type === "Date") return (hydrated[index] = value[1]);
        if (type === "Set") return (hydrated[index] = value.slice(1).map(hydrate));
        if (type === "Map") {
          const out = {};
          hydrated[index] = out;
          for (let i = 1; i < value.length; i += 2) out[String(hydrate(value[i]))] = hydrate(value[i + 1]);
          return out;
        }
        if (type === "null") return (hydrated[index] = {});
        if (type === "BigInt") return (hydrated[index] = Number(value[1]));
        if (type === "RegExp") return (hydrated[index] = String(value[1]));
      }
      const out = [];
      hydrated[index] = out;
      for (const x of value) out.push(hydrate(x));
      return out;
    }
    if (value && typeof value === "object") {
      const out = {};
      hydrated[index] = out;
      for (const [k, x] of Object.entries(value)) out[k] = hydrate(x);
      return out;
    }
    return (hydrated[index] = value);
  }
  return hydrate(0);
}

function hydrateConstant(index) {
  switch (index) {
    case UNDEFINED:
    case HOLE:
      return null;
    case NAN:
      return NaN;
    case POSITIVE_INFINITY:
      return Infinity;
    case NEGATIVE_INFINITY:
      return -Infinity;
    case NEGATIVE_ZERO:
      return -0;
    default:
      return null;
  }
}

/** Decode a SvelteKit `__data.json` document: returns the hydrated data of the last data node. */
export function decodeSvelteKitData(doc) {
  const nodes = (doc?.nodes || []).filter((n) => n && n.type === "data");
  if (!nodes.length) return null;
  return unflatten(nodes[nodes.length - 1].data);
}
