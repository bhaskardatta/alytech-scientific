/**
 * GasMix Aiolos III — procedural stand-in model + scroll choreography.
 * ponytail: geometry is a faithful-proportion schematic; swap `buildInstrument()` for the CAD GLB from
 * AlyTech France when it arrives (keep the same part groups so explode/callouts keep working).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const W = 0.44; // front face width (x)
const D = 1.0; // side depth (z)
const H = 1.62; // height (y)
const SEAM = 0.7; // module split height

const PURPLE = 0x5a2bb0;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = THREE.MathUtils.lerp;
// Hand the main thread back between build steps so no single task grows into a long one (scheduler.yield where it exists).
const yieldMain = (): Promise<void> => ((globalThis as any).scheduler?.yield?.() ?? new Promise<void>((r) => setTimeout(r)));

export interface Callout { id: string; anchor: THREE.Object3D }
export interface HeroLayout { offsetX: number; offsetY: number; mobile: boolean; compact?: boolean; /** camera distance multiplier that fits the model in the free band above the copy */ fit?: number }
export interface HeroOptions {
  /** phone-width screens: fewer segments, smaller env map, 1.5 DPR cap. Desktop geometry is untouched. */
  mobile: boolean;
  reducedMotion: boolean;
  /** resolved font stacks for canvas textures (Astro's fonts are hashed, so plain family names no longer resolve) */
  fonts: { display: string; mono: string };
  /** called once if WebGL or the render loop fails after boot; the page swaps in the static image */
  onFail?: (e: unknown) => void;
}
export interface HeroScene {
  setProgress(p: number): void;
  setLayout(layout: HeroLayout): void;
  resize(): void;
  callouts: Callout[];
  project(o: THREE.Object3D): { x: number; y: number; visible: boolean };
  explodeAmount(): number;
  start(): void;
  stop(): void;
  onFrame(cb: () => void): void;
  dispose(): void;
}

// ---------- textures ----------
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const screenTexture = (mono: string) =>
  canvasTex(384, 480, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 480);
    g.addColorStop(0, '#120c24'); g.addColorStop(1, '#07050e');
    c.fillStyle = g; c.fillRect(0, 0, 384, 480);
    c.fillStyle = '#b9a3ff'; c.font = `600 22px ${mono}`;
    c.fillText('AIOLOS III', 24, 44);
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.font = `500 15px ${mono}`;
    c.fillText('MIX · RUNNING', 24, 70);
    const rows: [string, number][] = [['CH1  N2', 0.82], ['CH2  CH4', 0.12], ['CH3  CO2', 0.05], ['CH4  H2S', 0.01]];
    rows.forEach(([label, v], i) => {
      const y = 120 + i * 78;
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.font = `500 17px ${mono}`;
      c.fillText(label, 24, y);
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(24, y + 14, 336, 10);
      c.fillStyle = i === 0 ? '#8f6cf5' : '#c9b8ff'; c.fillRect(24, y + 14, 336 * Math.max(v, 0.03), 10);
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.textAlign = 'right';
      c.fillText(`${(v * 100).toFixed(2)} %`, 360, y);
      c.textAlign = 'left';
    });
    c.strokeStyle = 'rgba(185,163,255,0.5)'; c.lineWidth = 2;
    c.strokeRect(24, 430, 336, 30);
    c.fillStyle = '#e9e3ff'; c.font = `600 15px ${mono}`;
    c.fillText('OUTPUT  STABLE', 112, 451);
  });

const wordmarkTexture = (display: string) =>
  canvasTex(512, 160, (c) => {
    c.fillStyle = '#5a2bb0';
    c.textAlign = 'center';
    c.font = `600 64px ${display}`;
    c.fillText('GASMIX', 256, 70);
    c.font = `500 46px ${display}`;
    c.fillText('AIOLOS III', 256, 136);
  });

