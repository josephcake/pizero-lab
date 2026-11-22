import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  Box3,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  MOUSE,
  Path,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Shape,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import heights from "../../data/boards/zero-w.3d.json";

const mm = (entry) => entry.value_mm;

function token(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function roundedBoard(w, h, radius) {
  const shape = new Shape();
  const x0 = -w / 2;
  const y0 = -h / 2;
  const r = Math.min(radius, w / 2, h / 2);
  shape.moveTo(x0 + r, y0);
  shape.lineTo(x0 + w - r, y0);
  shape.absarc(x0 + w - r, y0 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x0 + w, y0 + h - r);
  shape.absarc(x0 + w - r, y0 + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x0 + r, y0 + h);
  shape.absarc(x0 + r, y0 + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + r);
  shape.absarc(x0 + r, y0 + r, r, Math.PI, (Math.PI * 3) / 2, false);
  return shape;
}

function addHole(shape, cx, cy, radius) {
  const path = new Path();
  path.absarc(cx, cy, radius, 0, Math.PI * 2, true);
  shape.holes.push(path);
}

function toBoard(fx, fy, w, h) {
  return { x: fx - w / 2, y: fy - h / 2 };
}

function partFlux(part, boardH) {
  return { x: part.x, y: boardH - (part.y + part.h), w: part.w, h: part.h };
}

export default function Board3D({ board, pinout, header, mounts, parts, selected, onSelect, labels, viewToggle, onOpenLayers }) {
  const canvasRef = useRef(null);
  const api = useRef({});
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const propsRef = useRef({});
  const labelsRef = useRef(labels);
  const [chip, setChip] = useState("");
  const [showBackNote, setShowBackNote] = useState(false);
  selectedRef.current = selected;
  onSelectRef.current = onSelect;
  propsRef.current = { board, header, mounts, parts };
  labelsRef.current = labels;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let contentGeoms = [];
    let contentMats = [];
    const pickables = [];
    const tagged = [];
    const viewDir = new Vector3(0.72, 0.62, 0.55);
    const viewUp = new Vector3(0, 1, 0);
    const thickness = mm(heights.pcb_thickness_mm);
    let hoverPhysical = null;
    const signal = new Color(token("--signal", "#62c6ff"));

    const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new Scene();
    const boardGroup = new Group();
    boardGroup.rotation.x = -Math.PI / 2;
    scene.add(boardGroup);
    const camera = new PerspectiveCamera(35, 1, 0.1, 800);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = false;
    controls.minDistance = 22;
    controls.maxDistance = 220;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.target.set(0, 0, thickness / 2);
    controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
    controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

    scene.add(new AmbientLight(0xffffff, 0.72));
    // Lights ride in boardGroup so Rx(-PI/2) carries the old Z-up key into Y-up.
    const key = new DirectionalLight(0xffffff, 1.15);
    key.position.set(40, -30, 80);
    boardGroup.add(key);
    const fill = new DirectionalLight(0xffffff, 0.9);
    fill.position.set(40, -30, -80);
    boardGroup.add(fill);

    let frame = 0;
    const requestRender = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        renderer.render(scene, camera);
      });
    };

    function track(geometry, material) {
      contentGeoms.push(geometry);
      if (material && !contentMats.includes(material)) contentMats.push(material);
      return new Mesh(geometry, material);
    }

    function mat(color) {
      const material = new MeshLambertMaterial({ color, flatShading: true });
      contentMats.push(material);
      return material;
    }

    function clearContent() {
      for (const mesh of [...pickables, ...tagged]) boardGroup.remove(mesh);
      pickables.length = 0;
      tagged.length = 0;
      boardGroup.children.filter((child) => child.userData.built).forEach((child) => boardGroup.remove(child));
      for (const geometry of contentGeoms) geometry.dispose();
      for (const material of contentMats) material.dispose();
      contentGeoms = [];
      contentMats = [];
    }

    function rebuild() {
      clearContent();
      const { board: liveBoard, header: liveHeader, mounts: liveMounts, parts: liveParts } = propsRef.current;
      const W = liveBoard.outline.w_mm.value;
      const H = liveBoard.outline.h_mm.value;
      const pcbMat = mat(0x1b5e3f);
      const socMat = mat(0x16171a);
      const steelMat = mat(0x8b929b);
      const sdMat = mat(0x5c6572);
      const csiMat = mat(0xece6d6);
      const headerMat = mat(0x17181c);
      const pinMat = mat(0xe2bf55);
      const hatMat = mat(0x143526);
      const edgeMat = new LineBasicMaterial({ color: 0x9aa5b4 });
      contentMats.push(edgeMat);
      const partMat = { soc: socMat, "mini-hdmi": steelMat, "usb-otg": steelMat, "usb-pwr": steelMat, microsd: sdMat, csi: csiMat };
      const estimated = new Set(["soc", "microsd", "mini-hdmi", "usb-otg", "usb-pwr"]);
      function outline(mesh) {
        const edges = new EdgesGeometry(mesh.geometry, 20);
        const line = new LineSegments(edges, edgeMat);
        line.position.copy(mesh.position);
        line.rotation.copy(mesh.rotation);
        line.userData.built = true;
        contentGeoms.push(edges);
        boardGroup.add(line);
      }
      function tag(mesh, badge) {
        mesh.userData.badge = badge;
        tagged.push(mesh);
        if (badge === "est") outline(mesh);
      }
      const shape = roundedBoard(W, H, liveBoard.outline.corner_radius_mm.value || 3);
    for (const hole of liveBoard.holes || []) {
      const fy = H - hole.y;
      const p = toBoard(hole.x, fy, W, H);
      addHole(shape, p.x, p.y, hole.d / 2);
    }
    const drill = (liveBoard.header.drillD || 1) / 2;
    for (const pin of liveBoard.header.pins) {
      const p = toBoard(pin.x, H - pin.y, W, H);
      addHole(shape, p.x, p.y, drill);
    }
    const pcbGeom = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 4 });
    const pcb = track(pcbGeom, pcbMat);
    pcb.userData.built = true;
    tag(pcb, "est");
    boardGroup.add(pcb);

    for (const part of liveBoard.draw || []) {
      const record = heights.parts[part.kind];
      const height = record?.value_mm || 1;
      const flux = partFlux(part, H);
      const center = toBoard(flux.x + flux.w / 2, flux.y + flux.h / 2, W, H);
      const mesh = track(new BoxGeometry(flux.w, flux.h, height), partMat[part.kind] || steelMat);
      mesh.position.set(center.x, center.y, thickness + height / 2);
      mesh.userData.built = true;
      if (estimated.has(part.kind)) tag(mesh, "est");
      boardGroup.add(mesh);
    }

    const pinRadius = liveHeader === "hammer" ? 0.22 : 0.32;
    let pinLen = 0;
    let pinCenter = thickness;
    if (liveHeader === "solder") {
      const body = partFlux(liveBoard.header, H);
      const center = toBoard(body.x + body.w / 2, body.y + body.h / 2, W, H);
      const bodyH = heights.header_body_mm.value_mm;
      const above = heights.header_pin_above_body_mm.value_mm;
      const below = heights.header_pin_below_board_mm.value_mm;
      const shroud = track(new BoxGeometry(body.w, body.h, bodyH), headerMat);
      shroud.position.set(center.x, center.y, thickness + bodyH / 2);
      shroud.userData.built = true;
      boardGroup.add(shroud);
      pinLen = above + bodyH + below;
      pinCenter = thickness - below + pinLen / 2;
    } else if (liveHeader === "hammer") {
      pinLen = heights.hammer_header_mm.value_mm;
      pinCenter = thickness + pinLen / 2;
    }
    if (liveHeader === "bare") {
      const padGeom = new CylinderGeometry(0.55, 0.55, 0.16, 8);
      padGeom.rotateX(Math.PI / 2);
      contentGeoms.push(padGeom);
      for (const pin of liveBoard.header.pins) {
        const p = toBoard(pin.x, H - pin.y, W, H);
        const material = pinMat.clone();
        contentMats.push(material);
        const mesh = new Mesh(padGeom, material);
        mesh.position.set(p.x, p.y, thickness + 0.08);
        mesh.userData.physical = pin.physical;
        mesh.userData.built = true;
        pickables.push(mesh);
        boardGroup.add(mesh);
      }
      const backGeom = new CylinderGeometry(0.55, 0.55, 0.12, 8);
      backGeom.rotateX(Math.PI / 2);
      contentGeoms.push(backGeom);
      for (const pin of liveBoard.header.pins) {
        const p = toBoard(pin.x, H - pin.y, W, H);
        const material = pinMat.clone();
        contentMats.push(material);
        const back = new Mesh(backGeom, material);
        back.position.set(p.x, p.y, -0.06);
        back.userData.physical = pin.physical;
        back.userData.built = true;
        pickables.push(back);
        boardGroup.add(back);
      }
    } else {
      const pinGeom = new CylinderGeometry(pinRadius, pinRadius, pinLen, 6);
      pinGeom.rotateX(Math.PI / 2);
      contentGeoms.push(pinGeom);
      for (const pin of liveBoard.header.pins) {
        const p = toBoard(pin.x, H - pin.y, W, H);
        const material = pinMat.clone();
        contentMats.push(material);
        const mesh = new Mesh(pinGeom, material);
        mesh.position.set(p.x, p.y, pinCenter);
        mesh.userData.physical = pin.physical;
        mesh.userData.built = true;
        pickables.push(mesh);
        boardGroup.add(mesh);
      }
      if (liveHeader === "solder") {
        const cone = new ConeGeometry(0.85, 0.7, 7);
        cone.rotateX(-Math.PI / 2);
        contentGeoms.push(cone);
        for (const pin of liveBoard.header.pins) {
          const p = toBoard(pin.x, H - pin.y, W, H);
          const joint = new Mesh(cone, steelMat);
          joint.position.set(p.x, p.y, -0.35);
          joint.userData.built = true;
          boardGroup.add(joint);
        }
      } else if (liveHeader === "hammer") {
        const stubGeom = new CylinderGeometry(0.18, 0.18, 0.3, 6);
        stubGeom.rotateX(Math.PI / 2);
        contentGeoms.push(stubGeom);
        for (const pin of liveBoard.header.pins) {
          const p = toBoard(pin.x, H - pin.y, W, H);
          const material = pinMat.clone();
          contentMats.push(material);
          const stub = new Mesh(stubGeom, material);
          stub.position.set(p.x, p.y, -0.15);
          stub.userData.badge = "est";
          stub.userData.built = true;
          tagged.push(stub);
          boardGroup.add(stub);
        }
      }
    }

    const standoff = heights.phat_gap_mm.value_mm;
    const hatT = heights.phat_thickness_mm.value_mm;
    for (const mount of liveMounts || []) {
      const part = liveParts.find((item) => item.id === mount.partId);
      if (!part?.dims) continue;
      const w = part.dims.w_mm;
      const h = part.dims.h_mm;
      const fy = H - (mount.y_mm + h);
      const center = toBoard(mount.x_mm + w / 2, fy + h / 2, W, H);
      const mesh = track(new BoxGeometry(w, h, hatT), hatMat);
      mesh.position.set(center.x, center.y, thickness + standoff + hatT / 2);
      mesh.userData.built = true;
      tag(mesh, "gap");
      boardGroup.add(mesh);
    }
    const disc = new CylinderGeometry(0.55, 0.55, 0.08, 10);
    disc.rotateX(Math.PI / 2);
    contentGeoms.push(disc);
    for (const item of liveBoard.components || []) {
      const rows = [item, ...(item.subparts || [])];
      for (const row of rows) {
        if (row.x_mm == null || row.y_mm == null || row.side !== "bottom") continue;
        const p = toBoard(row.x_mm, row.y_mm, W, H);
        const material = pinMat.clone();
        contentMats.push(material);
        const pad = new Mesh(disc, material);
        pad.position.set(p.x, p.y, -0.04);
        pad.userData.partId = row.id;
        pad.userData.built = true;
        tagged.push(pad);
        boardGroup.add(pad);
      }
    }
      paint();
      api.current.refit?.();
    }

    function paint() {
      const current = selectedRef.current?.kind === "pin" ? selectedRef.current.physical : null;
      for (const mesh of pickables) {
        const on = mesh.userData.physical === current;
        const hot = mesh.userData.physical === hoverPhysical;
        mesh.material.emissive.set(on || hot ? signal : 0x000000);
        mesh.material.emissiveIntensity = on ? 0.7 : hot ? 0.35 : 0;
      }
      requestRender();
    }

    function pick(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new Raycaster();
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects([...pickables, ...tagged], false)[0] || null;
    }

    let start = null;
    const onDown = (event) => {
      if (event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    };
    const onUp = (event) => {
      if (!start || event.pointerId !== start.id) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      start = null;
      if (moved > 4) return;
      const hit = pick(event);
      if (hit?.object.userData.physical) onSelectRef.current({ kind: "pin", physical: hit.object.userData.physical });
      else if (hit?.object.userData.partId) onSelectRef.current({ kind: "component", id: hit.object.userData.partId });
      showBadge(hit?.object);
    };
    const onMove = (event) => {
      if (event.buttons) return;
      const hit = pick(event);
      const next = hit?.object.userData.physical ?? null;
      if (next !== hoverPhysical) {
        hoverPhysical = next;
        canvas.style.cursor = next ? "pointer" : "grab";
        paint();
      }
      showBadge(hit?.object);
    };
    function showBadge(object) {
      const kind = object?.userData.badge;
      const text = kind === "gap" ? labelsRef.current.gapBadge : kind === "est" ? labelsRef.current.estHeight : "";
      setChip(text);
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointermove", onMove);

    function fit(dir, up) {
      viewDir.copy(dir).normalize();
      viewUp.copy(up);
      const box = new Box3();
      let any = false;
      scene.traverse((obj) => {
        if (obj.isMesh && obj.userData.built) {
          box.expandByObject(obj);
          any = true;
        }
      });
      boardGroup.updateMatrixWorld(true);
      if (!any || !camera.aspect) return;
      const center = box.getCenter(new Vector3());
      const size = box.getSize(new Vector3());
      const z = viewDir.clone();
      const xAxis = new Vector3().crossVectors(viewUp, z);
      if (xAxis.lengthSq() < 1e-8) xAxis.set(1, 0, 0);
      xAxis.normalize();
      const yAxis = new Vector3().crossVectors(z, xAxis).normalize();
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
      const tanV = Math.tan(vFov / 2) * 0.92;
      const tanH = Math.tan(hFov / 2) * 0.92;
      let dist = 8;
      for (const sx of [0, 1]) {
        for (const sy of [0, 1]) {
          for (const sz of [0, 1]) {
            const rel = new Vector3(box.min.x + size.x * sx, box.min.y + size.y * sy, box.min.z + size.z * sz).sub(center);
            const cx = rel.dot(xAxis);
            const cy = rel.dot(yAxis);
            const cz = rel.dot(z);
            dist = Math.max(dist, cz + Math.abs(cx) / tanH, cz + Math.abs(cy) / tanV);
          }
        }
      }
      camera.position.copy(center).addScaledVector(z, dist);
      controls.target.copy(center);
      controls.maxDistance = Math.max(dist * 4, 80);
      controls.update();
      const below = camera.position.y < controls.target.y - 0.5;
      const placed = (propsRef.current.board.components || []).some((item) => {
        const rows = [item, ...(item.subparts || [])];
        return rows.some((row) => row.x_mm != null && row.y_mm != null && row.side === "bottom");
      });
      setShowBackNote(below && !placed);
      requestRender();
    }
    const upY = new Vector3(0, 1, 0);
    api.current = {
      reset: () => fit(new Vector3(0.72, 0.62, 0.55), upY),
      top: () => fit(new Vector3(0, 1, 0.001), new Vector3(0, 0, -1)),
      bottom: () => fit(new Vector3(0, -1, 0.001), new Vector3(0, 0, -1)),
      front: () => fit(new Vector3(0, 0.28, 1), upY),
      side: () => fit(new Vector3(1, 0.28, 0), upY),
      paint,
      rebuild,
      refit: () => fit(viewDir, viewUp),
    };
    rebuild();

    function resize() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      api.current.refit?.();
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement || canvas);
    resize();

    function applyTheme() {
      renderer.setClearColor(new Color(token("--bench", "#0b0e13")));
      signal.set(token("--signal", "#62c6ff"));
      paint();
    }
    applyTheme();
    const themeWatch = new MutationObserver(applyTheme);
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const onControl = () => {
      const below = camera.position.y < controls.target.y - 0.5;
      const placed = (propsRef.current.board.components || []).some((item) => {
        const rows = [item, ...(item.subparts || [])];
        return rows.some((row) => row.x_mm != null && row.y_mm != null && row.side === "bottom");
      });
      setShowBackNote(below && !placed);
      requestRender();
    };
    controls.addEventListener("change", onControl);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      themeWatch.disconnect();
      observer.disconnect();
      controls.removeEventListener("change", onControl);
      controls.dispose();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      for (const geometry of contentGeoms) geometry.dispose();
      for (const material of contentMats) material.dispose();
      renderer.dispose();
      api.current = {};
    };
  }, []);

  useEffect(() => {
    api.current.rebuild?.();
  }, [board, header, mounts, parts]);

  useEffect(() => {
    api.current.paint?.();
  }, [selected]);

  return (
    <div className="map-wrap board-3d">
      <canvas ref={canvasRef} aria-label={labels.view3dLabel} />
      <div className="map-tools">
        {viewToggle}
        {onOpenLayers && <button type="button" className="layers-toggle" onClick={onOpenLayers}>{labels.layers}</button>}
      </div>
      <div className="cam-dock">
        <button type="button" onClick={() => api.current.reset?.()}>{labels.resetView}</button>
        <button type="button" onClick={() => api.current.top?.()}>{labels.top}</button>
        <button type="button" onClick={() => api.current.bottom?.()}>{labels.bottom}</button>
        <button type="button" onClick={() => api.current.front?.()}>{labels.front}</button>
        <button type="button" onClick={() => api.current.side?.()}>{labels.side}</button>
      </div>
      <label className="pin-jump">
        {labels.pinList}
        <select
          aria-label={labels.pinList}
          value={selected?.kind === "pin" ? String(selected.physical) : ""}
          onChange={(event) => {
            if (!event.target.value) return;
            onSelect({ kind: "pin", physical: Number(event.target.value) });
          }}
        >
          <option value="">—</option>
          {pinout.pins.map((pin) => (
            <option key={pin.physical} value={pin.physical}>{pin.physical} {pin.name}</option>
          ))}
        </select>
      </label>
      {chip && <p className="height-badge">{chip}</p>}
      <p className="estimate-note">{labels.heightLegend}</p>
      {showBackNote && <p className="back-note">{labels.testPadsMissing}</p>}
    </div>
  );
}
