// Model registry and the one-time y-up conversion.
// Unsourced models stay out of the picker. Nothing here copies one board onto another.

export function sourcedModels(base) {
  return (base?.models || []).filter((model) => model.sourced && model.file);
}

export function fitsBoard(item, modelId) {
  if (!item || !Array.isArray(item.boards)) return false;
  return item.boards.includes(modelId);
}

export function mismatch(item, modelId) {
  if (!item?.boards) return null;
  if (item.boards.includes(modelId)) return null;
  return item.boards;
}

function convertY(value, height) {
  if (value == null) return null;
  return height - value;
}

function convertPoint(point, height) {
  if (!point || point.y_mm == null) return point;
  return { ...point, y_mm: convertY(point.y_mm, height) };
}

// Authored coordinates are y-up from the bottom-left. The renderer reads the
// converted y_mm and must not flip the SVG.
export function toSvgFrame(board) {
  if (!board || board.frame?.y !== "up") return board;
  const height = board.outline?.h_mm?.value;
  if (typeof height !== "number") return board;
  return {
    ...board,
    frame: {
      ...board.frame,
      y: "down",
      convertedFrom: "up",
    },
    anchors: (board.anchors || []).map((anchor) => convertPoint(anchor, height)),
    components: (board.components || []).map((component) => ({
      ...component,
      placement: convertPoint(component.placement, height),
    })),
  };
}

export function initialHeader(model) {
  return model?.headerDefault === "solder" || model?.headerDefault === "hammer"
    ? model.headerDefault
    : "bare";
}
