// Compact help context. Never accepts or copies an API key.

export const SYSTEM_PROMPT = `You are the margin note for a Raspberry Pi Zero W lab.
Answer from the JSON context only.
For every hardware claim, cite the record id and its source url.
If the context does not contain the fact, say it is unverified.
Do not invent prices, coordinates, currents, or Bluetooth version numbers.
If a field is null, say it is not in the dataset.
The context is the only authority for this reply.`;

function sourceOf(catalog, id) {
  if (!id) return null;
  return catalog.sources?.[id] || null;
}

function withSource(catalog, record) {
  if (!record) return null;
  const sourceId = record.source || record.source_id || null;
  return {
    ...record,
    source_record: sourceOf(catalog, sourceId),
  };
}

export function buildHelpContext({ catalog, route, lang, selection, bench, bom, conflicts, step }) {
  const records = [];
  const push = (kind, record) => {
    if (!record) return;
    records.push({ kind, record: withSource(catalog, record) });
  };

  if (selection?.kind === "part") push("part", catalog.parts.find((p) => p.id === selection.id));
  if (selection?.kind === "pin") {
    push("pin", (catalog.pinout?.pins || []).find((p) => p.physical === selection.physical));
  }
  if (selection?.kind === "component") {
    push("component", (catalog.board?.components || []).find((c) => c.id === selection.id));
  }
  if (selection?.kind === "build") push("build", (catalog.builds || []).find((b) => b.id === selection.id));
  if (selection?.kind === "lesson") push("lesson", (catalog.lessons || []).find((l) => l.id === selection.id));

  for (const id of bench?.jobPartIds || []) {
    if (records.some((r) => r.kind === "part" && r.record?.id === id)) continue;
    push("part", catalog.parts.find((p) => p.id === id));
  }

  if (step?.kind === "lesson") {
    const lesson = (catalog.lessons || []).find((l) => l.id === step.lessonId);
    if (lesson) {
      records.push({
        kind: "lesson-step",
        record: {
          id: lesson.id,
          title: lesson.title,
          section_index: step.section,
          section: lesson.sections?.[step.section] || null,
          sources: (lesson.sources || []).map((id) => sourceOf(catalog, id)),
        },
      });
    }
  }
  if (step?.kind === "build") {
    const build = (catalog.builds || []).find((b) => b.id === step.buildId);
    const buildStep = build?.steps?.[step.stepIndex] || null;
    if (buildStep) {
      records.push({
        kind: "build-step",
        record: {
          id: buildStep.id,
          title: buildStep.title,
          text: buildStep.text,
          source: sourceOf(catalog, build.source),
        },
      });
    }
  }

  return {
    route: route || "/",
    lang: lang || "en",
    selection: selection || null,
    board: catalog.board
      ? { id: catalog.board.id, name: catalog.board.name, headerDefault: catalog.board.headerDefault }
      : null,
    bench: bench
      ? { header: bench.header, jobPartIds: bench.jobPartIds, mounts: bench.mounts, buildId: bench.buildId }
      : null,
    bom: bom || null,
    conflicts: conflicts || null,
    step: step || null,
    records,
  };
}