const scanTexture = () =>
  canvasTex(512, 512, (c) => {
    c.clearRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(160,120,255,0.35)'; c.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke();
    }
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(120,70,255,0)'); g.addColorStop(0.5, 'rgba(120,70,255,0.18)'); g.addColorStop(1, 'rgba(120,70,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    c.strokeStyle = 'rgba(200,180,255,0.9)'; c.lineWidth = 6; c.strokeRect(3, 3, 506, 506);
  });

const shadowTexture = (size: number) =>
  canvasTex(size, size, (c) => {
    const h = size / 2;
    const g = c.createRadialGradient(h, h, 0, h, h, h);
    g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.55, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, size, size);
  });

// ---------- the GasMix string-art ribbon ----------
function ribbon(lines: number, lite: boolean) {
  const positions: number[] = [];
  const colors: number[] = [];
  const a = new THREE.Color(0x8a55e8);
  const b = new THREE.Color(0xc4c1cf);
  const steps = lite ? 60 : 90;
  const bands = [
    { c: -0.12, amp: 0.2, k: 1.15, ph: 0.4 },
    { c: 0.1, amp: 0.17, k: 1.6, ph: 2.1 },
  ];
  const n = lite ? Math.round(lines * 0.6) : lines;
  const col = new THREE.Color();
  for (const band of bands) {
    for (let j = 0; j < n; j++) {
      const s = (j / (n - 1)) * 2 - 1;
      col.copy(a).lerp(b, Math.abs(s) * 0.85);
      for (let i = 0; i < steps; i++) {
        for (const ii of [i, i + 1]) {
          const t = ii / steps;
          const y = 0.06 + t * (H - 0.12);
          const z = band.c + s * band.amp * Math.sin(band.k * Math.PI * t * 2 + band.ph) + 0.02 * Math.sin(6 * t + j * 0.05);
          positions.push(-W / 2 - 0.0015, y, z);
          colors.push(col.r, col.g, col.b);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// ---------- model ----------
/**
 * Builds the visible shell synchronously (all that the first frame needs) and returns `buildInternals`, which creates the
 * exploded-view parts in small slices *after* the first frame: they sit behind the shell until the scroll reaches the x-ray cut.
 */
function buildInstrument(lite: boolean, clip: THREE.Plane, fonts: HeroOptions['fonts']) {
  const seg = (hi: number, lo: number) => (lite ? lo : hi);
  const root = new THREE.Group();
  const clipPlanes = [clip];

  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f3f8, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, clippingPlanes: clipPlanes });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x241b3f, roughness: 0.8, side: THREE.BackSide, clippingPlanes: clipPlanes });
  const purpleMat = new THREE.MeshPhysicalMaterial({ color: PURPLE, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, clippingPlanes: clipPlanes });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd6, metalness: 1, roughness: 0.28 });
  const anod = new THREE.MeshStandardMaterial({ color: 0x23202e, metalness: 0.4, roughness: 0.45 });
  const pcb = new THREE.MeshStandardMaterial({ color: 0x151a35, roughness: 0.6 });
  const chip = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.35, metalness: 0.2 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xb9a3ff });
  const accent = new THREE.MeshStandardMaterial({ color: 0x7b3fe4, emissive: 0x3d1690, emissiveIntensity: 0.6, roughness: 0.4 });

  // Shell: two stacked modules with a purple seam + top trim.
  const shell = new THREE.Group();
  const lowerGeo = new RoundedBoxGeometry(W, SEAM - 0.004, D, seg(6, 3), 0.045);
  const upperGeo = new RoundedBoxGeometry(W, H - SEAM - 0.004, D, seg(6, 3), 0.045);
  for (const [geo, y] of [[lowerGeo, SEAM / 2], [upperGeo, SEAM + (H - SEAM) / 2]] as const) {
    const outer = new THREE.Mesh(geo, shellMat); outer.position.y = y;
    const inner = new THREE.Mesh(geo, innerMat); inner.position.y = y; inner.scale.setScalar(0.995);
    shell.add(outer, inner);
  }
  const seam = new THREE.Mesh(new RoundedBoxGeometry(W - 0.01, 0.012, D - 0.01, 2, 0.004), purpleMat);
  seam.position.y = SEAM;
  const trim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.004, 0.012, D + 0.004, 2, 0.006), purpleMat);
  trim.position.y = H - 0.004;
  shell.add(seam, trim);

  const ribbonLines = new THREE.LineSegments(
    ribbon(30, lite),
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, clippingPlanes: clipPlanes }),
  );
  shell.add(ribbonLines);

  // Front column (+z face)
  const front = new THREE.Group();
  const colW = 0.16;
  const column = new THREE.Mesh(new RoundedBoxGeometry(colW, 1.02, 0.02, seg(4, 2), 0.008), purpleMat);
  column.position.set(0.07, 0.86, D / 2 + 0.006);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(colW - 0.02, 0.19, 0.012, seg(3, 2), 0.008), new THREE.MeshPhysicalMaterial({ color: 0x0c0a14, roughness: 0.15, clearcoat: 1 }));
  bezel.position.set(0.07, 1.25, D / 2 + 0.018);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(colW - 0.04, 0.17), new THREE.MeshBasicMaterial({ map: screenTexture(fonts.mono), toneMapped: false }));
  screen.position.set(0.07, 1.25, D / 2 + 0.025);
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.081), new THREE.MeshBasicMaterial({ map: wordmarkTexture(fonts.display), transparent: true, clippingPlanes: clipPlanes }));
  mark.position.set(0.0, 1.47, D / 2 + 0.0015);
  front.add(column, bezel, screen, mark);
  const ports: THREE.Object3D[] = [];
  for (const y of [1.02, 0.42]) {
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.022, 6), steel);
    nut.rotation.x = Math.PI / 2; nut.position.set(0.07, y, D / 2 + 0.03);
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, seg(16, 10)), steel);
    stub.rotation.x = Math.PI / 2; stub.position.set(0.07, y, D / 2 + 0.05);
    front.add(nut, stub); ports.push(nut);
  }
  const logoTex = new THREE.TextureLoader().load('/brand/logo-light-192.png');
  logoTex.colorSpace = THREE.SRGBColorSpace;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.077), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true }));
  logo.position.set(0.07, 0.72, D / 2 + 0.0175);
  front.add(logo);
  shell.add(front);
  root.add(shell);

  // ---------- internals (each part group explodes along its own vector) ----------
  // The arrays are filled later by buildInternals; the render loop just iterates whatever exists.
  const parts: { obj: THREE.Object3D; dir: THREE.Vector3; delay: number; base: THREE.Vector3 }[] = [];
  const callouts: Callout[] = [];
  const tubeMat = new THREE.MeshStandardMaterial({ color: 0xd4d6de, metalness: 1, roughness: 0.25, transparent: true });
  const tubes = new THREE.Group();
  root.add(tubes);

  /** `prepare` compiles the new materials off the main thread before the parts are shown (no first-frame stall). */
  async function buildInternals(prepare: (obj: THREE.Object3D) => Promise<unknown>) {
    const pending: THREE.Object3D[] = []; // built, not in the scene yet
    const addPart = (obj: THREE.Object3D, dir: [number, number, number], delay = 0) => {
      parts.push({ obj, dir: new THREE.Vector3(...dir), delay, base: obj.position.clone() });
      pending.push(obj);
    };

    const manifold = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.05, 0.84, seg(3, 2), 0.01), steel);
    manifold.position.set(0, 0.8, -0.03);
    addPart(manifold, [-0.32, -0.05, 0], 0.05);

    const mfcZ = [-0.34, -0.13, 0.08, 0.29];
    const mfcs = new THREE.Group();
    mfcZ.forEach((z, i) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.045, 0.15, 2, 0.006), steel); base.position.y = 0.0225;
      const cover = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.22, 0.13, seg(3, 2), 0.01), anod); cover.position.y = 0.155;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.028, 0.11), accent); stripe.position.set(-0.044, 0.2, 0);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, seg(12, 8), seg(8, 6)), glow); led.position.set(-0.044, 0.24, 0.045);
      const conn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, seg(20, 12)), steel); conn.position.y = 0.28;
      g.add(base, cover, stripe, led, conn);
      g.position.set(-0.01, 0.825, z);
      mfcs.add(g);
      parts.push({ obj: g, dir: new THREE.Vector3(-0.62, 0.05 * (i - 1.5), 0.07 * (i - 1.5)), delay: 0.12 + i * 0.05, base: g.position.clone() });
    });
    pending.push(mfcs);
    await yieldMain();

    const valves = new THREE.Group();
    const vblock = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.055, 0.62, seg(3, 2), 0.008), steel); vblock.position.set(0, 0, 0);
    valves.add(vblock);
    [-0.24, -0.08, 0.08, 0.24].forEach((z) => {
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.075, seg(24, 14)), anod); coil.position.set(0, 0.065, z);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0295, 0.0295, 0.012, seg(24, 14)), accent); ring.position.set(0, 0.075, z);
      valves.add(coil, ring);
    });
    valves.position.set(0, 1.28, -0.12);
    addPart(valves, [-0.42, 0.2, 0], 0.22);

    const mixer = new THREE.Group();
    const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16, seg(28, 16)), steel);
    const caps = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, seg(28, 16)), anod);
    caps.position.y = 0.09;
    mixer.add(chamber, caps);
    mixer.position.set(0, 1.04, 0.4);
    addPart(mixer, [-0.4, 0.04, 0.16], 0.3);

    const psu = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.13, 0.3, seg(3, 2), 0.01), new THREE.MeshStandardMaterial({ color: 0x8d90a0, metalness: 0.8, roughness: 0.45 }));
    psu.position.set(-0.02, 0.15, -0.24);
    addPart(psu, [-0.48, -0.06, -0.04], 0.18);
    await yieldMain();

    const board = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.36, 0.56), pcb);
    board.add(plate);
    [[0.08, -0.12, 0.05], [0.1, 0.06, 0.04], [-0.06, 0.14, 0.03], [-0.1, -0.05, 0.035], [0.0, 0.0, 0.07]].forEach(([y, z, s], i) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.008, s, s), i === 4 ? accent : chip);
      c.position.set(-0.009, y, z);
      board.add(c);
    });
    board.position.set(0.15, 0.42, 0.06);
    addPart(board, [-0.6, 0.02, 0.1], 0.26);

    // Tubing: MFC -> valve block, valve block -> mixer -> outlet port. Fades out while exploded.
    const tubeMeshes: THREE.Mesh[] = [];
    const tube = (pts: [number, number, number][]) =>
      tubeMeshes.push(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg(40, 24), 0.0065, seg(10, 6)), tubeMat));
    mfcZ.forEach((z, i) => tube([[-0.01, 1.12, z], [-0.01, 1.2, z], [0, 1.25, [-0.24, -0.08, 0.08, 0.24][i]]]));
    tube([[0, 1.3, 0.2], [0, 1.3, 0.32], [0, 1.15, 0.4]]);
    tube([[0, 0.96, 0.4], [0.03, 0.98, 0.46], [0.07, 1.02, D / 2 + 0.02]]);
    await yieldMain();

    // Anchors for HTML callouts (children so they ride along with their part)
    const anchor = (parent: THREE.Object3D, p: [number, number, number]) => { const o = new THREE.Object3D(); o.position.set(...p); parent.add(o); return o; };
    const anchors: Callout[] = [
      { id: 'mfc', anchor: anchor(mfcs.children[1], [-0.05, 0.2, 0]) },
      { id: 'mixer', anchor: anchor(mixer, [-0.04, 0.05, 0]) },
      { id: 'board', anchor: anchor(board, [-0.02, 0.15, -0.2]) },
    ];

    // Compile everything off-thread (KHR_parallel_shader_compile), then reveal in one go.
    const group = new THREE.Group();
    group.visible = false;
    group.add(...pending, ...tubeMeshes);
    await prepare(group);
    root.add(...pending); // re-parents out of `group`
    tubes.add(...tubeMeshes);
    callouts.push(...anchors);
  }

  return { root, shell, ribbonLines, parts, tubes, tubeMat, callouts, ports, buildInternals };
}

