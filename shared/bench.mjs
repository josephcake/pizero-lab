// Bench state machine. World units are millimetres.
// Zoom is not an action here: it does not change what is fitted or what the bill costs.

export const HEADER_METHODS = ["bare", "solder", "hammer"];

export function emptyState() {
  return {
    mounts: [],
    header: "bare",
    jobPartIds: [],
    buildId: null,
    log: [],
  };
}

export function partById(catalog, id) {
  return (catalog.parts || []).find((p) => p.id === id) || null;
}

function hostPose(state, hostRef) {
  if (hostRef === "board") return { x_mm: 0, y_mm: 0, rot_deg: 0 };
  const mount = state.mounts.find((m) => m.id === hostRef);
  if (!mount) return null;
  return { x_mm: mount.x_mm, y_mm: mount.y_mm, rot_deg: mount.rot_deg || 0 };
}

function hostAnchors(state, catalog, hostRef) {
  if (hostRef === "board") return catalog.board?.anchors || [];
  const mount = state.mounts.find((m) => m.id === hostRef);
  if (!mount) return null;
  const part = partById(catalog, mount.partId);
  return part?.anchors || null;
}

function gendersMate(a, b) {
  const pair = [a, b].sort().join(":");
  return pair === "hole:pin" || pair === "plug:receptacle" || pair === "contact:pad";
}

export function anchorsMate(hostAnchor, partAnchor) {
  if (!hostAnchor || !partAnchor) return false;
  const hostMates = hostAnchor.mates || [];
  const partMates = partAnchor.mates || [];
  const roles =
    hostMates.includes(partAnchor.role) || partMates.includes(hostAnchor.role);
  if (!roles) return false;
  return gendersMate(hostAnchor.gender, partAnchor.gender);
}

export function canMount(state, catalog, req) {
  const part = partById(catalog, req.partId);
  if (!part) return { ok: false, code: "unknown-part" };
  if (part.zero_w === "unsupported") return { ok: false, code: "unsupported" };
  if (part.requires_header && state.header === "bare") {
    return { ok: false, code: "needs-header" };
  }
  const dims = part.dims;
  if (!dims || dims.w_mm == null || dims.h_mm == null) {
    return { ok: false, code: "undimensioned", note: part.dims_note || null };
  }
  const partAnchor = (part.anchors || []).find((a) => a.id === req.partAnchorId);
  if (!partAnchor) return { ok: false, code: "part-anchor-missing" };
  if (partAnchor.x_mm == null || partAnchor.y_mm == null) {
    return { ok: false, code: "part-anchor-undimensioned", note: partAnchor.note || null };
  }
  const anchors = hostAnchors(state, catalog, req.hostRef);
  if (!anchors) return { ok: false, code: "unknown-host" };
  const hostAnchor = anchors.find((a) => a.id === req.hostAnchorId);
  if (!hostAnchor) return { ok: false, code: "host-anchor-missing" };
  if (hostAnchor.x_mm == null || hostAnchor.y_mm == null) {
    return { ok: false, code: "host-anchor-undimensioned", note: hostAnchor.note || null };
  }
  if (!anchorsMate(hostAnchor, partAnchor)) return { ok: false, code: "mismatch" };
  const occupied = state.mounts.some(
    (m) => m.hostRef === req.hostRef && m.hostAnchorId === req.hostAnchorId
  );
  if (occupied) return { ok: false, code: "occupied" };
  const pose0 = hostPose(state, req.hostRef);
  if (!pose0) return { ok: false, code: "unknown-host" };
  if (pose0.rot_deg) return { ok: false, code: "rotation-unsupported" };
  return {
    ok: true,
    pose: {
      x_mm: pose0.x_mm + hostAnchor.x_mm - partAnchor.x_mm,
      y_mm: pose0.y_mm + hostAnchor.y_mm - partAnchor.y_mm,
      rot_deg: 0,
    },
  };
}

function withLog(state, action) {
  return { ...state, log: [...state.log, action] };
}

