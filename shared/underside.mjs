export function applyUnderside(board, doc) {
  const pads = doc.testPads;
  board.components = (board.components || []).map((component) => {
    if (component.id !== pads.id) return component;
    return {
      ...component,
      side: pads.side,
      x_mm: pads.x_mm,
      y_mm: pads.y_mm,
      subparts: pads.subparts,
      src: pads.src,
      gotchas: null,
    };
  });
  board.underside = doc;
  return board;
}