// ---------- scene ----------
export async function createHeroScene(canvas: HTMLCanvasElement, opts: HeroOptions): Promise<HeroScene> {
  const lite = opts.mobile;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: lite ? 'default' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 4, 3);
  const rim = new THREE.PointLight(0x8a5cff, 9, 8, 1.6); rim.position.set(1.6, 1.4, -1.6);
  const fill = new THREE.PointLight(0x6a4bd6, 3, 6, 2); fill.position.set(-2, -0.5, 1);
  scene.add(key, rim, fill);
  await yieldMain();

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: lite ? 128 : 256 }).texture;
  scene.environmentIntensity = 0.55;
  await yieldMain();

  const clip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 10);
  const model = buildInstrument(lite, clip, opts.fonts);
  const rig = new THREE.Group();
  rig.add(model.root);
  model.root.position.y = -H / 2;
  scene.add(rig);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: shadowTexture(lite ? 128 : 256), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -H / 2 - 0.002;
  scene.add(shadow);

  // Floor grid — the "stage"
  const grid = new THREE.GridHelper(8, 32, 0x3a2d66, 0x1f1838);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  grid.position.y = -H / 2 - 0.004;
  scene.add(grid);

  // Scanning plane (local to the instrument so it follows its rotation)
  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(D * 1.12, H * 1.08),
    new THREE.MeshBasicMaterial({ map: scanTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  scan.rotation.y = Math.PI / 2;
  scan.position.y = H / 2;
  model.root.add(scan);
  await yieldMain();

  let progress = 0;
  let goal = 0;
  let layout: HeroLayout = { offsetX: 0, offsetY: 0, mobile: opts.mobile };
  let explode = 0;
  let raf = 0;
  let running = false;
  let failed = false;
  const frameCbs: (() => void)[] = [];
  const clock = new THREE.Clock();
  const localPlane = new THREE.Plane();
  const camPos = new THREE.Vector3();
  const target = new THREE.Vector3();

  // Camera keyframes (spherical around the instrument): [progress, azimuth°, elevation, distance]
  const keys: [number, number, number, number][] = [
    [0.0, -38, 0.22, 6.0],
    [0.16, -62, 0.16, 5.5],
    [0.42, -58, 0.14, 5.3],
    [0.7, -48, 0.18, 5.6],
    [0.86, -36, 0.22, 6.1],
    [1.0, -30, 0.28, 7.4],
  ];
  const camAt = (p: number) => {
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
    const [p0, a0, e0, d0] = keys[i];
    const [p1, a1, e1, d1] = keys[i + 1];
    const t = ease(clamp01((p - p0) / (p1 - p0)));
    return [lerp(a0, a1, t), lerp(e0, e1, t), lerp(d0, d1, t)] as const;
  };

  function update() {
    const p = progress;
    const time = opts.reducedMotion ? 0 : clock.getElapsedTime();
    const [az, el, dist] = camAt(p);
    const mobileDist = layout.fit ?? (layout.compact ? 1.95 : layout.mobile ? 1.62 : 1);
    const azR = THREE.MathUtils.degToRad(az + (opts.reducedMotion ? 0 : Math.sin(time * 0.25) * 2.2));
    camPos.set(Math.sin(azR) * dist * mobileDist, el * dist + 0.35, Math.cos(azR) * dist * mobileDist);
    camera.position.copy(camPos);
    target.set(0, 0.04, 0);
    camera.lookAt(target);

    // X-ray cut: sweeps across the camera-facing (-x) half, then retracts
    const cutIn = ease(range(p, 0.16, 0.36));
    const cutOut = ease(range(p, 0.72, 0.84));
    const cut = cutIn * (1 - cutOut);
    const xc = lerp(-W / 2 - 0.06, -0.1, cut);
    localPlane.set(new THREE.Vector3(1, 0, 0), -xc);
    model.root.updateMatrixWorld();
    clip.copy(localPlane).applyMatrix4(model.root.matrixWorld);
    scan.position.x = xc;
    (scan.material as THREE.MeshBasicMaterial).opacity = (range(p, 0.14, 0.2) * (1 - range(p, 0.36, 0.42)) + range(p, 0.7, 0.74) * (1 - range(p, 0.82, 0.86))) * 0.9;

    // Exploded view
    explode = ease(range(p, 0.4, 0.58)) * (1 - ease(range(p, 0.64, 0.76)));
    for (const part of model.parts) {
      const e = ease(clamp01((explode - part.delay * 0.6) / (1 - part.delay * 0.6)));
      part.obj.position.copy(part.base).addScaledVector(part.dir, e);
    }
    model.tubeMat.opacity = 1 - clamp01(explode * 3);
    model.tubes.visible = model.tubes.children.length > 0 && model.tubeMat.opacity > 0.01;

    // Idle float + slow turn at the very start
    rig.position.y = opts.reducedMotion ? 0 : Math.sin(time * 0.8) * 0.012;
    rig.rotation.y = opts.reducedMotion ? 0 : Math.sin(time * 0.2) * 0.04 * (1 - range(p, 0.1, 0.2));

    renderer.render(scene, camera);
    for (const cb of frameCbs) cb();
  }

  // Any runtime failure (GL error, lost context, bad driver) hands the page back to the static image.
  const fail = (e: unknown) => {
    if (failed) return;
    failed = true;
    running = false;
    cancelAnimationFrame(raf);
    opts.onFail?.(e);
  };
  const safeUpdate = () => { if (failed) return; try { update(); } catch (e) { fail(e); } };

  const loop = () => {
    // Ease toward the scroll position so wheel steps feel continuous
    progress += (goal - progress) * 0.14;
    if (Math.abs(goal - progress) < 0.0005) progress = goal;
    safeUpdate();
    if (!failed) raf = requestAnimationFrame(loop);
  };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Shift the projection so the instrument sits beside the copy instead of under it
    camera.setViewOffset(w, h, -layout.offsetX * w, layout.offsetY * h, w, h);
    camera.updateProjectionMatrix();
    if (!running) safeUpdate();
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(new Error('webglcontextlost')); });

  // Compile the visible materials without blocking (parallel shader compile), then build the internals in slices.
  await renderer.compileAsync(scene, camera);
  setTimeout(() => {
    if (failed) return;
    model.buildInternals((obj) => renderer.compileAsync(obj, camera, scene)).catch(fail);
  }, 0);

  const v = new THREE.Vector3();
  return {
    callouts: model.callouts,
    setProgress(p) { goal = clamp01(p); if (!running) { progress = goal; safeUpdate(); } },
    setLayout(l) { layout = l; resize(); },
    resize,
    explodeAmount: () => explode,
    project(o) {
      o.getWorldPosition(v);
      v.project(camera);
      return { x: (v.x * 0.5 + 0.5) * canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * canvas.clientHeight, visible: v.z < 1 };
    },
    start() { if (running || failed || opts.reducedMotion) return; running = true; clock.start(); loop(); },
    stop() { running = false; cancelAnimationFrame(raf); },
    onFrame(cb) { frameCbs.push(cb); },
    dispose() {
      failed = true;
      cancelAnimationFrame(raf);
      renderer.dispose();
      pmrem.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (Array.isArray(m.material) ? m.material : m.material ? [m.material] : []).forEach((mat) => mat.dispose());
      });
    },
  };
}