export function reducer(state, action, catalog) {
  if (!action || !action.type) return { state, error: { code: "unknown-action" } };

  if (action.type === "setHeader") {
    if (!HEADER_METHODS.includes(action.method)) {
      return { state, error: { code: "bad-header" } };
    }
    return { state: withLog({ ...state, header: action.method }, action), error: null };
  }

  if (action.type === "remove") {
    const removed = state.mounts.find((m) => m.id === action.mountId);
    if (!removed) return { state, error: { code: "unknown-mount" } };
    const mounts = state.mounts.filter((m) => m.id !== action.mountId);
    const still = mounts.some((m) => m.partId === removed.partId);
    const jobPartIds = still
      ? state.jobPartIds
      : state.jobPartIds.filter((id) => id !== removed.partId);
    return { state: withLog({ ...state, mounts, jobPartIds }, action), error: null };
  }

  if (action.type === "mount") {
    const check = canMount(state, catalog, action);
    if (!check.ok) return { state, error: check };
    const id = action.mountId || `m${state.mounts.length + 1}`;
    const mount = {
      id,
      partId: action.partId,
      hostRef: action.hostRef,
      hostAnchorId: action.hostAnchorId,
      partAnchorId: action.partAnchorId,
      ...check.pose,
    };
    const jobPartIds = state.jobPartIds.includes(action.partId)
      ? state.jobPartIds
      : [...state.jobPartIds, action.partId];
    return {
      state: withLog({ ...state, mounts: [...state.mounts, mount], jobPartIds }, action),
      error: null,
    };
  }

  if (action.type === "loadBuild") {
    const build = (catalog.builds || []).find((b) => b.id === action.buildId);
    if (!build) return { state, error: { code: "unknown-build" } };
    const played = replaySteps(build, (build.steps || []).length - 1, catalog);
    return {
      state: played.state,
      error: played.errors.length ? { code: "partial", errors: played.errors } : null,
    };
  }

  return { state, error: { code: "unknown-action" } };
}

export function replaySteps(build, uptoInclusive, catalog) {
  let state = { ...emptyState(), buildId: build.id, jobPartIds: [...(build.part_ids || [])] };
  const frames = [];
  const errors = [];
  const steps = (build.steps || []).slice(0, uptoInclusive + 1);
  steps.forEach((step, index) => {
    if (step.action) {
      const result = reducer(state, step.action, catalog);
      const job = new Set([...(build.part_ids || []), ...result.state.jobPartIds]);
      state = { ...result.state, buildId: build.id, jobPartIds: [...job] };
      if (result.error) errors.push({ stepId: step.id, error: result.error });
      frames.push({ index, step, error: result.error, state });
    } else {
      frames.push({ index, step, error: null, state });
    }
  });
  return { state, frames, errors };
}

function addLine(map, id, reason) {
  if (!id) return;
  const row = map.get(id) || { qty: 0, reason };
  row.qty += 1;
  if (!row.reason) row.reason = reason;
  map.set(id, row);
}

export function deriveBom(state, catalog) {
  const map = new Map();
  for (const id of state.jobPartIds || []) addLine(map, id, "on the job");
  for (const mount of state.mounts || []) {
    if (!map.has(mount.partId)) addLine(map, mount.partId, "mounted");
  }
  for (const rule of catalog.bomRules || []) {
    const headerHit = rule.when?.header && rule.when.header.includes(state.header);
    const flag = rule.when?.part_flag;
    const flagHit =
      flag &&
      [...map.keys()].some((id) => partById(catalog, id)?.[flag]);
    if ((headerHit || flagHit) && !map.has(rule.add_part_id)) {
      addLine(map, rule.add_part_id, rule.id);
    }
  }
  const lines = [];
  const unpricedNames = [];
  let priced = 0;
  for (const [id, row] of map) {
    const part = partById(catalog, id);
    const price = part && typeof part.price_usd === "number" ? part.price_usd : null;
    if (price == null) unpricedNames.push(part?.name?.en || id);
    else priced += price * row.qty;
    lines.push({
      partId: id,
      name: part?.name || { en: id, es: id },
      qty: row.qty,
      price_usd: price,
      price_src: part?.price_src ?? null,
      price_date: part?.price_date ?? null,
      retailer: part?.retailer ?? null,
      reason: row.reason,
    });
  }
  return {
    lines,
    priced_usd: Math.round(priced * 100) / 100,
    unpriced_count: unpricedNames.length,
    unpriced_names: unpricedNames,
  };
}

export function formatPrice(row) {
  if (row?.price_usd == null) return null;
  const bits = [`$${Number(row.price_usd).toFixed(2)} USD`];
  const who = row.retailer || row.price_src;
  if (who) bits.push(who);
  if (row.price_date) bits.push(row.price_date);
  return bits.join(" · ");
}

export function formatBom(bom) {
  const money = `$${bom.priced_usd.toFixed(2)}`;
  if (bom.unpriced_count > 0) return `${money} + ${bom.unpriced_count} items unpriced`;
  return money;
}

export function bomForBuild(build, catalog) {
  const played = replaySteps(build, (build.steps || []).length - 1, catalog);
  return deriveBom(played.state, catalog);
}
