(async () => {
const $ = s => document.querySelector(s);
if (!window.THREE) { $('#load').textContent = 'Could not load the 3D library. Check your connection and reload.'; return; }
const T = THREE;
let DATA;
try { DATA = await (await fetch('data.json?v=openings1')).json(); } catch (e) { $('#load').textContent = 'Could not load the plan data. Reload to try again.'; return; }

/* ================= constants ================= */
const L1 = 9.1, FH = 3.35, CH = 3.0, STILT = 0.6, TOP = 196.7, EYE = 1.62, DOORH = 2.4;
const lvl = n => L1 + (n - 1) * FH;
const TW = { A: { name: 'Aura', c: [52.96, 113.54] }, B: { name: 'Bella', c: [122.87, 99.95] }, C: { name: 'Clara', c: [193.55, 70.49] } };
const META = {
 'A-TYP-1': [4000, 'West', 1], 'A-TYP-2': [4000, 'East', 2], 'A-TYP-3': [4055, 'West', 3], 'A-TYP-4': [4000, 'East', 4],
 'B-TYP-1': [3375, 'West', 1], 'B-TYP-2': [3830, 'East', 2], 'B-TYP-3': [3140, 'West', 3], 'B-TYP-4': [3140, 'East', 4], 'B-TYP-5': [3830, 'West', 5], 'B-TYP-6': [3315, 'East', 6],
 'C-TYP-1': [5350, 'West', 1], 'C-TYP-2': [5350, 'East', 2], 'C-TYP-3': [4970, 'West', 3], 'C-TYP-4': [5000, 'East', 4]
};
// where the model opens when the link names no flat (a link like #B-2904/tour opens that flat)
const START = { t: 'B', f: 20 };
const TID = { A: 'A', B: 'B', C: 'C', AURA: 'A', BELLA: 'B', CLARA: 'C' };
// "B-2904", "bella 2904", "2904 B", "b2904" -> { t, n, no } (floor = number / 100, flat on the floor = number % 100)
function parseFlat(q) {
 q = String(q || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim(); const m = q.match(/(AURA|BELLA|CLARA|[ABC])?\s*(\d{3,4})\s*(AURA|BELLA|CLARA|[ABC])?/); if (!m) return null;
 const t = TID[m[1] || m[3] || ''] || null, num = +m[2], n = Math.floor(num / 100), no = num % 100; if (n < 1 || n > 56 || !no) return null; return { t, n, no };
}
const SITE_POLY = [[9.5, 64.8], [242.6, 14.2], [242.6, 151.8], [6.1, 152.4]];
const SITE_C = [124, 0, 86];
const AMEN = [["Futsal / volleyball", 135.6, 48.9, 25.0, 18.5, '#3f8f5a'], ["Basketball", 76.1, 81.4, 21.0, 25.1, '#c46b3a'], ["Pickleball", 193.4, 30.2, 13.1, 7.9, '#2f6f9f'], ["Tennis", 217.7, 30.6, 27.6, 15.9, '#2b7a8c'], ["Skating rink", 149.8, 118.5, 9.2, 22.5, '#8b8f96'], ["Gathering lawn", 176.8, 115.5, 26.3, 29.1, '#5f9a4c'], ["Kids' play", 169.1, 141.9, 21.0, 14.5, '#d98c3f'], ["Water feature", 203.6, 106.4, 7.9, 7.9, '#4f9fc8'], ["Cricket nets", 238.4, 68.5, 4.7, 31.7, '#b49a6a'], ["Pet park", 151.5, 145.6, 10.5, 7.9, '#6aa35a']];
const CLUB = [216.41, 127.0, 31.5, 30.0, 30.0];

/* ================= prepare plan data (shift every variant onto its tower's typical grid) ================= */
const sh2 = (a, s) => a.map((v, i) => +(v + s[i % 2]).toFixed(3));
for (const t of 'ABC') {
 const vs = DATA[t];
 for (const v of vs) {
  const s = v.shift;
  v.plate = v.plate.map(p => sh2(p, s)); v.outline = v.outline.map(q => sh2(q, s)); v.gl = v.gl.map(q => sh2(q, s));
  for (const k of ['doors', 'winq', 'balc', 'lift', 'stair', 'lobby', 'meter', 'passage', 'void']) v[k] = v[k].map(q => sh2(q, s));
  v.rooms.forEach(r => { r.r = sh2(r.r, s); if (r.p) r.p = r.p.map(p => sh2(p, s)); });
  v.tags.forEach(g => { g.x += s[0]; g.y += s[1]; }); v.free.forEach(g => { g.x += s[0]; g.y += s[1]; });
 }
 const typ = vs.reduce((a, b) => b.floors.length > a.floors.length ? b : a);
 TW[t].typ = typ; TW[t].size = typ.size;
 TW[t].O = [TW[t].c[0] - typ.size[0] / 2, TW[t].c[1] - typ.size[1] / 2];
}
const variantFor = (t, n) => DATA[t].find(v => v.floors.includes(n)) || TW[t].typ;

/* ================= helpers ================= */
const polyArea = p => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
const rectPts = r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]];
const roomArea = r => r.p ? polyArea(r.p) : (r.r[2] - r.r[0]) * (r.r[3] - r.r[1]);
function pip(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi) c = !c; } return c; }
const inRoom = (r, x, y) => x >= r.r[0] - .02 && x <= r.r[2] + .02 && y >= r.r[1] - .02 && y <= r.r[3] + .02 && (!r.p || pip(r.p, x, y));
const inRect = (q, x, y, m = 0) => x >= q[0] - m && x <= q[2] + m && y >= q[1] - m && y <= q[3] + m;
const ftin = m => { const t = Math.round(m * 39.3701); return `${Math.floor(t / 12)}′${t % 12}″`; };
const fmt = n => n.toLocaleString('en-IN');
function rtype(n) {
 n = (n || '').toUpperCase();
 if (n.includes('BED')) return 'bed'; if (n.includes('TOILET') || n.includes('POWDER')) return 'toilet'; if (n.includes('DRESS')) return 'dress';
 if (n.includes('WET')) return 'wetk'; if (n.includes('KITCHEN')) return 'kitchen'; if (n.includes('UTILITY')) return 'utility';
 if (n.includes('LIVING') && n.includes('DINING')) return 'livdin'; if (n.includes('DINING')) return 'dining'; if (n.includes('LIVING') || n.includes('FAMILY') || n.includes('LOUNGE')) return 'living';
 if (n.includes('DRAWING')) return 'drawing'; if (n.includes('SERVANT') || n.includes('MAID')) return 'servant'; if (n.includes('WASH')) return 'wash';
 if (n.includes('POOJA')) return 'pooja'; if (n.includes('STORE')) return 'store'; if (n.includes('REFUGE')) return 'refuge'; return 'other';
}
const PRETTY = { toilet: 'Toilet', dress: 'Dress room', wetk: 'Wet kitchen', kitchen: 'Kitchen', utility: 'Utility', livdin: 'Living & dining', dining: 'Dining', living: 'Living', drawing: 'Drawing room', servant: 'Staff room', wash: 'Wash area', pooja: 'Pooja', store: 'Store', refuge: 'Refuge area' };

/* ================= renderer / scene ================= */
const cv = $('#c');
const ren = new T.WebGLRenderer({ canvas: cv, antialias: true });
ren.setPixelRatio(Math.min(devicePixelRatio, 2));
ren.outputEncoding = T.sRGBEncoding; ren.toneMapping = T.ACESFilmicToneMapping;
ren.shadowMap.enabled = true; ren.shadowMap.type = T.PCFSoftShadowMap; ren.localClippingEnabled = true;
const scene = new T.Scene();
const cam = new T.PerspectiveCamera(50, 1, 0.1, 16000); cam.rotation.order = 'YXZ';
scene.fog = new T.Fog(0xcfdde8, 1800, 9000);
const lin = h => new T.Color(h).convertSRGBToLinear();
const MC = {};
const mat = (c, o = {}) => { const k = c + JSON.stringify(o); return MC[k] || (MC[k] = new T.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: .85, metalness: 0 }, o))); };
const glassM = new T.MeshStandardMaterial({ color: lin('#a9cbe0'), transparent: true, opacity: .25, roughness: .05, metalness: .1, depthWrite: false });
const boxG = new T.BoxGeometry(1, 1, 1);

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function canvasTex(draw, size = 512) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size); const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.sRGBEncoding; t.anisotropy = 4; return t; }
const TEX = {
 marble: canvasTex((g, s) => { g.fillStyle = '#eeece7'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + rnd() * 60 | 0},${145 + rnd() * 55 | 0},${140 + rnd() * 50 | 0},.05)`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 4 + rnd() * 28, 0, 7); g.fill(); } g.lineCap = 'round'; for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(120,115,108,${.1 + rnd() * .22})`; g.lineWidth = .6 + rnd() * 1.8; g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (rnd() - .3) * 120; y += (rnd() - .5) * 90; g.quadraticCurveTo(x - 30, y + 20, x, y); } g.stroke(); } g.strokeStyle = 'rgba(160,154,145,.35)'; g.strokeRect(0, 0, s, s); }),
 tile: canvasTex((g, s) => { g.fillStyle = '#c9c6c0'; g.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `hsl(35,6%,${74 + rnd() * 5}%)`; g.fillRect(i * s / 4 + 2, j * s / 4 + 2, s / 4 - 4, s / 4 - 4); } }, 256),
 deck: canvasTex((g, s) => { for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(${24 + rnd() * 6},${30 + rnd() * 10}%,${32 + rnd() * 10}%)`; g.fillRect(0, i * s / 8, s, s / 8 - 3); } g.fillStyle = '#2a1c12'; for (let i = 0; i < 8; i++) g.fillRect(0, i * s / 8 + s / 8 - 3, s, 3); }, 256),
 stone: canvasTex((g, s) => { g.fillStyle = '#9c9a95'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `hsl(40,4%,${58 + rnd() * 6}%)`; g.fillRect(i * s / 2 + 2, j * s / 2 + 2, s / 2 - 4, s / 2 - 4); } }, 128),
 facade: canvasTex((g, s) => { g.fillStyle = '#d6d1c7'; g.fillRect(0, 0, s, s); g.fillStyle = '#5c6d7b'; g.fillRect(0, s * .22, s, s * .68); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, s * .22, s, s * .07); g.fillStyle = '#d6d1c7'; for (let x = 0; x < s; x += s / 3) g.fillRect(x, s * .22, s * .03, s * .68); }, 128),
 paving: canvasTex((g, s) => { g.fillStyle = '#c4beb2'; g.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = `hsl(38,9%,${70 + rnd() * 6}%)`; g.fillRect(i * s / 8 + 1, j * s / 8 + 1, s / 8 - 2, s / 8 - 2); } }, 256)
};
function texMat(key, rep, o = {}) { const t = TEX[key].clone(); t.needsUpdate = true; t.repeat.set(rep, rep); return new T.MeshStandardMaterial(Object.assign({ map: t, roughness: key === 'marble' ? .3 : .8 }, o)); }
const M_MARBLE = texMat('marble', 1 / 2.4), M_TILE = texMat('tile', 1 / 1.2), M_DECK = texMat('deck', 1 / 1.2), M_STONE = texMat('stone', 1 / 1.2);
const CLIP = new T.Plane(new T.Vector3(0, -1, 0), 1e4);
const M_WALL = mat('#ece6dc'), M_CORE = mat('#7d8087'), M_SLAB = mat('#8d8a84');
const M_FACADE = (() => { const t = TEX.facade.clone(); t.needsUpdate = true; t.repeat.set(1 / 3.6, 1 / FH); return new T.MeshStandardMaterial({ map: t, roughness: .6 }); })();
const M_CAP = mat('#f2efe9');
const M_STILTG = mat('#39434d', { roughness: .3, metalness: .2 });

/* box accumulator: merges many boxes into one geometry */
const BP = boxG.attributes.position.array, BN = boxG.attributes.normal.array, BI = boxG.index.array;
class Acc {
 constructor() { this.p = []; this.n = []; this.i = []; this.v = 0; }
 box(cx, cy, cz, lx, ly, lz, ang = 0) {
  if (lx <= 0 || ly <= 0 || lz <= 0) return; const c = Math.cos(ang), s = Math.sin(ang);
  for (let k = 0; k < BP.length; k += 3) { const x = BP[k] * lx, y = BP[k + 1] * ly, z = BP[k + 2] * lz; this.p.push(cx + x * c + z * s, cy + y, cz - x * s + z * c); const nx = BN[k], nz = BN[k + 2]; this.n.push(nx * c + nz * s, BN[k + 1], -nx * s + nz * c); }
  for (const q of BI) this.i.push(q + this.v); this.v += BP.length / 3;
 }
 aabb(x1, y0, z1, x2, y1, z2) { this.box((x1 + x2) / 2, (y0 + y1) / 2, (z1 + z2) / 2, Math.abs(x2 - x1), Math.abs(y1 - y0), Math.abs(z2 - z1)); }
 mesh(m, cast = true) { if (!this.v) return null; const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setIndex(this.i); const me = new T.Mesh(g, m); me.castShadow = cast; me.receiveShadow = true; return me; }
}
function shapeOf(pts, flip = true) { const s = new T.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], flip ? -p[1] : p[1]) : s.moveTo(p[0], flip ? -p[1] : p[1])); return s; }
function flat(pts, m, y) { const me = new T.Mesh(new T.ShapeGeometry(shapeOf(pts)), m); me.rotation.x = -Math.PI / 2; me.position.y = y; me.receiveShadow = true; return me; }
function extrude(pts, h, mats) { const g = new T.ExtrudeGeometry(shapeOf(pts), { depth: h, bevelEnabled: false }); const me = new T.Mesh(g, mats); me.rotation.x = -Math.PI / 2; me.castShadow = true; me.receiveShadow = true; return me; }

/* ================= world: ground, site, roads, landscape ================= */
const world = new T.Group(); scene.add(world);
{
 const ground = new T.Mesh(new T.PlaneGeometry(20000, 20000), mat('#5f6853')); ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; ground.receiveShadow = true; world.add(ground);
 const pav = flat(SITE_POLY, (() => { const m = texMat('paving', 1 / 6); return m; })(), .02); world.add(pav);
 // green buffer along the boundary
 const cx = SITE_C[0], cz = SITE_C[2];
 const inset = SITE_POLY.map(([x, z]) => { const dx = cx - x, dz = cz - z, d = Math.hypot(dx, dz); return [x + dx / d * 7, z + dz / d * 7]; });
 const sh = shapeOf(SITE_POLY); sh.holes.push(new T.Path(inset.map(([x, z]) => new T.Vector2(x, -z))));
 const ring = new T.Mesh(new T.ShapeGeometry(sh), mat('#5d8a4a')); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; ring.receiveShadow = true; world.add(ring);
 // roads: 18 m road on the north and 36 m road on the west, as on the approved layout
 const road = (a, b, w) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L; const sgn = ((cx - a[0]) * nx + (cz - a[1]) * nz) > 0 ? -1 : 1; const pts = [a, b, [b[0] + nx * w * sgn, b[1] + nz * w * sgn], [a[0] + nx * w * sgn, a[1] + nz * w * sgn]]; world.add(flat(pts, mat('#3d3f43'), .03)); };
 road([SITE_POLY[0][0] - 40, SITE_POLY[0][1] + 8.7], [SITE_POLY[1][0] + 60, SITE_POLY[1][1] - 13], 18);
 road([SITE_POLY[3][0] - 1, SITE_POLY[3][1] + 40], [SITE_POLY[0][0] + .6, SITE_POLY[0][1] - 40], 36);  // 36 m road on the west (approved layout)
 // amenities
 AMEN.forEach(([n, x, z, w, d, c]) => {
  if (n === 'Skating rink') { const m = new T.Mesh(new T.CircleGeometry(.5, 40), mat(c)); m.scale.set(w, d, 1); m.rotation.x = -Math.PI / 2; m.position.set(x, .08, z); world.add(m); return; }
  const tex = canvasTex((g, s) => { g.fillStyle = c; g.fillRect(0, 0, s, s); if (/court|Futsal|Basket|Tennis|Pickle/i.test(n)) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.strokeRect(20, 20, s - 40, s - 40); g.beginPath(); g.moveTo(s / 2, 20); g.lineTo(s / 2, s - 20); g.stroke(); g.beginPath(); g.arc(s / 2, s / 2, s / 8, 0, 7); g.stroke(); } }, 256);
  const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({ map: tex, roughness: .9 })); m.rotation.x = -Math.PI / 2; m.position.set(x, .08, z); m.receiveShadow = true; world.add(m);
 });
 // clubhouse G+6
 const [kx, kz, kw, kd, kh] = CLUB; const ck = new T.Mesh(boxG, (() => { const t = TEX.facade.clone(); t.needsUpdate = true; t.repeat.set(kw / 3.6, kh / 4.2); return [new T.MeshStandardMaterial({ map: t }), new T.MeshStandardMaterial({ map: t }), M_CAP, M_CAP, new T.MeshStandardMaterial({ map: t }), new T.MeshStandardMaterial({ map: t })]; })());
 ck.scale.set(kw, kh, kd); ck.position.set(kx, kh / 2, kz); ck.castShadow = ck.receiveShadow = true; world.add(ck);
 // trees along the green buffer
 const N = 170, trunk = new T.InstancedMesh(new T.CylinderGeometry(.18, .25, 3, 6), mat('#5a4330'), N), crown = new T.InstancedMesh(new T.IcosahedronGeometry(2.4, 0), mat('#4c7a3e', { flatShading: true }), N);
 const m4 = new T.Matrix4(); let k = 0;
 for (let e = 0; e < 4; e++) { const a = SITE_POLY[e], b = SITE_POLY[(e + 1) % 4], ia = inset[e], ib = inset[(e + 1) % 4]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const cnt = Math.floor(L / 7.5); for (let i = 0; i < cnt && k < N; i++) { const t = (i + .5) / cnt; const x = (a[0] + ia[0]) / 2 + ((b[0] + ib[0]) / 2 - (a[0] + ia[0]) / 2) * t, z = (a[1] + ia[1]) / 2 + ((b[1] + ib[1]) / 2 - (a[1] + ia[1]) / 2) * t; const s = .8 + rnd() * .5; m4.makeScale(s, s, s); m4.setPosition(x, 1.5 * s, z); trunk.setMatrixAt(k, m4); m4.setPosition(x, 4 * s, z); crown.setMatrixAt(k, m4); k++; } }
 trunk.count = crown.count = k; crown.castShadow = true; world.add(trunk, crown);
}
/* ================= surroundings: real roads, lakes, parks and buildings from OpenStreetMap ================= */
// surround.json is built from OpenStreetMap (ODbL) and aligned to the approved site plan: the 36 m road on the west,
// the road on the north and Plot 8 to the east. Neighbouring high-rises under construction are placed in their OSM
// parcels at their published tower count and floors (approximate layout).
const city = new T.Group(); scene.add(city);
const landmarks = [];
function mergeGeos(geos, withColor) {
 let nv = 0, ni = 0; geos.forEach(g => { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; });
 const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = withColor ? new Float32Array(nv * 3) : null, idx = new Uint32Array(ni); let vo = 0, io = 0;
 geos.forEach(g => { const p = g.attributes.position, n = g.attributes.normal; pos.set(p.array, vo * 3); if (n) nor.set(n.array, vo * 3); if (col && g.attributes.color) col.set(g.attributes.color.array, vo * 3);
  if (g.index) { const ix = g.index.array; for (let k = 0; k < ix.length; k++) idx[io + k] = ix[k] + vo; io += ix.length; } else { for (let k = 0; k < p.count; k++) idx[io + k] = vo + k; io += p.count; } vo += p.count; g.dispose(); });
 const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); if (col) out.setAttribute('color', new T.BufferAttribute(col, 3)); out.setIndex(new T.BufferAttribute(idx, 1)); return out;
}
const pairsOf = f => { const o = []; for (let k = 0; k + 1 < f.length; k += 2) o.push([f[k] / 10, f[k + 1] / 10]); return o; };
async function loadSurroundings() {
 let S; try { S = await (await fetch('surround.json?v=1')).json(); } catch (e) { console.warn('surroundings', e); return; }
 const polys = (list, y) => mergeGeos(list.map(rings => { const sh = shapeOf(pairsOf(rings[0])); rings.slice(1).forEach(h => sh.holes.push(new T.Path(pairsOf(h).map(([x, z]) => new T.Vector2(x, -z))))); const g = new T.ShapeGeometry(sh); g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g; }));
 const green = new T.Mesh(polys(S.g, .015), Object.assign(mat('#6f8a55'), { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })); green.receiveShadow = true; city.add(green);
 const water = new T.Mesh(polys(S.w, .03), new T.MeshStandardMaterial({ color: lin('#2c5a70'), roughness: .3, metalness: 0, envMapIntensity: .45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -6 })); city.add(water);
 // roads: ribbons, wider classes drawn a touch higher so junctions don't flicker
 { const pos = [], idx = []; S.r.forEach(rd => { const w = rd[0] / 10, pts = pairsOf(rd.slice(1)), y = .035 + Math.min(w, 12) * .001;
   for (let k = 0; k + 1 < pts.length; k++) { const [x1, z1] = pts[k], [x2, z2] = pts[k + 1], L = Math.hypot(x2 - x1, z2 - z1) || 1, ux = (x2 - x1) / L, uz = (z2 - z1) / L, nx = -uz * w / 2, nz = ux * w / 2, e = Math.min(w / 2, 4);
    const ax = x1 - ux * e, az = z1 - uz * e, bx = x2 + ux * e, bz = z2 + uz * e, b0 = pos.length / 3; pos.push(ax + nx, y, az + nz, ax - nx, y, az - nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz); idx.push(b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2); } });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); const m = new T.Mesh(g, Object.assign(mat('#3c3e42'), { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8 })); m.receiveShadow = true; city.add(m); }
 // buildings: walls + flat roofs, one mesh, colour by height (homes warm render, towers grey glass)
 { const geos = [], cA = [new T.Color('#d9ccb4'), new T.Color('#e6e0d5'), new T.Color('#cbb9a0'), new T.Color('#d4d1cb')], cT = [new T.Color('#aab5bf'), new T.Color('#c7c9c6'), new T.Color('#9fa9b3')];
  S.b.forEach((b, bi) => { const h = b[0] / 10; let pts = pairsOf(b.slice(1)); let ar = 0; pts.forEach((p, k) => { const q = pts[(k + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; }); if (ar > 0) pts = pts.reverse();
   const c = (h > 30 ? cT : cA)[bi % (h > 30 ? 3 : 4)], pos = [], nor = [], col = [], idx = [];
   pts.forEach((p, k) => { const q = pts[(k + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L, b0 = pos.length / 3; pos.push(p[0], 0, p[1], q[0], 0, q[1], q[0], h, q[1], p[0], h, p[1]); for (let t = 0; t < 4; t++) { nor.push(-nx, 0, -nz); col.push(c.r * .86, c.g * .86, c.b * .86); } idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); });
   const tri = T.ShapeUtils.triangulateShape(pts.map(([x, z]) => new T.Vector2(x, z)), []), r0 = pos.length / 3; pts.forEach(([x, z]) => { pos.push(x, h, z); nor.push(0, 1, 0); col.push(c.r, c.g, c.b); }); tri.forEach(t => idx.push(r0 + t[0], r0 + t[2], r0 + t[1]));
   const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); geos.push(g); });
  const m = new T.Mesh(mergeGeos(geos, true), new T.MeshStandardMaterial({ vertexColors: true, roughness: .85, side: T.DoubleSide })); m.castShadow = false; m.receiveShadow = true; city.add(m); }
 // neighbouring high-rise projects (approved heights, approximate layout)
 S.p.forEach(p => { let top = 0; p.t.forEach(([x, z, h, rot]) => { top = Math.max(top, h); const ft = h > 205 ? [52, 40] : [40, 30]; const t = TEX.facade.clone(); t.needsUpdate = true; t.repeat.set(ft[0] / 3.6, h / 3.45);
   const fm = new T.MeshStandardMaterial({ map: t, color: lin('#e9e6df') }), m = new T.Mesh(boxG, [fm, fm, M_CAP, M_CAP, fm, fm]); m.scale.set(ft[0], h, ft[1]); m.position.set(x, h / 2, z); m.rotation.y = -rot; m.castShadow = true; m.receiveShadow = true; city.add(m); m.updateMatrixWorld(); occBoxes.push(new T.Box3().setFromObject(m)); });
  addLandmark(`${p.n}`, p.d, [p.c[0], top + 12, p.c[1]]); });
 S.rl.filter(([n]) => /Outer Ring/.test(n)).forEach(([n, x, z]) => addLandmark(n, '', [x, 4, z]));
 S.ll.forEach(([n, x, z]) => addLandmark(n, 'lake', [x, 4, z]));
 SUR_READY = true; applyVisibility();
}
let SUR_READY = false;
// solid blocks that can hide a landmark label: the three towers here plus the neighbouring towers
const occBoxes = [];
function addLandmark(n, sub, p) { const d = document.createElement('div'); d.className = 'lb lm'; d.style.display = 'none'; d.innerHTML = `${n}${sub ? `<i>${sub}</i>` : ''}`; LBL.appendChild(d); landmarks.push({ d, p, occ: true }); }

/* ================= towers (massing) ================= */
const towerGrp = {};
function towerMassing(t, cut) {
 // cut = null for full height, otherwise {n} to leave the selected floor open
 if (towerGrp[t]) { scene.remove(towerGrp[t]); towerGrp[t].traverse(o => { if (o.geometry && o.geometry !== boxG) o.geometry.dispose(); }); }
 const g = new T.Group(); g.position.set(TW[t].O[0], 0, TW[t].O[1]); towerGrp[t] = g; scene.add(g);
 const plate = TW[t].typ.plate;
 const stilt = extrude(plate, L1 - STILT - .3, M_STILTG); stilt.position.y = STILT; stilt.scale.set(.985, .985, 1); g.add(stilt);
 const podium = extrude(plate, .3, M_SLAB); podium.position.y = L1 - .3; g.add(podium);
 const mk = (y0, y1, tag) => { if (y1 - y0 < .1) return; const m = extrude(plate, y1 - y0, [M_CAP, M_FACADE]); m.position.y = y0; m.userData.part = tag; g.add(m); return m; };
 if (!cut) mk(L1, TOP, 'all');
 else { mk(L1, lvl(cut.n), 'below'); g.userData.above = mk(lvl(cut.n) + CH, TOP, 'above'); }
 // rooftop machine room over the lift core
 const lf = TW[t].typ.lift; if (lf.length) { const x1 = Math.min(...lf.map(q => q[0])) - 1, y1 = Math.min(...lf.map(q => q[1])) - 1, x2 = Math.max(...lf.map(q => q[2])) + 1, y2 = Math.max(...lf.map(q => q[3])) + 1; const r = new T.Mesh(boxG, M_CAP); r.scale.set(x2 - x1, 5, y2 - y1); r.position.set((x1 + x2) / 2, TOP + 2.5, (y1 + y2) / 2); r.castShadow = true; g.add(r); }
 // balconies on every floor (slabs + glass), skipping the open floor
 const B = TW[t].typ.balc, floors = []; for (let n = 1; n <= 56; n++) if (!cut || n !== cut.n) floors.push(n);
 const sl = new T.InstancedMesh(boxG, M_SLAB, B.length * floors.length), gl = new T.InstancedMesh(boxG, glassM, B.length * floors.length); const m4 = new T.Matrix4(); let k = 0, kAbove = [];
 floors.forEach(n => B.forEach(b => { m4.makeScale(b[2] - b[0], .2, b[3] - b[1]); m4.setPosition((b[0] + b[2]) / 2, lvl(n) - .1, (b[1] + b[3]) / 2); sl.setMatrixAt(k, m4); m4.makeScale(b[2] - b[0] + .04, 1.1, b[3] - b[1] + .04); m4.setPosition((b[0] + b[2]) / 2, lvl(n) + .55, (b[1] + b[3]) / 2); gl.setMatrixAt(k, m4); k++; }));
 sl.castShadow = true; sl.receiveShadow = true; g.add(sl, gl);
 if (cut) { // split balconies above for hiding in floor mode
  const above = floors.filter(n => n > cut.n).length * B.length; g.userData.balcAboveFrom = k - above; g.userData.sl = sl; g.userData.gl = gl; g.userData.total = k;
 }
 return g;
}

/* ================= floor detail ================= */
let FLOOR = null; // {grp, v, t, n, segs, units, rooms, labels...}
function buildFloor(t, n) {
 if (FLOOR) { scene.remove(FLOOR.grp); FLOOR.grp.traverse(o => { if (o.geometry && o.geometry !== boxG) o.geometry.dispose(); }); FLOOR.labels.forEach(l => l.d.remove()); }
 const v = variantFor(t, n); const grp = new T.Group(); grp.position.set(TW[t].O[0], lvl(n), TW[t].O[1]); scene.add(grp);
 const clipY = CLIP;
 const wallM = M_WALL.clone(); wallM.clippingPlanes = [clipY]; const glass = glassM.clone(); glass.clippingPlanes = [clipY];
 // ---- slab + floors
 const slab = extrude(v.plate, .32, M_SLAB); slab.position.y = -.33; slab.castShadow = false; grp.add(slab);
 const base = flat(v.plate, M_MARBLE, 0); grp.add(base);
 const floorMeshes = [base]; base.userData = { u: null };
 const tileTypes = new Set(['toilet', 'utility', 'wash', 'servant', 'store', 'wetk']);
 v.rooms.forEach((r, i) => { r.k = rtype(r.n); const pts = r.p || rectPts(r.r); const m = flat(pts, tileTypes.has(r.k) ? M_TILE : M_MARBLE, .012); m.userData = { u: r.u, i }; grp.add(m); floorMeshes.push(m); });
 v.lobby.concat(v.passage).forEach(q => { const m = flat(rectPts(q), M_STONE, .01); m.userData = { u: null }; grp.add(m); floorMeshes.push(m); });
 v.balc.forEach(b => { const m = flat(rectPts(b), M_DECK, .012); m.userData = { u: null, balc: 1 }; grp.add(m); floorMeshes.push(m); const s = new T.Mesh(boxG, M_SLAB); s.scale.set(b[2] - b[0], .3, b[3] - b[1]); s.position.set((b[0] + b[2]) / 2, -.16, (b[1] + b[3]) / 2); grp.add(s); });
 // ---- walls
 const segs = []; const keys = new Set();
 const addSeg = (x1, y1, x2, y2, th, ext) => { const k = [x1, y1, x2, y2].map(q => Math.round(q * 20)).join(','), k2 = [x2, y2, x1, y1].map(q => Math.round(q * 20)).join(','); if (keys.has(k) || keys.has(k2) || Math.hypot(x2 - x1, y2 - y1) < .05) return; keys.add(k); segs.push({ x1, y1, x2, y2, th, ext }); };
 v.outline.forEach(s => addSeg(s[0], s[1], s[2], s[3], .23, 1));
 v.rooms.forEach(r => { const p = r.p || rectPts(r.r); for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; addSeg(a[0], a[1], b[0], b[1], .12, 0); } });
 v.gl.forEach(s => addSeg(s[0], s[1], s[2], s[3], .12, 0));
 const wins = [];
 // ---- balconies: merge touching balcony rectangles into one sit-out; find the side that meets the flat
 const BG = []; const touch = (p, q) => p[0] <= q[2] + .1 && q[0] <= p[2] + .1 && p[1] <= q[3] + .1 && q[1] <= p[3] + .1;
 v.balc.forEach(b => { const hit = BG.filter(g => g.rects.some(r => touch(r, b))); const g = { rects: [b] }; hit.forEach(h => { g.rects.push(...h.rects); BG.splice(BG.indexOf(h), 1); }); BG.push(g); });
 const inBalc = (x, y) => v.balc.some(q => inRect(q, x, y, .02));
 const sdTags = v.tags.filter(g => g.k.startsWith('SD'));
 BG.forEach(g => {
  g.box = [Math.min(...g.rects.map(r => r[0])), Math.min(...g.rects.map(r => r[1])), Math.max(...g.rects.map(r => r[2])), Math.max(...g.rects.map(r => r[3]))];
  const [x0, y0, x1, y1] = g.box; g.doors = [];
  [[1, y0, x0, x1, -1], [1, y1, x0, x1, 1], [0, x0, y0, y1, -1], [0, x1, y0, y1, 1]].forEach(([hz, c, a, b, out]) => {
   // a side meets the building if points just beyond it are inside the floor plate (and not more balcony)
   const smp = [.25, .5, .75].map(t => a + (b - a) * t).filter(m => { const x = hz ? m : c + out * .35, y = hz ? c + out * .35 : m; return pip(v.plate, x, y) && !inBalc(x, y); });
   if (smp.length < 2) return;
   const lo = Math.min(...smp) - (b - a) * .2, hi = Math.max(...smp) + (b - a) * .2, m = (lo + hi) / 2;
   const mid = hz ? [m, c] : [c, m];
   const tag = sdTags.filter(t => Math.hypot(t.x - mid[0], t.y - mid[1]) < 3.3).sort((p, q) => Math.hypot(p.x - mid[0], p.y - mid[1]) - Math.hypot(q.x - mid[0], q.y - mid[1]))[0];
   if (!tag) return;  // the approved plan marks no sliding door onto this balcony
   const span = [Math.max(a + .25, lo), Math.min(b - .25, hi)]; if (span[1] - span[0] < .8) return;
   // the slider sits on the wall the SD tag is written against: nearest parallel wall to the tag, on the building side
   const tp = hz ? tag.y : tag.x, ta = hz ? tag.x : tag.y; let wc = null;
   segs.forEach(sg => { const shz = Math.abs(sg.y1 - sg.y2) < .03, svt = Math.abs(sg.x1 - sg.x2) < .03; if (hz ? !shz : !svt) return; const sc = hz ? sg.y1 : sg.x1, sa = Math.min(hz ? sg.x1 : sg.y1, hz ? sg.x2 : sg.y2), sb = Math.max(hz ? sg.x1 : sg.y1, hz ? sg.x2 : sg.y2); if ((sc - c) * out < .05 || Math.abs(sc - tp) > .5 || sb < ta - 1 || sa > ta + 1) return; if (wc === null || Math.abs(sc - tp) < Math.abs(wc - tp)) wc = sc; });
   const depth = wc === null ? 1.8 : Math.abs(wc - c) + .3;
   { const w2 = Math.min(2.4, span[1] - span[0]); let s0 = Math.max(span[0], Math.min(ta - w2 / 2, span[1] - w2)); span[0] = s0; span[1] = s0 + w2; }  // slider centred on its SD tag
   const c0 = Math.min(c, c + out * depth), c1 = Math.max(c, c + out * depth);
   const sm = span[0] + (span[1] - span[0]) * .72;  // walk through the open half of the slider
   const w = { hz: !!hz, c, c0, c1, a: span[0], b: span[1], k: 'SD', bal: true, pout: hz ? [sm, c - out * .7] : [c - out * .7, sm], pin: hz ? [sm, c + out * (depth + .6)] : [c + out * (depth + .6), sm] };
   wins.push(w); g.doors.push(w);
  });
 });
 // windows, ventilators and sliders: every magenta strip on the sanctioned plan, typed by the code written on it (W*, V, SD*)
 v.winq.forEach((q, i) => {
  const hz = q[2] - q[0] >= q[3] - q[1], c = hz ? (q[1] + q[3]) / 2 : (q[0] + q[2]) / 2, a = hz ? q[0] : q[1], b = hz ? q[2] : q[3];
  const code = v.wk[i] || '?', k = code.startsWith('SD') ? 'SD' : code[0] === 'V' ? 'V' : 'W';
  // a slider onto a sit-out is already placed by the balcony pass (with its walk-through path)
  if (wins.some(w => w.bal && w.hz === hz && c > w.c0 - .3 && c < w.c1 + .3 && Math.min(b, w.b) - Math.max(a, w.a) > .2)) return;
  wins.push({ hz, c, a, b, k, code, c0: c - .5, c1: c + .5 });
 });
 const acc = new Acc(), gacc = new Acc(), skacc = new Acc(), facc = new Acc(), dacc = new Acc(), coll = [];
 segs.forEach(s => {
  const hz = Math.abs(s.y1 - s.y2) < .03, vt = Math.abs(s.x1 - s.x2) < .03;
  if (!hz && !vt) { const cx = (s.x1 + s.x2) / 2, cz = (s.y1 + s.y2) / 2, L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); acc.box(cx, CH / 2, cz, L, CH, s.th, Math.atan2(-(s.y2 - s.y1), s.x2 - s.x1)); coll.push([s.x1, s.y1, s.x2, s.y2, s.th]); return; }
  const c = hz ? s.y1 : s.x1, a = Math.min(hz ? s.x1 : s.y1, hz ? s.x2 : s.y2), b = Math.max(hz ? s.x1 : s.y1, hz ? s.x2 : s.y2);
  const ops = [];
  v.doors.forEach((q, di) => { const w = q[2] - q[0], h = q[3] - q[1], dk = v.dk[di] === 'OPEN' ? 'DO' : 'D'; if (hz && h <= w + .05 && q[1] - .16 <= c && c <= q[3] + .16) { const lo = Math.max(a, q[0]), hi = Math.min(b, q[2]); if (hi - lo > .25) ops.push([lo, hi, dk]); } if (vt && w <= h + .05 && q[0] - .16 <= c && c <= q[2] + .16) { const lo = Math.max(a, q[1]), hi = Math.min(b, q[3]); if (hi - lo > .25) ops.push([lo, hi, dk]); } });
  wins.forEach(w => { if (w.hz !== hz || c < w.c0 - .05 || c > w.c1 + .05) return; if (w.bal && (s.ext || Math.abs(c - w.c) < .06)) return; const lo = Math.max(a, w.a), hi = Math.min(b, w.b); if (hi - lo > .2) { ops.push([lo, hi, w.k]); if (w.bal) s.balFace = 1; } });
  const onLine = s.ext || v.outline.some(o => { const ohz = Math.abs(o[1] - o[3]) < .03, ovt = Math.abs(o[0] - o[2]) < .03; if (hz ? !ohz : !ovt) return false; const oc = hz ? o[1] : o[0]; if (Math.abs(oc - c) > .06) return false; const oa = Math.min(hz ? o[0] : o[1], hz ? o[2] : o[3]), ob = Math.max(hz ? o[0] : o[1], hz ? o[2] : o[3]); return ob > a && oa < b; });
  if (onLine) { // along a balcony, the building line is only the slab edge: walls sit inside it, so nothing drawn on the line is a wall
   const open = []; v.balc.forEach(q => { const edges = hz ? [q[1], q[3]] : [q[0], q[2]]; if (!edges.some(e => Math.abs(e - c) < .15)) return; const lo = Math.max(a, hz ? q[0] : q[1]), hi = Math.min(b, hz ? q[2] : q[3]); if (hi - lo > .1) open.push([lo, hi]); });
   if (open.length) { const cut = []; ops.forEach(o => { let parts = [[o[0], o[1]]]; open.forEach(([lo, hi]) => { parts = parts.flatMap(([p, q]) => q <= lo || p >= hi ? [[p, q]] : [[p, lo], [hi, q]].filter(([x, y]) => y - x > .2)); }); parts.forEach(([p, q]) => cut.push([p, q, o[2]])); }); ops.length = 0; ops.push(...cut, ...open.map(([lo, hi]) => [lo, hi, 'O'])); }
  }
  ops.sort((p, q) => p[0] - q[0]);
  const gl = s.ext || s.balFace;
  const piece = (lo, hi, y0, y1, g) => { if (hi - lo < .01 || y1 - y0 < .01) return; const L = hi - lo, m = (lo + hi) / 2; const th = g ? .03 : s.th; (g ? gacc : acc).box(hz ? m : c, (y0 + y1) / 2, hz ? c : m, hz ? L : th, y1 - y0, hz ? th : L); if (!g && y0 === 0) skacc.box(hz ? m : c, .05, hz ? c : m, hz ? L : th + .03, .1, hz ? th + .03 : L); if (y0 < 1) coll.push(hz ? [lo, c, hi, c, s.th] : [c, lo, c, hi, s.th]); };
  let cur = a;
  ops.forEach(([lo, hi, k]) => {
   lo = Math.max(lo, cur); if (hi <= lo) return;
   piece(cur, lo, 0, CH);
   if (k === 'DO') piece(lo, hi, DOORH, CH);  // open arch: header only
   else if (k === 'D') { piece(lo, hi, DOORH, CH); const fw = .06; [[lo - fw, lo], [hi, hi + fw]].forEach(([p0, p1]) => facc.box(hz ? (p0 + p1) / 2 : c, DOORH / 2, hz ? c : (p0 + p1) / 2, hz ? fw : s.th + .04, DOORH, hz ? s.th + .04 : fw)); facc.box(hz ? (lo + hi) / 2 : c, DOORH + .03, hz ? c : (lo + hi) / 2, hz ? hi - lo + .12 : s.th + .04, .06, hz ? s.th + .04 : hi - lo + .12);
     if (s.ext || hi - lo < 1.6) { const L = hi - lo - .04; const hx = hz ? lo + .02 : c + s.th / 2, hzz = hz ? c + s.th / 2 : lo + .02; dacc.box(hz ? hx + .02 : hx + L / 2, DOORH / 2, hz ? hzz + L / 2 : hzz + .02, hz ? .035 : L, DOORH - .02, hz ? L : .035); } }
   else if (k === 'W') { piece(lo, hi, 0, .75); piece(lo, hi, DOORH, CH); if (gl) piece(lo, hi, .75, DOORH, 1); }
   else if (k === 'V') { piece(lo, hi, 0, 1.8); piece(lo, hi, DOORH, CH); if (gl) piece(lo, hi, 1.8, DOORH, 1); }
   else if (k === 'SD') { piece(lo, hi, DOORH, CH); if (gl) { piece(lo, (lo + hi) / 2, 0, DOORH, 1); const fw = .05; [[lo - fw, lo], [hi, hi + fw]].forEach(([p0, p1]) => facc.box(hz ? (p0 + p1) / 2 : c, DOORH / 2, hz ? c : (p0 + p1) / 2, hz ? fw : s.th + .03, DOORH, hz ? s.th + .03 : fw)); } }
   cur = hi;
  });
  piece(cur, b, 0, CH);
 });
 // core: lifts, stairs, meter rooms, voids as solid blocks
 v.lift.concat(v.stair, v.meter, v.void).forEach(q => { acc.box((q[0] + q[2]) / 2, CH / 2, (q[1] + q[3]) / 2, q[2] - q[0], CH, q[3] - q[1]); coll.push([q[0], q[1], q[2], q[1], .05], [q[2], q[1], q[2], q[3], .05], [q[2], q[3], q[0], q[3], .05], [q[0], q[3], q[0], q[1], .05]); });
 // balcony railings on edges facing out
 v.balc.forEach(b => { const e = [[b[0], b[1], b[2], b[1], 0, -1], [b[2], b[1], b[2], b[3], 1, 0], [b[0], b[3], b[2], b[3], 0, 1], [b[0], b[1], b[0], b[3], -1, 0]]; e.forEach(([x1, y1, x2, y2, nx, ny]) => { const mx = (x1 + x2) / 2 + nx * .35, my = (y1 + y2) / 2 + ny * .35; if (pip(v.plate, mx, my) || v.balc.some(q => q !== b && inRect(q, mx, my, .05))) return; const hz = y1 === y2; gacc.box((x1 + x2) / 2, .55, (y1 + y2) / 2, hz ? x2 - x1 : .04, 1.1, hz ? .04 : y2 - y1); acc.box((x1 + x2) / 2, 1.12, (y1 + y2) / 2, hz ? x2 - x1 : .06, .05, hz ? .06 : y2 - y1); coll.push([x1, y1, x2, y2, .06]); }); });
 const wm = acc.mesh(wallM, false); if (wm) grp.add(wm);
 const shadowAcc = acc.mesh(new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), true); if (shadowAcc) { shadowAcc.receiveShadow = false; grp.add(shadowAcc); }
 const gm = gacc.mesh(glass, false); if (gm) { gm.renderOrder = 2; grp.add(gm); }
 const mk2 = (a, c) => { const m = a.mesh(Object.assign(mat(c).clone(), { clippingPlanes: [clipY] }), false); if (m) grp.add(m); };
 mk2(skacc, '#6d5a4a'); mk2(facc, '#5a4636'); const leaves = dacc.mesh(Object.assign(mat('#6e4d34').clone(), { clippingPlanes: [clipY], roughness: .5 }), false); if (leaves) grp.add(leaves);
 // ---- units
 const units = {};
 v.rooms.forEach((r, i) => { if (!r.u) return; const U = units[r.u] || (units[r.u] = { id: r.u, rooms: [], area: 0, box: [1e9, 1e9, -1e9, -1e9] }); U.rooms.push(r); U.area += roomArea(r); const st = r.k === 'servant' || (r.k === 'toilet' && v.rooms.some(q => q.u === r.u && q.k === 'servant' && Math.max(q.r[0] - r.r[2], r.r[0] - q.r[2], q.r[1] - r.r[3], r.r[1] - q.r[3]) < .4)); r.staff = st; if (!st) U.box = [Math.min(U.box[0], r.r[0]), Math.min(U.box[1], r.r[1]), Math.max(U.box[2], r.r[2]), Math.max(U.box[3], r.r[3])]; });
 Object.values(units).forEach(U => {
  const beds = U.rooms.filter(r => r.k === 'bed').sort((a, b) => roomArea(b) - roomArea(a)); beds.forEach((r, i) => r.label = i === 0 ? 'Master bedroom' : `Bedroom ${i + 1}`); U.beds = beds.length;
  U.rooms.forEach(r => { if (!r.label) r.label = PRETTY[r.k] || (r.n ? r.n.charAt(0) + r.n.slice(1).toLowerCase() : 'Room'); });
  if (!U.beds) { U.rooms.forEach(r => { r.u = null; }); delete units[U.id]; return; }
  const meta = META[U.id]; U.no = meta ? meta[2] : +U.id.split('-').pop(); U.flat = n * 100 + U.no; U.size = meta ? meta[0] : null; U.face = meta ? meta[1] : '';
  // main door: MD tag nearest a door quad that touches this unit
  const md = v.tags.filter(g => g.k === 'MD');
  let best = null;
  v.doors.forEach(q => { const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2; const g = md.find(m => Math.hypot(m.x - cx, m.y - cy) < 1.3); if (!g) return; const d = Math.max(U.box[0] - cx, cx - U.box[2], 0) + Math.max(U.box[1] - cy, cy - U.box[3], 0); if (d < 1 && (!best || d < best[0])) best = [d, q]; });
  if (best) { const q = best[1], cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2, horizWall = (q[3] - q[1]) < (q[2] - q[0]); const nx = horizWall ? 0 : 1, ny = horizWall ? 1 : 0; const p1 = [cx + nx * .9, cy + ny * .9], p2 = [cx - nx * .9, cy - ny * .9]; const main = U.rooms.filter(r => !r.staff); const in1r = main.some(r => inRoom(r, p1[0], p1[1])), in2r = main.some(r => inRoom(r, p2[0], p2[1])); const cxu = (U.box[0] + U.box[2]) / 2, cyu = (U.box[1] + U.box[3]) / 2; const in1 = in1r !== in2r ? in1r : Math.hypot(p1[0] - cxu, p1[1] - cyu) < Math.hypot(p2[0] - cxu, p2[1] - cyu); U.door = { c: [cx, cy], inside: in1 ? p1 : p2, outside: in1 ? p2 : p1 }; }
 });
 // ---- furniture
 const furn = new T.Group(); grp.add(furn); furn.visible = $('#furn').checked;
 const FAk = {}; let curK = 'x'; const F = (x1, y1, x2, y2, h0, h1, c) => { const A = FAk[curK] || (FAk[curK] = {}); (A[c] || (A[c] = new Acc())).aabb(Math.min(x1, x2), h0, Math.min(y1, y2), Math.max(x1, x2), h1, Math.max(y1, y2)); };
 v.rooms.forEach(r => { curK = r.u || 'x'; furnish(r, v, wins, F); });
 v.balc.forEach(b => { curK = 'b' + BG.findIndex(g => g.rects.includes(b)); const w = b[2] - b[0], d = b[3] - b[1]; if (Math.min(w, d) < 1.2) return; const hz = w > d; const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; if (hz) { F(cx - 1.4, cy - .35, cx - .6, cy + .35, 0, .45, '#d8d0c2'); F(cx + .6, cy - .35, cx + 1.4, cy + .35, 0, .45, '#d8d0c2'); } else { F(cx - .35, cy - 1.4, cx + .35, cy - .6, 0, .45, '#d8d0c2'); F(cx - .35, cy + .6, cx + .35, cy + 1.4, 0, .45, '#d8d0c2'); } F(cx - .22, cy - .22, cx + .22, cy + .22, 0, .5, '#7a5638'); });
 const furnU = {}; for (const key in FAk) { const gq = new T.Group(); furnU[key] = gq; furn.add(gq); for (const c in FAk[key]) { const fm = mat(c).clone(); fm.clippingPlanes = [clipY]; gq.add(FAk[key][c].mesh(fm)); } }
 // ---- labels
 const labels = [];
 Object.values(units).forEach(U => { const d = document.createElement('div'); d.className = 'lb u'; d.innerHTML = `${U.flat}<i>${U.size ? fmt(U.size) + ' sft' : ''}${U.beds ? ' · ' + U.beds + ' BHK' : ''}</i>`; LBL.appendChild(d); labels.push({ d, p: [(U.box[0] + U.box[2]) / 2, 1.2, (U.box[1] + U.box[3]) / 2], kind: 'unit', u: U.id }); });
 v.rooms.forEach(r => { if (!r.u) return; const c = labelPoint(r); const d = document.createElement('div'); d.className = 'lb'; d.innerHTML = `${r.label}${r.d ? `<i>${r.d[0].toFixed(2)} × ${r.d[1].toFixed(2)} m</i>` : ''}`; LBL.appendChild(d); labels.push({ d, p: [c[0], .3, c[1]], kind: 'room', u: r.u }); });
 v.free.forEach(f => { if (!/REFUGE|AMENIT|LOBBY|SERVICE/.test(f.t)) return; const d = document.createElement('div'); d.className = 'lb'; d.textContent = f.t.charAt(0) + f.t.slice(1).toLowerCase(); LBL.appendChild(d); labels.push({ d, p: [f.x, .3, f.y], kind: 'free' }); });
 FLOOR = { grp, v, t, n, coll, units, labels, floorMeshes, clipY, furn, wins, leaves, BG, furnU, segs };
 return FLOOR;
}
function labelPoint(r) { if (r._lp) return r._lp; const b = r.r; let x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2; if (r.p) { const ir = innerRect(r); x = (ir[0] + ir[2]) / 2; y = (ir[1] + ir[3]) / 2; } return (r._lp = [x, y]); }
function innerRect(r) { if (!r.p) return r.r.slice(); return r._ir || (r._ir = maxRect(r, [])); }
// second largest rectangle of an L/T-shaped room (the part the main rectangle leaves out), or null if too small to use
function sideRect(r) { if (!r.p) return null; if (r._sr !== undefined) return r._sr; const q = maxRect(r, [innerRect(r)]); return (r._sr = q[2] - q[0] >= 1.1 && q[3] - q[1] >= 1.1 ? q : null); }
function maxRect(r, skip) {
 // exact largest axis-aligned rectangle inside the room polygon (minus skipped rectangles), on a 10 cm grid (histogram method)
 const res = .1, [x0, y0, x1, y1] = r.r, nx = Math.max(1, Math.round((x1 - x0) / res)), ny = Math.max(1, Math.round((y1 - y0) / res));
 const hgt = new Array(nx).fill(0); let best = { a: 0, q: [x0, y0, x0, y0] };
 for (let j = 0; j < ny; j++) {
  for (let i = 0; i < nx; i++) { const x = x0 + (i + .5) * res, y = y0 + (j + .5) * res; hgt[i] = pip(r.p, x, y) && !skip.some(k => x > k[0] && x < k[2] && y > k[1] && y < k[3]) ? hgt[i] + 1 : 0; }
  const st = [];
  for (let i = 0; i <= nx; i++) { const h = i < nx ? hgt[i] : 0; let start = i; while (st.length && st[st.length - 1][1] >= h) { const [si, sh] = st.pop(); const a = sh * (i - si); if (a > best.a) best = { a, q: [x0 + si * res, y0 + (j + 1 - sh) * res, x0 + i * res, y0 + (j + 1) * res] }; start = si; } st.push([start, h]); }
 }
 return best.q.map(v => +v.toFixed(3));
}
/* ================= furniture rules ================= */
function edgesOf(q, v, wins) {
 const E = [{ hz: 1, c: q[1], a: q[0], b: q[2], n: 1 }, { hz: 1, c: q[3], a: q[0], b: q[2], n: -1 }, { hz: 0, c: q[0], a: q[1], b: q[3], n: 1 }, { hz: 0, c: q[2], a: q[1], b: q[3], n: -1 }];
 E.forEach(e => {
  e.len = e.b - e.a; e.blk = []; e.win = [];
  e.dsw = [];  // shuttered doors in this wall (open arches have no leaf to swing)
  v.doors.forEach((d, di) => { const perpLo = e.hz ? d[1] : d[0], perpHi = e.hz ? d[3] : d[2]; const lo = Math.max(e.a, e.hz ? d[0] : d[1]), hi = Math.min(e.b, e.hz ? d[2] : d[3]); if (perpLo - .35 <= e.c && e.c <= perpHi + .35 && hi - lo > .2) { e.blk.push([lo - .25, hi + .25]); if (v.dk[di] !== 'OPEN') e.dsw.push([lo, hi]); } });
  wins.forEach(w => { if (w.hz !== !!e.hz || e.c < w.c0 - .1 || e.c > w.c1 + .1) return; const lo = Math.max(e.a, w.a), hi = Math.min(e.b, w.b); if (hi - lo > .2) { if (w.k === 'SD') { e.blk.push([lo - .1, hi + .1]); (e.sd || (e.sd = [])).push([lo, hi]); } else e.win.push([lo - .1, hi + .1]); } });
  // doorways in the other walls need standing room in front of them: keep the strip of this wall whose furniture
  // (up to 1 m deep) would reach into any doorway's approach zone free as well
  const band = e.hz ? [e.a, Math.min(e.c, e.c + e.n), e.b, Math.max(e.c, e.c + e.n)] : [Math.min(e.c, e.c + e.n), e.a, Math.max(e.c, e.c + e.n), e.b];
  approachZones(v, wins).forEach(z => { if (z[0] < band[2] && band[0] < z[2] && z[1] < band[3] && band[1] < z[3]) { const lo = Math.max(e.a, e.hz ? z[0] : z[1]), hi = Math.min(e.b, e.hz ? z[2] : z[3]); if (hi > lo) e.blk.push([lo, hi]); } });
 });
 return E;
}
// the floor in front of every doorway, open arch and sliding door (both sides) where nothing may stand: opening width + 10 cm, 90 cm deep
function approachZones(v, wins) {
 if (v._az && v._azW === wins) return v._az; const z = [];
 v.doors.forEach(q => { const hzW = (q[3] - q[1]) < (q[2] - q[0]), cx = (q[0] + q[2]) / 2, cz = (q[1] + q[3]) / 2; z.push(hzW ? [q[0] - .1, cz - .9, q[2] + .1, cz + .9] : [cx - .9, q[1] - .1, cx + .9, q[3] + .1]); });
 wins.filter(w => w.k === 'SD').forEach(w => z.push(w.hz ? [w.a, w.c - .9, w.b, w.c + .9] : [w.c - .9, w.a, w.c + .9, w.b]));
 v._azW = wins; return (v._az = z);
}
function freeSpan(e, avoidWin) {
 const bl = e.blk.concat(avoidWin ? e.win : []).sort((p, q) => p[0] - q[0]); let best = [0, 0], cur = e.a;
 bl.forEach(([lo, hi]) => { if (lo - cur > best[1] - best[0]) best = [cur, lo]; cur = Math.max(cur, hi); }); if (e.b - cur > best[1] - best[0]) best = [cur, e.b];
 return best;
}
function along(e, lo, hi, d0, d1, h0, h1, c, F) { const p0 = e.c + e.n * d0, p1 = e.c + e.n * d1; if (e.hz) F(lo, p0, hi, p1, h0, h1, c); else F(p0, lo, p1, hi, h0, h1, c); }
function furnish(r, v, wins, F) {
 const k = r.k, q = innerRect(r); const W = q[2] - q[0], D = q[3] - q[1]; if (W < .8 || D < .8) return;
 const E = edgesOf(q, v, wins); const free = E.map(e => ({ e, s: freeSpan(e, false), sw: freeSpan(e, true) }));
 const pick = (avoidWin, minLen) => free.filter(f => !f.e.blk.length || (f.s[1] - f.s[0]) >= minLen).sort((a, b) => ((b.e.blk.length ? 0 : 2) + (avoidWin && !b.e.win.length ? 1 : 0) + (b.sw[1] - b.sw[0]) * .1) - ((a.e.blk.length ? 0 : 2) + (avoidWin && !a.e.win.length ? 1 : 0) + (a.sw[1] - a.sw[0]) * .1));
 const depthOf = e => e.hz ? D : W;
 if (k === 'bed') {
  const f = pick(true, 2)[0]; if (!f) return; const e = f.e, s = f.sw[1] - f.sw[0] >= 2 ? f.sw : f.s; const bw = Math.min(e.len, 3.4) > 3.3 ? 1.8 : 1.5, bl = Math.min(2.1, depthOf(e) - .5);
  const m = (s[0] + s[1]) / 2; along(e, m - bw / 2 - .05, m + bw / 2 + .05, 0, .08, 0, 1.15, '#5c4b3e', F); along(e, m - bw / 2, m + bw / 2, .08, bl, 0, .35, '#4a3326', F); along(e, m - bw / 2 + .05, m + bw / 2 - .05, .1, bl - .05, .35, .58, '#f2efe9', F);
  along(e, m - bw / 2 + .1, m - .05, .15, .55, .58, .7, '#ffffff', F); along(e, m + .05, m + bw / 2 - .1, .15, .55, .58, .7, '#ffffff', F); along(e, m - bw / 2 + .05, m + bw / 2 - .05, bl - .6, bl - .1, .58, .62, '#7d8f88', F);
  if (s[1] - s[0] > bw + 1.2) { along(e, m - bw / 2 - .55, m - bw / 2 - .1, .05, .5, 0, .5, '#7a5638', F); along(e, m + bw / 2 + .1, m + bw / 2 + .55, .05, .5, 0, .5, '#7a5638', F); }
  if (depthOf(e) > bl + 1.2) along(e, m - bw / 2 - .4, m + bw / 2 + .4, bl - .9, bl + .5, 0, .012, '#c4b293', F);
 } else if (k === 'toilet') {
  const fs = pick(false, .9); if (!fs.length) return; const e = fs[0].e, s = fs[0].s; along(e, s[0] + .05, s[0] + .75, 0, .65, 0, .4, '#f7f7f5', F);
  const e2 = (fs[1] || fs[0]); const s2 = e2.s; if (s2[1] - s2[0] > 1.2) { along(e2.e, s2[1] - 1.1, s2[1] - .1, 0, .5, .75, .9, '#e9e6e0', F); along(e2.e, s2[1] - 1.1, s2[1] - .1, 0, .48, .3, .75, '#4a3326', F); }
  const opp = E.find(x => x.hz === e.hz && x !== e) || e; const lo = opp.a, hi = opp.b; if (opp.blk.length === 0) { const gl = 1.0; along(opp, lo, lo + Math.min(hi - lo, 1.2) * .7, gl, gl + .02, 0, 2.0, '#cfe0ea', F); }
 } else if (k === 'dress') {
  pick(false, 1).slice(0, 2).forEach(f => along(f.e, f.s[0] + .05, f.s[1] - .05, 0, .6, 0, 2.4, '#b08a62', F));
 } else if (k === 'kitchen' || k === 'wetk') {
  pick(false, 1.2).slice(0, 2).forEach((f, i) => { along(f.e, f.s[0] + .02, f.s[1] - .02, 0, .62, 0, .88, '#3b3d42', F); along(f.e, f.s[0], f.s[1], 0, .64, .88, .92, '#e9e6e0', F); if (i === 0) { along(f.e, f.s[0] + .02, f.s[1] - .02, 0, .35, 1.45, 2.15, '#3b3d42', F); const m = (f.s[0] + f.s[1]) / 2; along(f.e, m - .35, m + .35, .08, .55, .92, .94, '#111', F); } });
  const f = pick(false, .8)[2]; if (f && k === 'kitchen') along(f.e, f.s[1] - .8, f.s[1] - .05, 0, .7, 0, 1.9, '#b9bcc0', F);
 } else if (k === 'utility' || k === 'wash') {
  const f = pick(false, .7)[0]; if (!f) return; if (k === 'utility') { along(f.e, f.s[0] + .05, f.s[0] + .65, 0, .6, 0, .85, '#f7f7f5', F); if (f.s[1] - f.s[0] > 1.4) along(f.e, f.s[0] + .7, f.s[0] + 1.3, 0, .6, 0, .85, '#f7f7f5', F); }
  else { along(f.e, f.s[0] + .05, Math.min(f.s[1], f.s[0] + 1.2) - .05, 0, .5, .75, .9, '#e9e6e0', F); }
 } else if (k === 'servant') {
  const f = pick(true, 1.9)[0]; if (!f) return; along(f.e, f.s[0] + .05, f.s[0] + 1.95, 0, .9, 0, .5, '#d8d2c8', F);
 } else if (k === 'livdin' || k === 'living' || k === 'drawing' || k === 'dining') {
  const longX = W >= D; const L = longX ? W : D;
  const zones = [];
  if (k === 'livdin' && L > 6) { const cut = (longX ? q[0] : q[1]) + L * .5; zones.push(['sofa', longX ? [q[0], q[1], cut, q[3]] : [q[0], q[1], q[2], cut]]); zones.push(['dine', longX ? [cut, q[1], q[2], q[3]] : [q[0], cut, q[2], q[3]]]); }
  else zones.push([k === 'dining' ? 'dine' : 'sofa', q]);
  zones.forEach(([z, zq]) => {
   const zw = zq[2] - zq[0], zd = zq[3] - zq[1], cx = (zq[0] + zq[2]) / 2, cy = (zq[1] + zq[3]) / 2;
   if (z === 'dine') {
    const tl = Math.min(2.2, Math.max(zw, zd) - 1.4), tw = 1.0; if (tl < 1) return; const hz = zw >= zd;
    const [x1, y1, x2, y2] = hz ? [cx - tl / 2, cy - tw / 2, cx + tl / 2, cy + tw / 2] : [cx - tw / 2, cy - tl / 2, cx + tw / 2, cy + tl / 2];
    F(x1, y1, x2, y2, .72, .76, '#4a3326'); F(cx - .25, cy - .25, cx + .25, cy + .25, 0, .72, '#2c2d30');
    const nC = Math.max(2, Math.floor(tl / .7));
    for (let i = 0; i < nC; i++) { const t = (i + .5) / nC; if (hz) { const x = x1 + (x2 - x1) * t; F(x - .22, y1 - .62, x + .22, y1 - .2, 0, .46, '#d6ccbf'); F(x - .22, y2 + .2, x + .22, y2 + .62, 0, .46, '#d6ccbf'); F(x - .22, y1 - .66, x + .22, y1 - .6, .46, .95, '#d6ccbf'); F(x - .22, y2 + .6, x + .22, y2 + .66, .46, .95, '#d6ccbf'); } else { const y = y1 + (y2 - y1) * t; F(x1 - .62, y - .22, x1 - .2, y + .22, 0, .46, '#d6ccbf'); F(x2 + .2, y - .22, x2 + .62, y + .22, 0, .46, '#d6ccbf'); F(x1 - .66, y - .22, x1 - .6, y + .22, .46, .95, '#d6ccbf'); F(x2 + .6, y - .22, x2 + .66, y + .22, .46, .95, '#d6ccbf'); } }
    F(cx - .1, cy - .1, cx + .1, cy + .1, 2.2, 2.25, '#c9a15a');
   } else {
    const zE = edgesOf(zq, v, wins).filter(e => Math.abs(e.c - (e.hz ? (e.n > 0 ? q[1] : q[3]) : (e.n > 0 ? q[0] : q[2]))) < .01);
    const cand = (zE.length ? zE : edgesOf(zq, v, wins)).map(e => ({ e, s: freeSpan(e, false) })).sort((a, b) => (b.s[1] - b.s[0]) - (a.s[1] - a.s[0]))[0];
    if (!cand) return; const e = cand.e, m = (cand.s[0] + cand.s[1]) / 2, sl = Math.min(2.8, cand.s[1] - cand.s[0] - .2); if (sl < 1.4) return;
    along(e, m - sl / 2, m + sl / 2, .05, .95, 0, .42, '#8d8378', F); along(e, m - sl / 2, m + sl / 2, .05, .28, .42, .85, '#8d8378', F);
    const dep = e.hz ? zd : zw; along(e, m - sl / 2 - .2, m + sl / 2 + .2, 1.1, Math.min(dep - .3, 3.6), 0, .012, '#9aa0a4', F); along(e, m - .55, m + .55, 1.45, 2.05, 0, .38, '#efede8', F);
    if (dep > 3.6) { along(e, m - sl / 2, m - sl / 2 + .8, 2.6, 3.4, 0, .42, '#b8865a', F); along(e, m + sl / 2 - .8, m + sl / 2, 2.6, 3.4, 0, .42, '#b8865a', F); }
   }
  });
 }
}

/* ================= realistic interiors for the selected flat ================= */
const ASSET = { ready: false, models: {}, box: {}, tex: {} };
const MODEL_LIST = ['modern_arm_chair_01', 'coffee_table_round_01', 'side_table_01', 'Ottoman_01', 'throw_pillows_01', 'potted_plant_02', 'potted_plant_04', 'ceramic_vase_01', 'brass_vase_01', 'carved_wooden_elephant', 'brass_diya_lantern', 'ceiling_fan', 'modern_ceiling_lamp_01', 'dining_chair_02', 'mid_century_lounge_chair', 'wicker_basket_02', 'wooden_bowl_01'];
let assetPromise = null;
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
function loadAssets() {
 if (assetPromise) return assetPromise;
 assetPromise = (async () => {
  try {
   await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
   await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/environments/RoomEnvironment.js');
  } catch (e) { return; }
  const pm = new T.PMREMGenerator(ren); ASSET.env = pm.fromScene(new T.RoomEnvironment(), .04).texture; scene.environment = ASSET.env;
  const tl = new T.TextureLoader();
  const names = ['marble_floor_d', 'marble_floor_n', 'teak_veneer_d', 'teak_veneer_n', 'walnut_veneer_d', 'walnut_veneer_n', 'kitchen_wood_d', 'kitchen_wood_n', 'rough_linen_g', 'rough_linen_n', 'velour_velvet_g', 'velour_velvet_n', 'hessian_230_g', 'floral_jacquard_g', 'fabric_leather_02_d', 'fabric_leather_02_n', 'interior_tiles_d', 'interior_tiles_n', 'wood_floor_deck_d', 'wood_floor_deck_n'];
  await Promise.all(names.map(n => new Promise(r => tl.load('assets/t/' + n + '.jpg', t => { t.wrapS = t.wrapT = T.RepeatWrapping; if (!n.endsWith('_n')) t.encoding = T.sRGBEncoding; t.anisotropy = 8; ASSET.tex[n] = t; r(); }, undefined, () => r()))));
  const L = new T.GLTFLoader();
  await Promise.all(MODEL_LIST.map(n => new Promise(r => L.load('assets/m/' + n + '.json', g => {
   g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { m.clippingPlanes = [CLIP]; }); } });
   ASSET.models[n] = g.scene; ASSET.box[n] = new T.Box3().setFromObject(g.scene); r();
  }, undefined, () => r()))));
  makeMats(); ASSET.ready = true;
 })();
 return assetPromise;
}
const PM = {};
function tm(d, n, tile, o = {}) {
 const m = new T.MeshStandardMaterial(Object.assign({ roughness: .8, clippingPlanes: [CLIP] }, o));
 const set = (k, t) => { if (!t) return; const c = t.clone(); c.needsUpdate = true; c.repeat.set(1 / tile, 1 / tile); m[k] = c; };
 set('map', ASSET.tex[d]); set('normalMap', ASSET.tex[n]); if (m.normalMap) m.normalScale = new T.Vector2(.7, .7);
 return m;
}
const solid = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: .6, clippingPlanes: [CLIP] }, o));
function makeMats() {
 // floors everywhere get real marble, tiles and deck
 const fl = (m, d, n, tile) => { const t = ASSET.tex[d]; if (!t) return; m.map = t.clone(); m.map.needsUpdate = true; m.map.repeat.set(1 / tile, 1 / tile); if (ASSET.tex[n]) { m.normalMap = ASSET.tex[n].clone(); m.normalMap.needsUpdate = true; m.normalMap.repeat.set(1 / tile, 1 / tile); m.normalScale = new T.Vector2(.5, .5); } m.roughness = d.startsWith('marble') ? .22 : .7; m.needsUpdate = true; };
 fl(M_MARBLE, 'marble_floor_d', 'marble_floor_n', 2.4); M_MARBLE.roughness = .1; M_MARBLE.envMapIntensity = 1.1;  // imported white marble, as the brochure specifies for living, bedrooms and kitchen fl(M_TILE, 'interior_tiles_d', 'interior_tiles_n', 1.2); fl(M_DECK, 'wood_floor_deck_d', 'wood_floor_deck_n', 1.6);
 Object.assign(PM, {
  teak: tm('teak_veneer_d', 'teak_veneer_n', 1.2, { roughness: .5 }),
  walnut: tm('walnut_veneer_d', 'walnut_veneer_n', 1.0, { roughness: .45 }),
  oak: tm('kitchen_wood_d', 'kitchen_wood_n', 1.4, { roughness: .55 }),
  linenIvory: tm('rough_linen_g', 'rough_linen_n', .5, { color: lin('#efe6d6'), roughness: .95 }),
  linenSand: tm('rough_linen_g', 'rough_linen_n', .5, { color: lin('#cdb894'), roughness: .95 }),
  linenWhite: tm('rough_linen_g', 'rough_linen_n', .5, { color: lin('#faf8f3'), roughness: .95 }),
  linenSage: tm('rough_linen_g', 'rough_linen_n', .5, { color: lin('#9aa58a'), roughness: .95 }),
  velvetTeal: tm('velour_velvet_g', 'velour_velvet_n', .6, { color: lin('#245d5a'), roughness: .75 }),
  velvetMustard: tm('velour_velvet_g', 'velour_velvet_n', .6, { color: lin('#c8922a'), roughness: .75 }),
  velvetRust: tm('velour_velvet_g', 'velour_velvet_n', .6, { color: lin('#a24f2c'), roughness: .75 }),
  velvetIndigo: tm('velour_velvet_g', 'velour_velvet_n', .6, { color: lin('#2c3a68'), roughness: .75 }),
  jacquard: tm('floral_jacquard_g', null, .5, { color: lin('#b5a690'), roughness: .9 }),
  leather: tm('fabric_leather_02_d', 'fabric_leather_02_n', 1, { roughness: .55 }),
  tile: tm('interior_tiles_d', 'interior_tiles_n', 1.2, { roughness: .35 }),
  marble: new T.MeshStandardMaterial({ map: (() => { const t = TEX.marble.clone(); t.needsUpdate = true; t.repeat.set(.6, .6); return t; })(), roughness: .18, clippingPlanes: [CLIP] }),
  granite: new T.MeshStandardMaterial({ map: canvasTex((g, s) => { g.fillStyle = '#16171a'; g.fillRect(0, 0, s, s); for (let i = 0; i < 2600; i++) { const v = rnd(); g.fillStyle = v < .7 ? `rgba(255,255,255,${.05 + rnd() * .12})` : `rgba(200,170,120,${.2 + rnd() * .3})`; g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 1 + rnd() * 2); } }, 256), roughness: .15, metalness: .1, clippingPlanes: [CLIP] }),
  brass: solid('#c9a14c', { metalness: 1, roughness: .28 }),
  steel: solid('#c8cbcf', { metalness: .9, roughness: .25 }),
  black: solid('#121314', { roughness: .2, metalness: .3 }),
  ceramic: solid('#f6f5f2', { roughness: .12 }),
  sageLam: solid('#7f8a6c', { roughness: .45 }),
  creamLam: solid('#ece6da', { roughness: .4 }),
  wall: solid('#f1ece4', { roughness: .9 }),
  mirror: solid('#d9e2e6', { metalness: 1, roughness: .04 }),
  glass: new T.MeshStandardMaterial({ color: lin('#cfe3ea'), transparent: true, opacity: .22, roughness: .05, depthWrite: false, clippingPlanes: [CLIP] }),
  sheer: new T.MeshStandardMaterial({ color: lin('#f3ede2'), transparent: true, opacity: .78, roughness: 1, side: T.DoubleSide, clippingPlanes: [CLIP] }),
  shade: new T.MeshStandardMaterial({ color: lin('#f4e6cc'), emissive: lin('#ffcf8a'), emissiveIntensity: .9, roughness: 1, side: T.DoubleSide, clippingPlanes: [CLIP] }),
  cove: new T.MeshBasicMaterial({ color: lin('#ffd9a0'), clippingPlanes: [CLIP] }),
  diya: new T.MeshBasicMaterial({ color: lin('#ffc46b'), clippingPlanes: [CLIP] }),
  rug1: new T.MeshStandardMaterial({ map: dhurrie(['#f1e7d4', '#2f3f6e', '#b5532d', '#d9a441']), roughness: 1, clippingPlanes: [CLIP] }),
  rug2: new T.MeshStandardMaterial({ map: dhurrie(['#e9dfcf', '#6b2f2a', '#2c5c5a', '#caa060']), roughness: 1, clippingPlanes: [CLIP] }),
  art1: new T.MeshStandardMaterial({ map: artCanvas(0), roughness: .9, clippingPlanes: [CLIP] }),
  art2: new T.MeshStandardMaterial({ map: artCanvas(1), roughness: .9, clippingPlanes: [CLIP] }),
  jaali: new T.MeshStandardMaterial({ map: ASSET.tex.teak_veneer_d, alphaMap: jaaliTex(), alphaTest: .5, side: T.DoubleSide, roughness: .5, clippingPlanes: [CLIP] }),
  flute: new T.MeshStandardMaterial({ map: (() => { const t = ASSET.tex.walnut_veneer_d.clone(); t.needsUpdate = true; t.repeat.set(1, 1); return t; })(), normalMap: fluteNormal(), roughness: .45, clippingPlanes: [CLIP] })
 });
 PM.flute.normalMap.repeat.set(14, 1);
}
function dhurrie(c) {
 return canvasTex((g, s) => {
  g.fillStyle = c[0]; g.fillRect(0, 0, s, s);
  const b = s * .07; g.fillStyle = c[1]; g.fillRect(0, 0, s, b); g.fillRect(0, s - b, s, b); g.fillStyle = c[2]; g.fillRect(0, b, s, b * .25); g.fillRect(0, s - b * 1.25, s, b * .25);
  const n = 5; for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const cx = s * (i + .5) / n, cy = s * (.3 + j * .2), r = s * .055; g.fillStyle = (i + j) % 2 ? c[1] : c[3]; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.fill(); g.fillStyle = c[0]; g.beginPath(); g.moveTo(cx, cy - r * .4); g.lineTo(cx + r * .4, cy); g.lineTo(cx, cy + r * .4); g.lineTo(cx - r * .4, cy); g.fill(); }
  for (let y = 0; y < s; y += 3) { g.fillStyle = `rgba(0,0,0,${.03 + rnd() * .04})`; g.fillRect(0, y, s, 1); }
  for (let i = 0; i < s; i += 6) { g.fillStyle = c[2]; g.fillRect(i, s - 3, 2, 3); g.fillRect(i, 0, 2, 3); }
 }, 512);
}
function artCanvas(k) {
 return canvasTex((g, s) => {
  const pal = k ? ['#e9dcc3', '#1f3b5c', '#c2562f', '#d8a23a', '#3e6b5a'] : ['#f0e2c8', '#7a2f2a', '#2f5d63', '#d79c3c', '#b8643c'];
  g.fillStyle = pal[0]; g.fillRect(0, 0, s, s);
  g.fillStyle = pal[3]; g.beginPath(); g.arc(s * .68, s * .32, s * .16, 0, 7); g.fill();
  for (let i = 0; i < 4; i++) { g.fillStyle = pal[1 + (i % 2) * 3]; g.globalAlpha = .85 - i * .12; g.beginPath(); g.moveTo(0, s * (.62 + i * .1)); for (let x = 0; x <= s; x += s / 8) g.quadraticCurveTo(x + s / 16, s * (.52 + i * .1 + (rnd() - .5) * .08), x + s / 8, s * (.62 + i * .1)); g.lineTo(s, s); g.lineTo(0, s); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = pal[2];
  for (let i = 0; i < 6; i++) { const cx = s * (.12 + i * .15), cy = s * (.86 + (i % 2) * .05); for (let p = 0; p < 5; p++) { g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 2 + (p - 2) * .38); g.beginPath(); g.ellipse(0, -s * .03, s * .012, s * .03, 0, 0, 7); g.fill(); g.restore(); } }
 }, 512);
}
function jaaliTex() {
 const t = canvasTex((g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); g.fillStyle = '#000'; const n = 6, c = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = i * c + c / 2, y = j * c + c / 2; g.beginPath(); g.moveTo(x, y - c * .36); g.lineTo(x + c * .36, y); g.lineTo(x, y + c * .36); g.lineTo(x - c * .36, y); g.fill(); g.beginPath(); g.arc(x + c / 2, y + c / 2, c * .12, 0, 7); g.fill(); } }, 256);
 t.encoding = T.LinearEncoding; t.repeat.set(1, 1); return t;
}
function fluteNormal() {
 const t = canvasTex((g, s) => { const img = g.createImageData(s, 8); for (let x = 0; x < s; x++) { const a = Math.sin(x / s * Math.PI * 2) * .8; const r = Math.round((a * .5 + .5) * 255); for (let y = 0; y < 8; y++) { const i = (y * s + x) * 4; img.data[i] = r; img.data[i + 1] = 128; img.data[i + 2] = 230; img.data[i + 3] = 255; } } for (let y = 0; y < s; y += 8) g.putImageData(img, 0, y); }, 128);
 t.encoding = T.LinearEncoding; return t;
}
/* geometry helpers (world-scaled UVs so textures keep real size) */
const GC = {};
function boxGeo(w, h, d) {
 const k = [w, h, d].map(v => v.toFixed(3)).join(); if (GC[k]) return GC[k];
 const g = new T.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
 for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const j = f * 4 + i; uv.setXY(j, uv.getX(j) * dims[f][0], uv.getY(j) * dims[f][1]); }
 return (GC[k] = g);
}
function rboxGeo(w, h, d, r) {
 const k = 'r' + [w, h, d, r].map(v => v.toFixed(3)).join(); if (GC[k]) return GC[k];
 r = Math.min(r, w / 2 - .005, h / 2 - .005, d / 2 - .005); const s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, Hh = h - 2 * r;
 s.moveTo(x, -h / 2); s.lineTo(x + W, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, y); s.lineTo(w / 2, y + Hh); s.quadraticCurveTo(w / 2, h / 2, x + W, h / 2); s.lineTo(x, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y + Hh); s.lineTo(-w / 2, y); s.quadraticCurveTo(-w / 2, -h / 2, x, -h / 2);
 const bv = Math.min(r * .8, d * .45); const g = new T.ExtrudeGeometry(s, { depth: Math.max(.001, d - 2 * bv), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * .9, bevelSegments: 4, curveSegments: 6 });
 g.center(); return (GC[k] = g);
}
let HG = null; // current hero group
function mk(geo, m, x, y, z, ry = 0, cast = true) { const me = new T.Mesh(geo, m); me.position.set(x, y, z); me.rotation.y = ry; me.castShadow = cast; me.receiveShadow = true; HG.add(me); return me; }
// frame: local (u along wall, v into room) -> plan coords; rotation so +Z faces into room
function frameOf(e) { const nx = e.hz ? 0 : e.n, nz = e.hz ? e.n : 0; return { rot: Math.atan2(nx, nz), P: (u, v) => e.hz ? [u, e.c + e.n * v] : [e.c + e.n * v, u] }; }
function boxAt(f, u, v, y, w, h, d, m, cast) { const [x, z] = f.P(u, v); return mk(boxGeo(w, h, d), m, x, y, z, f.rot, cast); }
function rboxAt(f, u, v, y, w, h, d, r, m) { const [x, z] = f.P(u, v); return mk(rboxGeo(w, h, d, r), m, x, y, z, f.rot); }
function model(name, f, u, v, y = 0, opt = {}) {
 const src = ASSET.models[name]; if (!src) return null; const b = ASSET.box[name], s = b.getSize(new T.Vector3()), c = b.getCenter(new T.Vector3());
 const k = opt.w ? opt.w / s.x : opt.h ? opt.h / s.y : opt.d ? opt.d / s.z : 1; const o = src.clone(true); o.scale.setScalar(k);
 const rot = f.rot + (opt.turn || 0); o.rotation.y = rot; const [x, z] = f.P(u, v); const ox = c.x * k, oz = c.z * k;
 o.position.set(x - (ox * Math.cos(rot) + oz * Math.sin(rot)), y - (opt.hang ? b.max.y * k : b.min.y * k), z - (-ox * Math.sin(rot) + oz * Math.cos(rot)));
 HG.add(o); return o;
}
const lights = [];
function lamp(x, z, y = 2.55, i = .55, d = 7) { const p = new T.PointLight(0xffd6a0, i, d, 2); p.position.set(x, y, z); HG.add(p); lights.push(p); }

/* ---- pieces ---- */
function sofa(f, u, v0, len, mat, pill) { // v0 = distance of sofa back from wall
 const D = .92, seatH = .42; boxAt(f, u, v0 + D / 2, .09, len, .18, D - .04, PM.teak);
 const n = len > 2.2 ? 3 : 2, cw = (len - .3) / n;
 for (let i = 0; i < n; i++) { const cu = u - (len - .3) / 2 + cw * (i + .5); rboxAt(f, cu, v0 + .5, .3, cw - .02, .2, .62, .06, mat); rboxAt(f, cu, v0 + .2, .62, cw - .04, .5, .2, .07, mat); }
 [-1, 1].forEach(sd => rboxAt(f, u + sd * (len / 2 - .08), v0 + D / 2, .38, .16, .5, D - .04, .05, mat));
 if (pill) [-1, 1].forEach(sd => model('throw_pillows_01', f, u + sd * (len / 2 - .5), v0 + .36, .4, { w: .62, turn: sd * .25 }));
}
function bed(f, u, len, wid, head, cover) {
 const plat = .28, mat = .24; boxAt(f, u, len / 2 + .06, plat / 2, wid + .1, plat, len, PM.walnut);
 rboxAt(f, u, len / 2 + .08, plat + mat / 2, wid - .04, mat, len - .1, .05, PM.linenWhite);
 rboxAt(f, u, len * .62 + .04, plat + mat + .03, wid + .04, .08, len * .74, .04, cover);
 boxAt(f, u, len * .78, plat + mat + .075, wid + .06, .015, .45, PM.velvetMustard);
 [-1, 1].forEach(sd => rboxAt(f, u + sd * wid / 4.2, .32, plat + mat + .09, wid / 2.4, .16, .42, .07, PM.linenWhite));
 model('throw_pillows_01', f, u, .58, plat + mat + .05, { w: .7 });
 rboxAt(f, u, .05, 1.0, wid + .5, 1.15, .1, .04, head); // upholstered headboard
}
function tableLamp(x, z, y) { mk(new T.CylinderGeometry(.06, .08, .32, 16), PM.brass, x, y + .16, z); mk(new T.CylinderGeometry(.14, .18, .24, 24, 1, true), PM.shade, x, y + .42, z); }
function floorLamp(x, z) { mk(new T.CylinderGeometry(.14, .16, .03, 20), PM.brass, x, .015, z); mk(new T.CylinderGeometry(.012, .012, 1.45, 8), PM.brass, x, .74, z); mk(new T.CylinderGeometry(.18, .23, .3, 24, 1, true), PM.shade, x, 1.55, z); }
function art(f, u, w, h, m) { boxAt(f, u, .03, 1.62, w + .06, h + .06, .04, PM.teak); boxAt(f, u, .055, 1.62, w, h, .01, m); }
function rug(x, z, w, d, rot, m) { mk(boxGeo(w, .012, d), m, x, .02, z, rot, false); }
function fan(x, z) { model('ceiling_fan', { rot: 0, P: () => [x, z] }, 0, 0, CH, { w: 1.2, hang: true }); }
function curtainsOn(e, lo, hi) { const f = frameOf(e); [[lo - .25, .5], [hi + .25, .5]].forEach(([u, w]) => { for (let i = 0; i < 4; i++) boxAt(f, u - w / 2 + (i + .5) * w / 4, .14 + (i % 2) * .05, CH / 2, w / 4 + .03, CH - .06, .03, PM.linenIvory, false); }); boxAt(f, (lo + hi) / 2, .12, CH - .06, hi - lo + 1.2, .03, .03, PM.brass); }
function tvWall(f, u, wid) { boxAt(f, u, .03, 1.35, wid, 2.7, .05, PM.flute); boxAt(f, u, .09, 1.3, Math.min(1.6, wid - .4), .9, .04, PM.black); boxAt(f, u, .26, .25, Math.min(2.0, wid), .4, .42, PM.teak); boxAt(f, u, .26, .46, Math.min(2.0, wid) + .02, .02, .44, PM.marble); model('ceramic_vase_01', f, u + Math.min(2, wid) / 2 - .25, .26, .47, { h: .32 }); }
function poojaUnit(f, u) {
 boxAt(f, u, .23, .45, 1.0, .9, .44, PM.teak); boxAt(f, u, .23, .91, 1.04, .03, .46, PM.marble);
 boxAt(f, u, .03, 1.65, 1.0, 1.4, .04, PM.jaali); boxAt(f, u, .015, 1.65, 1.04, 1.44, .01, PM.velvetMustard);
 model('brass_diya_lantern', f, u, .28, .93, { h: .36 }); model('brass_vase_01', f, u - .35, .25, .93, { h: .3 }); model('brass_vase_01', f, u + .35, .25, .93, { h: .3 });
 const [x, z] = f.P(u, .5); const p = new T.PointLight(0xffb45c, .5, 3.2, 2); p.position.set(x, 1.2, z); HG.add(p); lights.push(p);
}
function jhoola(f, u, v, w) {
 const seatY = .48, top = CH; boxAt(f, u, v, seatY, w, .06, .55, PM.teak); rboxAt(f, u, v + .02, seatY + .07, w - .08, .1, .48, .04, PM.velvetMustard);
 boxAt(f, u, v - .25, seatY + .35, w, .55, .05, PM.teak);
 [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([a, b]) => { const [x, z] = f.P(u + a * (w / 2 - .05), v + b * .25); mk(new T.CylinderGeometry(.008, .008, top - seatY, 6), PM.brass, x, (top + seatY) / 2, z); });
 model('throw_pillows_01', f, u - w / 4, v - .12, seatY + .1, { w: .5 });
}
/* ---- only furnish against edges where the approved drawing has a wall ---- */
function snapWall(e) {
 let best = null;
 for (const s of FLOOR.segs) { const hz = Math.abs(s.y1 - s.y2) < .03, vt = Math.abs(s.x1 - s.x2) < .03; if (e.hz ? !hz : !vt) continue; const c = e.hz ? s.y1 : s.x1, d = Math.abs(c - e.c); if (d > .45) continue; const a = Math.min(e.hz ? s.x1 : s.y1, e.hz ? s.x2 : s.y2), b = Math.max(e.hz ? s.x1 : s.y1, e.hz ? s.x2 : s.y2); const ov = Math.min(b, e.b) - Math.max(a, e.a); if (ov < Math.min(.8, e.len * .5)) continue; if (!best || d < best.d) best = { d, c, th: s.th || .12, a: Math.max(a, e.a), b: Math.min(b, e.b) }; }
 if (!best) return false;
 // keep only the stretch of this edge that real wall covers; gaps become blocked
 const iv = [];
 for (const s of FLOOR.segs) { const hz = Math.abs(s.y1 - s.y2) < .03, vt = Math.abs(s.x1 - s.x2) < .03; if (e.hz ? !hz : !vt) continue; if (Math.abs((e.hz ? s.y1 : s.x1) - best.c) > .04) continue; const a = Math.max(e.a, Math.min(e.hz ? s.x1 : s.y1, e.hz ? s.x2 : s.y2)), b = Math.min(e.b, Math.max(e.hz ? s.x1 : s.y1, e.hz ? s.x2 : s.y2)); if (b - a > .05) iv.push([a, b]); }
 iv.sort((p, q) => p[0] - q[0]); const mg = []; iv.forEach(([a, b]) => { if (mg.length && a <= mg[mg.length - 1][1] + .3) mg[mg.length - 1][1] = Math.max(mg[mg.length - 1][1], b); else mg.push([a, b]); });
 if (!mg.length) return false;
 const lo = mg[0][0], hi = mg[mg.length - 1][1]; for (let i = 0; i + 1 < mg.length; i++) e.blk.push([mg[i][1], mg[i + 1][0]]);
 if (lo > e.a + .05) e.blk.push([e.a, lo]); if (hi < e.b - .05) e.blk.push([hi, e.b]);
 e.c = best.c + e.n * (best.th / 2 + .005); return true;
}
const realEdges = (q, v, wins) => edgesOf(q, v, wins).filter(snapWall);
/* ---- room dressing ---- */
// utensil-wash counter: granite top with a deep double steel sink, faucet, dish rack and tiled dado — under a window when there is one;
// with laundry=true and room to spare, a front-load washer and basket share the wall. Returns the wall used.
function washCounter(E, laundry) {
 const c = E.map(e => ({ e, s: freeSpan(e, false) })).filter(x => x.s[1] - x.s[0] >= .9).sort((a, b) => (b.e.win.length ? 1 : 0) - (a.e.win.length ? 1 : 0) || (b.s[1] - b.s[0]) - (a.s[1] - a.s[0]))[0]; if (!c) return null;
 const f = frameOf(c.e), L = c.s[1] - c.s[0], wm = laundry && L > 2.2, cl = Math.min(1.6, L - (wm ? .8 : 0) - .05), cu = c.s[1] - cl / 2 - .02;
 boxAt(f, cu, .3, .43, cl, .86, .58, PM.creamLam); boxAt(f, cu, .31, .885, cl + .02, .04, .62, PM.granite);
 [-1, 1].forEach(sd => { if (cl > 1.0 || sd > 0) boxAt(f, cu + sd * (cl > 1.0 ? .25 : 0), .33, .9, .42, .012, .4, PM.black, false); });
 const [tx, tz] = f.P(cu, .1); mk(new T.CylinderGeometry(.014, .014, .32, 8), PM.steel, tx, 1.07, tz);
 if (!c.e.win.length) boxAt(f, cu, .13, 1.45, Math.min(.9, cl - .1), .38, .24, PM.steel);
 boxAt(f, cu, .012, 1.2, cl, .62, .015, PM.tile, false);
 if (wm) { rboxAt(f, c.s[0] + .35, .32, .43, .6, .85, .6, .04, PM.ceramic); const [wx, wz] = f.P(c.s[0] + .35, .63); const dm = mk(new T.CylinderGeometry(.2, .2, .03, 24), PM.black, wx, .48, wz); dm.rotation.x = Math.PI / 2; dm.rotation.z = f.rot; if (L > 2.9) model('wicker_basket_02', f, c.s[0] + .95, .3, 0, { h: .4 }); }
 return c;
}
// two rooms joined by a door or open arch on the plan
function linked(r1, r2, v) { return v.doors.some(q => { const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2, hzW = (q[3] - q[1]) < (q[2] - q[0]); return [.35, .5].some(d => { const p1 = hzW ? [cx, cy + d] : [cx + d, cy], p2 = hzW ? [cx, cy - d] : [cx - d, cy]; return (inRoom(r1, ...p1) && inRoom(r2, ...p2)) || (inRoom(r1, ...p2) && inRoom(r2, ...p1)); }); }); }
// full-height wardrobe: carcass, loft line, shutter joints and profile handles (frame f, centred at u along the wall)
function wardrobe(f, u, L, m) {
 const H = 2.7, D = .6, n = Math.max(2, Math.round(L / .55));
 boxAt(f, u, D / 2, H / 2, L, H, D, m || PM.walnut);
 boxAt(f, u, D + .004, 2.12, L - .02, .012, .012, PM.black, false);
 for (let i = 1; i < n; i++) boxAt(f, u - L / 2 + L * i / n, D + .004, H / 2, .008, H - .04, .012, PM.black, false);
 for (let i = 0; i < n; i++) { const cu = u - L / 2 + L * (i + .5) / n, sd = i % 2 ? -1 : 1; boxAt(f, cu - sd * (L / n / 2 - .06), D + .015, 1.2, .02, .7, .025, PM.brass, false); }
}
// world-space footprint of a box placed in an edge frame
function fp(f, u0, u1, v0, v1) { const a = f.P(u0, v0), b = f.P(u1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
const overlap = (p, q) => p[0] < q[2] - .01 && q[0] < p[2] - .01 && p[1] < q[3] - .01 && q[1] < p[3] - .01;
// door swings: the square each door sweeps into the room (kept clear of furniture)
function swings(E) { const o = []; E.forEach(e => { const f = frameOf(e); (e.dsw || []).forEach(([lo, hi]) => o.push(fp(f, lo - .05, hi + .05, 0, Math.min(1.0, hi - lo)))); }); return o; }
// best spot for a wardrobe on a real wall: longest whose body clears the hard obstacles (door swings, other wardrobes' fronts)
// and whose body + 60 cm standing space clears the soft ones (the bed and its walk-around); preferred walls first
function placeWardrobe(E, avoid, prefer, soft = []) {
 let best = null;
 E.forEach(x => { const s = freeSpan(x, true), f = frameOf(x), span = s[1] - s[0]; if (span < 1.2) return;
  for (let L = Math.min(2.4, span - .1); L >= 1.2; L -= .3) { let found = null; for (let u = s[0] + L / 2 + .05; u <= s[1] - L / 2 - .05 + 1e-6 && !found; u += .1) { if (!avoid.some(a => overlap(fp(f, u - L / 2, u + L / 2, 0, .6), a)) && !soft.some(a => overlap(fp(f, u - L / 2, u + L / 2, 0, 1.2), a))) found = u; }
   if (found !== null) { const sc = L + (prefer && prefer(x) ? .5 : 0); if (!best || sc > best.sc) best = { e: x, f, u: found, L, sc }; break; } }
 });
 return best;
}
function heroRoom(r, v, wins, U) {
 const k = r.k, q = innerRect(r), W = q[2] - q[0], D = q[3] - q[1]; if (W < .9 || D < .9) return;
 const E = realEdges(q, v, wins), cx = (q[0] + q[2]) / 2, cz = (q[1] + q[3]) / 2;
 const free = E.map(e => ({ e, s: freeSpan(e, false), sw: freeSpan(e, true) }));
 const best = (avoidWin, min) => free.filter(f => (f.s[1] - f.s[0]) >= min).sort((a, b) => (b.e.blk.length ? 0 : 2) + (avoidWin && !b.e.win.length ? 1 : 0) + (b.sw[1] - b.sw[0]) * .1 - ((a.e.blk.length ? 0 : 2) + (avoidWin && !a.e.win.length ? 1 : 0) + (a.sw[1] - a.sw[0]) * .1));
 const depth = e => e.hz ? D : W; const living = /livdin|living|drawing|dining/.test(k);
 // curtains on windows and sliders of living rooms and bedrooms
 if (living || k === 'bed') E.forEach(e => { e.win.concat(e.sd || []).forEach(([lo, hi]) => { if (hi - lo > .6) curtainsOn(e, lo + .1, hi - .1); }); });
 if (k === 'bed') {
  const isMaster = r.label === 'Master bedroom';
  const f0 = best(true, 2.2)[0]; if (!f0) return; const e = f0.e, s0 = f0.sw[1] - f0.sw[0] >= 2.4 ? f0.sw : f0.s, f = frameOf(e);
  const wid = e.len > 3.4 ? 1.83 : 1.52, len = Math.min(2.08, depth(e) - .7);
  // storage: every bedroom gets its closet — the plan's attached dress room, or a full-height wardrobe in the room.
  // Plan bed + wardrobe together: bed centred on its wall, else slid along it to free a corner for the wardrobe.
  const hasDress = U.rooms.some(x => x.k === 'dress' && linked(r, x, v)), sw0 = swings(E);
  const plan = sp => { const m = (sp[0] + sp[1]) / 2, sideT = sp[1] - sp[0] > wid + 1.3; const bedZone = fp(f, m - wid / 2 - (sideT ? .7 : .1), m + wid / 2 + (sideT ? .7 : .1), 0, len + .35), body = fp(f, m - wid / 2 - .1, m + wid / 2 + .1, 0, len + .1);
   return { sp, m, sideT, bedZone, body, wr: hasDress ? null : placeWardrobe(E.filter(x => x !== e), [...sw0, body], x => x.hz === e.hz, [bedZone]) }; };
  const opts = [s0, [s0[0] + 1.35, s0[1]], [s0[0], s0[1] - 1.35]].filter(sp => sp[1] - sp[0] >= wid + .1).map(plan);
  const P0 = hasDress ? opts[0] : opts.reduce((a, b) => ((b.wr ? b.wr.L : 0) > (a.wr ? a.wr.L : 0) + .25 ? b : a));
  const { sp: s, m, sideT, bedZone, wr } = P0, avoid = [...sw0, P0.body];
  boxAt(f, m, .02, 1.25, Math.min(s[1] - s[0], wid + 1.6), 2.5, .04, PM.flute);
  bed(f, m, len, wid, isMaster ? PM.velvetTeal : (r.label.endsWith('2') ? PM.velvetRust : PM.velvetIndigo), isMaster ? PM.linenSand : PM.linenSage);
  if (sideT) [-1, 1].forEach(sd => { const u = m + sd * (wid / 2 + .42); model('side_table_01', f, u, .26, 0, { w: .48 }); const [x, z] = f.P(u, .26); tableLamp(x, z, .55); });
  r.closet = hasDress ? 'dress room' : wr ? 'wardrobe ' + wr.L.toFixed(1) + ' m' : 'none';  // read by the checks
  if (wr) { wardrobe(wr.f, wr.u, wr.L, isMaster ? PM.walnut : PM.oak); avoid.push(fp(wr.f, wr.u - wr.L / 2, wr.u + wr.L / 2, 0, 1.2)); }
  if (depth(e) > len + 1.4) { const [x, z] = f.P(m, len + .7); rug(x, z, wid + 1.2, 1.4, f.rot, PM.rug2); if (isMaster) model('Ottoman_01', f, m, len + .45, 0, { w: .8 }); }
  const o = free.find(x => x.e !== e && x.e !== (wr && wr.e) && x.e.hz !== e.hz && x.s[1] - x.s[0] > 1.2);
  if (o && isMaster && depth(o.e) > 2.6) { const fo = frameOf(o.e), cu = o.s[1] - .65; if (![bedZone, ...avoid].some(a => overlap(fp(fo, cu - .5, cu + .5, 0, 1.1), a))) { model('mid_century_lounge_chair', fo, cu, .7, 0, { w: .82, turn: .5 }); floorLamp(...fo.P(o.s[1] - .2, .25)); } }
  const opp = E.find(x => x.hz === e.hz && x !== e); if (opp && opp !== (wr && wr.e) && !opp.win.length && freeSpan(opp, false)[1] - freeSpan(opp, false)[0] > 1.2) { const fs2 = freeSpan(opp, false); art(frameOf(opp), (fs2[0] + fs2[1]) / 2, Math.min(1.0, fs2[1] - fs2[0] - .5), .7, PM.art2); }
  fan(cx, cz); lamp(cx, cz, 2.5, .45);
 } else if (living) {
  const longX = W >= D, L = longX ? W : D, zones = [];
  if (k === 'livdin' && L > 6) { const cut = (longX ? q[0] : q[1]) + L * .52; zones.push(['sofa', longX ? [q[0], q[1], cut, q[3]] : [q[0], q[1], q[2], cut]]); zones.push(['dine', longX ? [cut, q[1], q[2], q[3]] : [q[0], cut, q[2], q[3]]]); }
  else zones.push([k === 'dining' ? 'dine' : 'sofa', q]);
  zones.forEach(([z, zq]) => {
   const zw = zq[2] - zq[0], zd = zq[3] - zq[1], zx = (zq[0] + zq[2]) / 2, zz = (zq[1] + zq[3]) / 2;
   if (z === 'dine') {
    const hz = zw >= zd, tl = Math.min(2.1, Math.max(zw, zd) - 1.5), tw = .95; if (tl < 1.1) return;
    const f = { rot: hz ? 0 : Math.PI / 2, P: (a, b) => hz ? [zx + a, zz + b] : [zx + b, zz + a] };
    const ft = { rot: 0, P: (a, b) => [zx + a, zz + b] };
    mk(boxGeo(hz ? tl : tw, .05, hz ? tw : tl), PM.teak, zx, .75, zz); [-1, 1].forEach(sd => mk(boxGeo(hz ? .06 : tw - .2, .72, hz ? tw - .2 : .06), PM.brass, zx + (hz ? sd * (tl / 2 - .25) : 0), .36, zz + (hz ? 0 : sd * (tl / 2 - .25))));
    const nC = Math.max(2, Math.min(4, Math.floor(tl / .62)));
    for (let i = 0; i < nC; i++) { const a = -tl / 2 + tl * (i + .5) / nC; [-1, 1].forEach(sd => { const turn = sd > 0 ? Math.PI : 0; model('dining_chair_02', { rot: (hz ? 0 : -Math.PI / 2) + turn, P: (u, w) => hz ? [zx + a, zz + sd * (tw / 2 + .32)] : [zx + sd * (tw / 2 + .32), zz + a] }, 0, 0, 0, { w: .5 }); }); }
    model('wooden_bowl_01', ft, 0, 0, .775, { w: .38 });
    [-1, 1].forEach(sd => { const [x, z] = hz ? [zx + sd * tl / 4, zz] : [zx, zz + sd * tl / 4]; model('modern_ceiling_lamp_01', { rot: 0, P: () => [x, z] }, 0, 0, CH, { h: .95, hang: true }); });
    lamp(zx, zz, 2.2, .5);
    // pooja unit on a free real wall of the dining zone
    const pe = realEdges(zq, v, wins).map(e => ({ e, s: freeSpan(e, true) })).filter(x => x.s[1] - x.s[0] > 1.3).sort((a, b) => (b.s[1] - b.s[0]) - (a.s[1] - a.s[0]))[0];
    if (pe && depth(pe.e) > tw + 2.2) poojaUnit(frameOf(pe.e), (pe.s[0] + pe.s[1]) / 2);
   } else {
    const zE = realEdges(zq, v, wins);
    const c = zE.map(e => ({ e, s: freeSpan(e, false), sw: freeSpan(e, true) })).sort((a, b) => (b.sw[1] - b.sw[0]) - (a.sw[1] - a.sw[0]))[0]; if (!c) return;
    const e = c.e, f = frameOf(e), sp = c.sw[1] - c.sw[0] > 2.2 ? c.sw : c.s, m = (sp[0] + sp[1]) / 2, sl = Math.min(2.7, sp[1] - sp[0] - .3); if (sl < 1.5) return;
    const dep = e.hz ? zd : zw;
    sofa(f, m, .04, sl, k === 'drawing' ? PM.velvetTeal : PM.linenIvory, true);
    if (!e.win.length || c.sw === sp) art(f, m, Math.min(1.4, sl - .4, sp[1] - sp[0] - .6), .85, k === 'drawing' ? PM.art2 : PM.art1);
    const ct = Math.min(1.5, dep - 1.1);
    model('coffee_table_round_01', f, m, .95 + .55, 0, { w: .95 });
    const [rx, rz] = f.P(m, 1.5); rug(rx, rz, Math.min(sl + .6, 3), Math.min(2.2, dep - 1.0), f.rot, k === 'drawing' ? PM.rug2 : PM.rug1);
    if (dep > 3.4) [-1, 1].forEach(sd => model('modern_arm_chair_01', { rot: f.rot + Math.PI + sd * .35, P: f.P }, m + sd * .75, 2.65, 0, { w: .78 }));
    else [-1, 1].forEach(sd => { if (sp[1] - sp[0] > sl + 1.8) model('modern_arm_chair_01', { rot: f.rot - sd * Math.PI / 2, P: f.P }, m + sd * (sl / 2 + .65), 1.1, 0, { w: .78 }); });
    const pcorner = sp[1] - sp[0] > sl + .9 ? sp[1] - .35 : null; if (pcorner) model('potted_plant_02', f, pcorner, .4, 0, { h: 1.0 }); floorLamp(...f.P(sp[0] + .25, .3));
    // TV / display wall opposite the sofa when that wall is real
    const opp = zE.find(x => x.hz === e.hz && x !== e);
    if (opp) { const os = freeSpan(opp, true); if (os[1] - os[0] > 1.6) { if (k === 'drawing') { const fo = frameOf(opp); boxAt(fo, (os[0] + os[1]) / 2, .03, 1.25, Math.min(1.4, os[1] - os[0] - .2), 2.3, .04, PM.jaali); boxAt(fo, (os[0] + os[1]) / 2, .22, .4, 1.3, .8, .4, PM.teak); model('carved_wooden_elephant', fo, (os[0] + os[1]) / 2 - .3, .22, .8, { h: .32 }); model('brass_vase_01', fo, (os[0] + os[1]) / 2 + .35, .22, .8, { h: .42 }); } else tvWall(frameOf(opp), (os[0] + os[1]) / 2, Math.min(2.6, os[1] - os[0] - .1)); } }
    fan(zx, zz); lamp(zx, zz, 2.5, .5);
    // false-ceiling cove with warm LED strip
    const ins = .45; [[zq[0] + ins, zq[1] + ins, zq[2] - ins, zq[1] + ins + .05], [zq[0] + ins, zq[3] - ins - .05, zq[2] - ins, zq[3] - ins], [zq[0] + ins, zq[1] + ins, zq[0] + ins + .05, zq[3] - ins], [zq[2] - ins - .05, zq[1] + ins, zq[2] - ins, zq[3] - ins]].forEach(([a, b, c2, d]) => mk(boxGeo(c2 - a, .02, d - b), PM.cove, (a + c2) / 2, CH - .01, (b + d) / 2, 0, false));
   }
  });
 } else if (k === 'kitchen' || k === 'wetk') {
  const runs = best(false, 1.2).slice(0, 2);
  runs.forEach((x, i) => { const f = frameOf(x.e), a = x.s[0] + .02, b = x.s[1] - .02, L = b - a, m = (a + b) / 2;
   boxAt(f, m, .29, .05, L, .1, .5, PM.black); boxAt(f, m, .3, .47, L, .74, .58, i ? PM.creamLam : PM.sageLam);
   for (let u = a + .45; u < b - .2; u += .45) boxAt(f, u, .595, .47, .006, .7, .01, PM.black, false);
   boxAt(f, m, .31, .87, L + .02, .04, .64, PM.granite); boxAt(f, m, .015, 1.2, L, .6, .02, PM.tile);
   if (i === 0) { boxAt(f, m, .18, 1.85, L, .7, .36, PM.creamLam); const hm = a + Math.min(L * .35, 1.0); boxAt(f, hm, .32, .9, .75, .01, .5, PM.black); [[-.18, -.1], [.18, -.1], [-.18, .12], [.18, .12]].forEach(([du, dv]) => { const [x2, z2] = f.P(hm + du, .32 + dv); mk(new T.CylinderGeometry(.05, .05, .02, 16), PM.brass, x2, .915, z2); }); boxAt(f, hm, .25, 1.55, .9, .1, .5, PM.steel); boxAt(f, hm, .14, 1.85, .3, .5, .25, PM.steel);
    const sm = b - Math.min(L * .3, .9); boxAt(f, sm, .32, .885, .7, .01, .42, PM.steel); const [x3, z3] = f.P(sm, .1); mk(new T.CylinderGeometry(.012, .012, .3, 8), PM.brass, x3, 1.05, z3); }
  });
  const fr = best(false, .8)[2]; if (fr && k === 'kitchen') boxAt(frameOf(fr.e), fr.s[1] - .42, .37, .95, .76, 1.9, .72, PM.steel);
  const sq = sideRect(r); if (sq) washCounter(realEdges(sq, v, wins), false);
  lamp(cx, cz, 2.6, .45);
 } else if (k === 'toilet') {
  E.forEach(e => { const f = frameOf(e); let cur = e.a; e.blk.slice().sort((p, q2) => p[0] - q2[0]).forEach(([lo, hi]) => { if (lo - cur > .05) boxAt(f, (cur + lo) / 2, .008, 1.05, lo - cur, 2.1, .015, PM.tile, false); cur = Math.max(cur, hi); }); if (e.b - cur > .05) boxAt(f, (cur + e.b) / 2, .008, 1.05, e.b - cur, 2.1, .015, PM.tile, false); });
  const fs = best(false, .9); if (!fs.length) return; const e1 = fs[0], f1 = frameOf(e1.e), u1 = e1.s[0] + .45;
  rboxAt(f1, u1, .3, .42, .38, .32, .52, .12, PM.ceramic); boxAt(f1, u1, .05, .95, .5, .7, .1, PM.ceramic);
  const e2 = fs[1] || fs[0], f2 = frameOf(e2.e), u2 = e2.s[1] - .55, vw = Math.min(.9, e2.s[1] - e2.s[0] - .2);
  boxAt(f2, u2, .26, .62, vw, .42, .5, PM.walnut); boxAt(f2, u2, .27, .845, vw + .02, .03, .52, PM.marble);
  const [bx, bz] = f2.P(u2, .27); mk(new T.SphereGeometry(.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, -.55, 1), PM.ceramic, bx, .97, bz);
  boxAt(f2, u2, .015, 1.5, vw, .8, .015, PM.mirror); const [tx, tz] = f2.P(u2, .1); mk(new T.CylinderGeometry(.012, .012, .2, 8), PM.brass, tx, .97, tz);
  const opp = E.find(x => x.hz === e1.e.hz && x !== e1.e); if (opp && !opp.blk.length) { const fo = frameOf(opp); boxAt(fo, opp.a + (opp.b - opp.a) * .42, .95, 1.0, (opp.b - opp.a) * .84, 2.0, .015, PM.glass, false); const [sx, sz] = fo.P(opp.a + (opp.b - opp.a) * .45, .45); mk(new T.CylinderGeometry(.13, .13, .015, 24), PM.steel, sx, 2.25, sz); }
  lamp(cx, cz, 2.5, .3, 4);
 } else if (k === 'dress') {
  const avoid = swings(E); let n = 0;
  for (let i = 0; i < 2; i++) { const w = placeWardrobe(E, avoid, null); if (!w) break; wardrobe(w.f, w.u, w.L, PM.walnut); avoid.push(fp(w.f, w.u - w.L / 2, w.u + w.L / 2, 0, 1.2)); n++; }
  const fm = free.filter(x => !x.e.win.length).sort((a, b) => (b.s[1] - b.s[0]) - (a.s[1] - a.s[0]))[0]; if (fm) { const ff = frameOf(fm.e), mu = (fm.s[0] + fm.s[1]) / 2; if (!avoid.some(a => overlap(fp(ff, mu - .3, mu + .3, 0, .3), a))) boxAt(ff, mu, .015, 1.25, .55, 1.6, .02, PM.mirror); }
  lamp(cx, cz, 2.5, .3, 4);
 } else if (k === 'utility' || k === 'wash') {
  const x = washCounter(E, k === 'utility'); if (!x) return; const f = frameOf(x.e);
  // drying lines across the ceiling
  [.35, .75].forEach(dv => { const a = f.P(x.s[0] + .2, dv), b = f.P(x.s[1] - .2, dv), L = Math.hypot(b[0] - a[0], b[1] - a[1]); const c = mk(new T.CylinderGeometry(.012, .012, L, 6), PM.steel, (a[0] + b[0]) / 2, 2.6, (a[1] + b[1]) / 2, 0, false); c.rotation.z = Math.PI / 2; c.rotation.y = f.rot + Math.PI / 2; });
 } else if (k === 'servant') {
  const x = best(true, 1.9)[0]; if (!x) return; const f = frameOf(x.e), u = x.s[0] + 1.0; boxAt(f, u, .47, .2, 1.9, .4, .92, PM.teak); rboxAt(f, u, .47, .48, 1.86, .16, .88, .04, PM.linenSage);
 }
}
function heroBalcony(g) {
 const b = g.rects.reduce((p, q) => (q[2] - q[0]) * (q[3] - q[1]) > (p[2] - p[0]) * (p[3] - p[1]) ? q : p), w = b[2] - b[0], d = b[3] - b[1], hz = w >= d;
 const door = g.doors[0]; const f = { rot: hz ? 0 : Math.PI / 2, P: (u, v) => hz ? [b[0] + u, b[1] + v] : [b[0] + v, b[1] + u] }; const L = hz ? w : d, Dd = hz ? d : w;
 if (Dd >= 1.5 && L >= 2.4 && door) {
  // jhoola facing into the flat
  const outSide = door.hz ? (door.c < (b[1] + b[3]) / 2 ? 1 : -1) : (door.c < (b[0] + b[2]) / 2 ? 1 : -1);
  const fj = { rot: hz ? (outSide > 0 ? Math.PI : 0) : (outSide > 0 ? -Math.PI / 2 : Math.PI / 2), P: f.P };
  jhoola(fj, L / 2, Dd / 2, Math.min(1.4, L - 1.0));
  model('potted_plant_02', f, .45, Dd - .4, 0, { h: .9 }); model('potted_plant_02', f, L - .45, .4, 0, { h: .8 }); model('wicker_basket_02', f, L - .4, Dd - .35, 0, { h: .35 });
 } else { model('potted_plant_02', f, L / 2, Dd / 2, 0, { h: Math.min(.8, Dd * .7) }); if (L > 2) model('potted_plant_04', f, L - .35, Dd / 2, 0, { h: .3 }); }
}
function buildHero() {
 if (!FLOOR) return;
 if (FLOOR.hero) { FLOOR.grp.remove(FLOOR.hero); FLOOR.hero = null; lights.length = 0; }
 Object.values(FLOOR.furnU || {}).forEach(m => m.visible = true);
 const U = FLOOR.units[sel.u]; if (!U) return;
 if (!ASSET.ready) { loadAssets().then(() => { if (FLOOR && FLOOR.units[sel.u] === U) buildHero(); }); return; }
 HG = new T.Group(); FLOOR.hero = HG; FLOOR.grp.add(HG); HG.visible = $('#furn').checked;
 (FLOOR.furnU[U.id] || {}).visible = false;
 U.rooms.forEach(r => { const n0 = HG.children.length; try { heroRoom(r, FLOOR.v, FLOOR.wins, U); } catch (e) { console.warn('room', r.label, e); } r.heroN = HG.children.length - n0; });
 FLOOR.BG.forEach((g, gi) => { const b = g.box; if (b[0] < U.box[2] + 2.5 && b[2] > U.box[0] - 2.5 && b[1] < U.box[3] + 2.5 && b[3] > U.box[1] - 2.5 && (g.doors.length || true)) { const near = U.rooms.some(r => Math.max(r.r[0] - b[2], b[0] - r.r[2], r.r[1] - b[3], b[1] - r.r[3]) < 1.2 && !r.staff); if (!near) return; if (FLOOR.furnU['b' + gi]) FLOOR.furnU['b' + gi].visible = false; try { heroBalcony(g); } catch (e) { console.warn('balcony', e); } } });
 sectionCaps(HG);
 furnitureFootprints(HG);
 applyLights();
}
// the dollhouse view slices the flat at 1.35 m: anything taller (wardrobes, fridges, headboards) would show as an empty shell from above.
// give every solid that crosses the cut a dark back-face 'poché' so it reads as a cut solid, like a section drawing. Hidden while walking.
const CAP_M = new T.MeshBasicMaterial({ color: 0x3a312b });
function sectionCaps(G) {
 // a flat dark section face laid at the cut height across each solid that rises through it (only upright pieces; models keep their own look)
 const caps = G.userData.caps = [], cut = 1.34;
 G.children.forEach(o => { if (!o.isMesh || Math.abs(o.rotation.x) > 1e-6 || Math.abs(o.rotation.z) > 1e-6) return; const m = o.material; if (m.transparent || m.side !== T.FrontSide || m.alphaTest) return;
  const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox, sy = o.scale.y;
  if (o.position.y + b.min.y * sy > cut - .02 || o.position.y + b.max.y * sy < cut + .02) return;
  const w = b.max.x - b.min.x, d = b.max.z - b.min.z; if (w < .005 || d < .005) return;
  const c = new T.Mesh(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), CAP_M); c.position.set((b.min.x + b.max.x) / 2, (cut - o.position.y) / sy, (b.min.z + b.max.z) / 2); c.userData.cap = 1; o.add(c); caps.push(c); });
 applyCaps();
}
// every piece of furniture that stands on the floor is solid to the walker: its footprint (plan frame) is recorded here
function furnitureFootprints(G) {
 const out = FLOOR.furnRects = [], bb = new T.Box3(); FLOOR.grp.updateWorldMatrix(true, true); const O = FLOOR.grp.getWorldPosition(new T.Vector3());
 G.children.forEach(o => { if (o.userData.cap) return; const ms = []; o.traverse(m => { if (m.isMesh) ms.push(...(Array.isArray(m.material) ? m.material : [m.material])); }); if (!ms.length || ms.every(m => m.transparent)) return;
  bb.setFromObject(o); const y0 = bb.min.y - O.y, y1 = bb.max.y - O.y; if (y0 > .45 || y1 < .3) return;   // rugs, wall art, fans and lights don't block
  const r = [bb.min.x - O.x + .03, bb.min.z - O.z + .03, bb.max.x - O.x - .03, bb.max.z - O.z - .03]; if (r[2] - r[0] < .04 || r[3] - r[1] < .04) return; r.o = o; out.push(r); });
 // guarantee: no furniture stands in a doorway or the 60 cm in front of it (placement rules should already prevent this)
 const U = FLOOR.units[sel.u], keep = U ? approachZones(FLOOR.v, FLOOR.wins).map(z => { const w = z[2] - z[0], h = z[3] - z[1]; return w > h ? [z[0] + .1, z[1] + .3, z[2] - .1, z[3] - .3] : [z[0] + .3, z[1] + .1, z[2] - .3, z[3] - .1]; }).filter(z => z[0] < U.box[2] + 1 && z[2] > U.box[0] - 1 && z[1] < U.box[3] + 1 && z[3] > U.box[1] - 1) : [];
 FLOOR.furnRects = out.filter(r => { if (!keep.some(z => z[0] < r[2] && r[0] < z[2] && z[1] < r[3] && r[1] < z[3])) return true; G.remove(r.o); FLOOR.furnDropped = (FLOOR.furnDropped || 0) + 1; return false; });
 if (U) ensureAccess(U, G);
}
// guarantee: from the front door a person can walk into every room and sit-out of the flat. If furniture walls something off,
// the smallest pieces in the way are taken out (decor goes before beds, counters and wardrobes) until everything is reachable.
function ensureAccess(U, G) {
 const res = .15, R = .22, x0 = U.box[0] - 1.5, z0 = U.box[1] - 1.5, nx = Math.ceil((U.box[2] - U.box[0] + 3) / res), nz = Math.ceil((U.box[3] - U.box[1] + 3) / res), N = nx * nz;
 const wall = new Uint8Array(N), occ = new Uint16Array(N), X = i => x0 + (i + .5) * res, Z = j => z0 + (j + .5) * res;
 for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) wall[j * nx + i] = blocked(X(i), Z(j)) ? 1 : 0;
 const cellsOf = q => { const c = []; for (let j = Math.max(0, Math.floor((q[1] - R - z0) / res)); j < Math.min(nz, Math.ceil((q[3] + R - z0) / res)); j++) for (let i = Math.max(0, Math.floor((q[0] - R - x0) / res)); i < Math.min(nx, Math.ceil((q[2] + R - x0) / res)); i++) { const dx = Math.max(q[0] - X(i), 0, X(i) - q[2]), dz = Math.max(q[1] - Z(j), 0, Z(j) - q[3]); if (dx * dx + dz * dz < R * R) c.push(j * nx + i); } return c; };
 const mine = FLOOR.furnRects.filter(q => q[0] < U.box[2] + 1 && q[2] > U.box[0] - 1 && q[1] < U.box[3] + 1 && q[3] > U.box[1] - 1); mine.forEach(q => { q.cells = cellsOf(q); q.cells.forEach(k => occ[k]++); });
 const targets = U.rooms.map(r => { const c = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (!wall[j * nx + i] && inRoom(r, X(i), Z(j))) c.push(j * nx + i); return { r, c }; }).filter(t => t.c.length);
 FLOOR.BG.forEach(g => { if (g.doors.length && g.box[0] < U.box[2] + 2 && g.box[2] > U.box[0] - 2 && g.box[1] < U.box[3] + 2 && g.box[3] > U.box[1] - 2) { const c = []; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (!wall[j * nx + i] && g.rects.some(q => inRect(q, X(i), Z(j), 0))) c.push(j * nx + i); if (c.length) targets.push({ g, c }); } });
 const starts = U.door ? [U.door.inside, U.door.outside].map(p => Math.floor((p[1] - z0) / res) * nx + Math.floor((p[0] - x0) / res)).filter(k => k >= 0 && k < N && !wall[k]) : [];
 const reach = () => { const seen = new Uint8Array(N), q = starts.filter(k => !occ[k]); q.forEach(k => seen[k] = 1); while (q.length) { const k = q.pop(), i = k % nx, j = (k - i) / nx; for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) { if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const m = b * nx + a; if (seen[m] || wall[m] || occ[m]) continue; seen[m] = 1; q.push(m); } } return targets.filter(t => !t.c.some(k => seen[k])).length; };
 if (!starts.length) return; let miss = reach(); if (!miss) return;
 const cands = mine.slice().sort((p, q) => (p[2] - p[0]) * (p[3] - p[1]) - (q[2] - q[0]) * (q[3] - q[1]));
 for (const q of cands) { if (!miss) break; q.cells.forEach(k => occ[k]--); const m2 = reach(); if (m2 < miss) { miss = m2; G.remove(q.o); FLOOR.furnRects.splice(FLOOR.furnRects.indexOf(q), 1); FLOOR.furnDropped = (FLOOR.furnDropped || 0) + 1; } else q.cells.forEach(k => occ[k]++); }
 if (miss) console.warn('access', U.id, miss, 'areas still closed off');
}
function applyCaps() { const inside = mode === 'walk' || mode === 'tour'; ((FLOOR && FLOOR.hero && FLOOR.hero.userData.caps) || []).forEach(c => c.visible = !inside); }
function applyLights() { const inside = mode === 'walk' || mode === 'tour'; lights.forEach(l => l.visible = inside); }

/* ================= lights / sky / sun ================= */
const skyU = { top: { value: new T.Color() }, bot: { value: new T.Color() } };
const sky = new T.Mesh(new T.SphereGeometry(12000, 32, 16), new T.ShaderMaterial({ uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false, vertexShader: 'varying vec3 w;void main(){w=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 top;uniform vec3 bot;varying vec3 w;void main(){float h=clamp(w.y*1.8+.12,0.,1.);gl_FragColor=vec4(mix(bot,top,pow(h,.8)),1.);}' }));
scene.add(sky);
const hemi = new T.HemisphereLight(0xdfe9f3, 0x6b6256, .55); scene.add(hemi);
const amb = new T.AmbientLight(0xffffff, .16); scene.add(amb);
const sun = new T.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
const fill = new T.PointLight(0xffeedd, 0, 10, 2); scene.add(fill);
const LAT = 17.4 * Math.PI / 180, NORTH_ROT = 8.5 * Math.PI / 180; let sunDir = new T.Vector3(0, 1, 0);
function setSun() {
 const t = +$('#tod').value, dec = +$('#season').value * Math.PI / 180, h = (t - 12) * 15 * Math.PI / 180;
 const alt = Math.asin(Math.sin(LAT) * Math.sin(dec) + Math.cos(LAT) * Math.cos(dec) * Math.cos(h));
 const A = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(LAT) - Math.tan(dec) * Math.cos(LAT));
 sunDir.set(-Math.sin(A) * Math.cos(alt), Math.sin(alt), Math.cos(A) * Math.cos(alt));
 // the approved plan's grid sits about 8.5° clockwise of true north (fitted to the OpenStreetMap roads and plots): turn the sun into the plan's frame
 { const c = Math.cos(NORTH_ROT), s = Math.sin(NORTH_ROT), x = sunDir.x, z = sunDir.z; sunDir.x = x * c + z * s; sunDir.z = -x * s + z * c; }
 const day = T.MathUtils.clamp(Math.sin(alt) * 2.2, 0, 1), gold = T.MathUtils.clamp(1 - Math.sin(alt) * 3.2, 0, 1);
 sun.intensity = alt > 0 ? 2.6 * day : 0; sun.color.setRGB(1, .93 - .25 * gold, .84 - .45 * gold);
 const top = new T.Color('#0c1426').lerp(new T.Color('#4f86c6'), day), bot = new T.Color('#1d2740').lerp(new T.Color('#d8e3ea'), day).lerp(new T.Color('#f3b783'), gold * day * .85);
 skyU.top.value.copy(top); skyU.bot.value.copy(bot); scene.fog.color.copy(bot);
 const ins = mode === 'walk' || mode === 'tour'; hemi.intensity = (ins ? .32 : .2) + (ins ? .25 : .45) * day; amb.intensity = ins ? .06 : .1 + .1 * day; ren.toneMappingExposure = .85 + .25 * day;
 const hh = Math.floor(t), mm = Math.round((t - hh) * 60); $('#todv').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
 const az = (A * 180 / Math.PI + 180 + 360) % 360, dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
 $('#sunread').textContent = alt > 0 ? `Sun ${Math.round(alt * 180 / Math.PI)}° above the horizon, in the ${dirs[Math.round(az / 45) % 8]}.` : 'The sun is below the horizon.';
 placeSun();
}
function placeSun() {
 const inside = mode !== 'site'; const tgt = inside && FLOOR ? new T.Vector3(TW[sel.t].c[0], lvl(sel.n), TW[sel.t].c[1]) : new T.Vector3(SITE_C[0], 0, SITE_C[2]);
 const R = inside ? 45 : 180; Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 1, far: 2600 }); sun.shadow.camera.updateProjectionMatrix();
 sun.target.position.copy(tgt); sun.position.copy(tgt).addScaledVector(sunDir, 1200);
}
$('#tod').addEventListener('input', setSun); $('#season').addEventListener('change', setSun);

/* ================= labels ================= */
const LBL = $('#labels');
const siteLabels = [];
for (const t of 'ABC') { const d = document.createElement('div'); d.className = 'lb t'; d.textContent = TW[t].name; LBL.appendChild(d); siteLabels.push({ d, p: [TW[t].c[0], TOP + 14, TW[t].c[1]] }); }
{ const d = document.createElement('div'); d.className = 'lb a'; d.textContent = 'Clubhouse (G+6)'; LBL.appendChild(d); siteLabels.push({ d, p: [CLUB[0], CLUB[4] + 6, CLUB[1]] }); }
AMEN.forEach(([n, x, z]) => { const d = document.createElement('div'); d.className = 'lb a'; d.textContent = n; LBL.appendChild(d); siteLabels.push({ d, p: [x, 3, z] }); });
const tv = new T.Vector3(); let occTick = 0;
const TOWER_BOXES = 'ABC'.split('').map(t => { const s = TW[t].size, c = TW[t].c; return new T.Box3(new T.Vector3(c[0] - s[0] / 2, 0, c[1] - s[1] / 2), new T.Vector3(c[0] + s[0] / 2, TOP, c[1] + s[1] / 2)); });
function placeLabels() {
 const show = $('#lbl').checked; const w = innerWidth, h = innerHeight;
 const put = (l, vis, base) => { if (!vis) { l.d.style.display = 'none'; return; } tv.set(l.p[0] + base[0], l.p[1] + base[1], l.p[2] + base[2]).project(cam); if (tv.z > 1 || Math.abs(tv.x) > 1.1 || Math.abs(tv.y) > 1.1) { l.d.style.display = 'none'; return; } l.d.style.display = 'block'; l.d.style.left = (tv.x * .5 + .5) * w + 'px'; l.d.style.top = (-tv.y * .5 + .5) * h + 'px'; };
 siteLabels.forEach(l => put(l, show && mode === 'site', [0, 0, 0]));
 const lmOn = show && city.visible && mode !== 'floor'; landmarks.forEach(l => put(l, lmOn, [0, 0, 0]));
 // hide landmarks behind a tower (checked a few times a second; the tower you stand in doesn't count)
 if (lmOn && (occTick = (occTick + 1) % 12) === 0) { const ray = new T.Ray(), hit = new T.Vector3(), here = cam.position;
  const own = TOWER_BOXES.concat(occBoxes); const inside = mode === 'walk' || mode === 'tour';
  // indoors, the flat's own walls, ceiling, floor and furniture hide what they would hide (glass doesn't)
  if (inside && FLOOR && FLOOR.occFor !== FLOOR.heroFor + '|' + (FLOOR.hero ? FLOOR.hero.children.length : 0)) { FLOOR.occFor = FLOOR.heroFor + '|' + (FLOOR.hero ? FLOOR.hero.children.length : 0); FLOOR.occ = []; FLOOR.grp.traverse(o => { if (!o.isMesh || o.userData.cap) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m.transparent && m.visible !== false) FLOOR.occ.push(o); }); }
  const rc = new T.Raycaster(); landmarks.forEach(l => { const tgt = new T.Vector3(...l.p), dist = here.distanceTo(tgt), dir = tgt.clone().sub(here).normalize(); ray.set(here, dir);
   l.occ = own.some(bx => !bx.containsPoint(here) && ray.intersectBox(bx, hit) && here.distanceTo(hit) < dist - 8);
   // the slab above (ceiling) and below (floor) of this storey cover the whole floor plate and its balconies
   if (!l.occ && inside && FLOOR) { const y0 = FLOOR.grp.position.y, yy = dir.y > 0 ? y0 + CH : y0; if (Math.abs(dir.y) > 1e-4) { const t = (yy - here.y) / dir.y; if (t > 0 && t < dist) { const px = here.x + dir.x * t - FLOOR.grp.position.x, pz = here.z + dir.z * t - FLOOR.grp.position.z; if (pip(FLOOR.v.plate, px, pz) || FLOOR.v.balc.some(b => inRect(b, px, pz, .05))) l.occ = true; } } }
   if (!l.occ && inside && FLOOR) { rc.set(here, dir); rc.far = Math.min(dist - 1, 120); l.occ = rc.intersectObjects(FLOOR.occ.filter(o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }), false).length > 0; } }); }
 landmarks.forEach(l => { if (l.occ && lmOn) l.d.style.display = 'none'; });
 // keep the nearest landmark when two would overlap
 if (lmOn) { const placed = []; landmarks.filter(l => l.d.style.display === 'block').map(l => ({ l, d: cam.position.distanceTo(tv.set(...l.p)) })).sort((p, q) => p.d - q.d).forEach(({ l }) => { const x = parseFloat(l.d.style.left), y = parseFloat(l.d.style.top), w2 = l.d.offsetWidth / 2 + 4, h2 = l.d.offsetHeight / 2 + 2; if (placed.some(p => Math.abs(p[0] - x) < p[2] + w2 && Math.abs(p[1] - y) < p[3] + h2)) l.d.style.display = 'none'; else placed.push([x, y, w2, h2]); }); }
 if (FLOOR) { const b = FLOOR.grp.position; FLOOR.labels.forEach(l => put(l, show && mode === 'floor' && (l.kind === 'unit' ? !sel.u || orb.r > 55 || l.u !== sel.u : l.kind === 'free' || (sel.u && l.u === sel.u && orb.r < 70)), [b.x, b.y, b.z])); }
}

/* ================= selection / state ================= */
const sel = { t: START.t, n: START.f, u: null };
let mode = 'site';
const orb = { tx: SITE_C[0], ty: 40, tz: SITE_C[2], th: .55, ph: .98, r: 470 }; const orbT = Object.assign({}, orb);
const walker = { x: 0, z: 0, yaw: 0, pitch: -.05 };
function refreshTowers() { for (const t of 'ABC') towerMassing(t, (mode !== 'site' && t === sel.t) ? { n: sel.n } : null); applyVisibility(); }
function applyVisibility() {
 const inside = mode === 'walk' || mode === 'tour';
 if (FLOOR) { FLOOR.grp.visible = mode !== 'site'; CLIP.constant = inside ? 1e4 : lvl(sel.n) + 1.35; FLOOR.furn.visible = $('#furn').checked; if (FLOOR.hero) FLOOR.hero.visible = $('#furn').checked; if (FLOOR.leaves) FLOOR.leaves.visible = inside; applyCaps(); }
 applyLights();
 const g = towerGrp[sel.t]; if (g && g.userData.above) { g.userData.above.visible = inside; const { sl, gl, balcAboveFrom, total } = g.userData; sl.count = gl.count = inside ? total : balcAboveFrom; }
 city.visible = $('#city').checked;
}
function selectFloor(t, n, keepUnit) {
 sel.t = t; sel.n = n; const v = variantFor(t, n);
 if (!keepUnit || !v.rooms.some(r => r.u === sel.u)) sel.u = (v.rooms.find(r => r.u) || {}).u || null;
 buildFloor(t, n); refreshTowers(); renderUI();
 if (mode === 'floor') focusUnit(); if (mode === 'walk') startWalk(); if (mode === 'tour') startTour();
 placeSun();
}
function focusUnit() {
 const c = TW[sel.t].c, y = lvl(sel.n);
 if (sel.u && FLOOR.units[sel.u]) { const b = FLOOR.units[sel.u].box, O = TW[sel.t].O; Object.assign(orbT, { tx: O[0] + (b[0] + b[2]) / 2, ty: y, tz: O[1] + (b[1] + b[3]) / 2, r: 30, ph: Math.min(orbT.ph, .85) }); }
 else Object.assign(orbT, { tx: c[0], ty: y, tz: c[1], r: 70, ph: .8 });
}
function setMode(m) {
 const prev = mode; mode = m;
 document.querySelectorAll('#modes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m));
 const inside = m === 'walk' || m === 'tour';
 cv.classList.toggle('walk', inside); $('#hud').style.display = inside ? 'block' : 'none'; $('#pad').style.display = m === 'walk' ? 'flex' : 'none'; $('#cap').style.display = m === 'tour' ? 'block' : 'none'; $('#tourbar').style.display = m === 'tour' ? 'flex' : 'none';
 if ((prev === 'site') !== (m === 'site')) refreshTowers(); else applyVisibility();
 if (m === 'site') Object.assign(orbT, { tx: SITE_C[0], ty: 40, tz: SITE_C[2], r: 470, ph: .98 });
 if (m === 'floor') { focusUnit(); if (prev !== 'floor') orbT.ph = .82; }
 if (m === 'walk') startWalk(); if (m === 'tour') startTour();
 cam.fov = inside ? 70 : 45; cam.near = inside ? .1 : m === 'floor' ? .5 : 2; cam.updateProjectionMatrix();  // a larger near plane in the aerial views keeps distant roads and parks from flickering setSun(); lastRoom = undefined;
 document.querySelectorAll('#acts [data-m]').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === m)); syncHash();
 landmarks.forEach(l => l.occ = true); occTick = 11;  // hidden until the next visibility check, so no label flashes through a wall
}
document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.m)));

/* ================= UI ================= */
$('#towers').innerHTML = 'ABC'.split('').map(t => `<button data-t="${t}" aria-pressed="false">${TW[t].name}</button>`).join('');
$('#towers').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; selectFloor(b.dataset.t, sel.n, false); if (mode === 'site') setMode('floor'); });
const setN = n => { n = Math.max(1, Math.min(56, n)); if (n !== sel.n) selectFloor(sel.t, n, true); };
$('#fdn').addEventListener('click', () => setN(sel.n - 1)); $('#fup').addEventListener('click', () => setN(sel.n + 1));
let rT; $('#frange').addEventListener('input', e => { $('#fval').textContent = e.target.value; clearTimeout(rT); rT = setTimeout(() => setN(+e.target.value), 150); });
$('#units').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; sel.u = b.dataset.u; renderUI(); if (mode === 'site') setMode('floor'); else if (mode === 'floor') focusUnit(); else if (mode === 'walk') startWalk(); else startTour(); if (innerWidth <= 860) togglePanel(false); });
$('#rooms').addEventListener('click', e => { const b = e.target.closest('button'); if (!b || !FLOOR) return; const r = FLOOR.v.rooms[+b.dataset.i]; const c = labelPoint(r); if (mode !== 'walk') setMode('walk'); placeWalker(c[0], c[1], r); if (innerWidth <= 860) togglePanel(false); });
let lastHash = '', linkReady = false;
function syncHash() { if (!linkReady) return; const u = FLOOR && FLOOR.units[sel.u]; if (!u) return; const h = `#${sel.t}-${u.flat}${mode === 'walk' || mode === 'tour' ? '/' + mode : ''}`; if (h !== location.hash) { lastHash = h; try { history.replaceState(null, '', h); } catch (e) { } } }
// select a flat from what someone typed; returns false (with a note under the box) when the approved plan has no such flat
function goFlat(q, quiet) {
 const p = parseFlat(q); const err = t => { if (!quiet) $('#ferr').textContent = t; return false; };
 if (!p) return err('Type a flat number like B-2904: floor 29, flat 4 in Bella.');
 const towers = p.t ? [p.t] : [sel.t, ...'ABC'.split('').filter(t => t !== sel.t)];
 const t = towers.find(t => Object.keys(META).some(k => k[0] === t && META[k][2] === p.no)); if (!t) return err(p.t ? `${TW[p.t].name} has flats ${p.t === 'B' ? '01–06' : '01–04'} on each floor, so there is no ${p.t}-${p.n * 100 + p.no}.` : `No tower has a flat ending in ${String(p.no).padStart(2, '0')}: Aura and Clara have 01–04 on each floor, Bella 01–06.`);
 const v = variantFor(t, p.n), id = [...new Set(v.rooms.map(r => r.u).filter(Boolean))].find(u => META[u] && META[u][2] === p.no);
 if (!id) return err(`On floor ${p.n}, ${TW[t].name}'s flat ${p.no} is refuge or service space on the approved plan.`);
 $('#ferr').textContent = ''; sel.u = id; selectFloor(t, p.n, true);
 if (!FLOOR.units[id]) { sel.u = Object.keys(FLOOR.units).sort()[0] || null; renderUI(); if (mode === 'site') setMode('floor'); return err(`On floor ${p.n}, ${TW[t].name}'s flat ${p.no} is refuge or service space on the approved plan.`); }
 if (mode === 'site') setMode('floor'); else if (mode === 'floor') focusUnit(); return true;
}
$('#find').addEventListener('submit', e => { e.preventDefault(); if (goFlat($('#fq').value)) $('#fq').blur(); });
$('#acts').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'share') { syncHash(); const url = location.href; const done = () => { b.textContent = 'Link copied'; setTimeout(() => b.textContent = 'Copy link', 1800); }; try { navigator.clipboard.writeText(url).then(done, () => { $('#ferr').textContent = url; }); } catch (er) { $('#ferr').textContent = url; } return; } $('#ferr').textContent = ''; setMode(b.dataset.m); });
function renderUI() {
 document.querySelectorAll('#towers button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === sel.t));
 $('#fval').textContent = sel.n; $('#frange').value = sel.n;
 const v = variantFor(sel.t, sel.n); const typ = TW[sel.t].typ; const allU = [...new Set(typ.rooms.map(r => r.u).filter(Boolean))].sort();
 const here = new Set(v.rooms.map(r => r.u)); const missing = allU.filter(u => !here.has(u));
 $('#fnote').textContent = v === typ ? '' : `Special floor on the approved plan${missing.length ? `: flat ${missing.map(u => sel.n * 100 + META[u][2]).join(', ')} is replaced by refuge or service space` : ''}.`;
 const U = FLOOR.units; const ids = Object.keys(U).sort((a, b) => U[a].no - U[b].no);
 $('#units').innerHTML = ids.map(id => { const u = U[id]; return `<button data-u="${id}" class="${id === sel.u ? 'on' : ''}"><b>${u.flat}</b><span>${u.beds} BHK${u.face ? ' · ' + u.face + '-facing' : ''}</span><i>${u.size ? fmt(u.size) + ' sft' : ''}</i></button>`; }).join('');
 const u = U[sel.u];
 $('#sel').textContent = u ? `${TW[sel.t].name} · Floor ${sel.n} · Flat ${u.flat}` : `${TW[sel.t].name} · Floor ${sel.n}`; if (u) $('#fq').placeholder = `Find a flat · now showing ${sel.t}-${u.flat}`; syncHash();
 if (u) {
  const carpet = Math.round(u.area * 10.764);
  $('#stats').innerHTML = `<div><b>${u.size ? fmt(u.size) : '–'}</b><span>sft saleable</span></div><div><b>${fmt(carpet)}</b><span>sft rooms (approved)</span></div><div><b>${u.beds} BHK</b><span>+ staff room</span></div><div><b>+${lvl(sel.n).toFixed(1)} m</b><span>floor level</span></div>`;
  $('#roomsh').textContent = `Rooms in ${u.flat}`;
  const order = ['livdin', 'living', 'drawing', 'dining', 'kitchen', 'wetk', 'utility', 'wash', 'bed', 'dress', 'toilet', 'servant', 'pooja', 'store', 'other'];
  const rs = FLOOR.v.rooms.map((r, i) => [r, i]).filter(([r]) => r.u === sel.u).sort((a, b) => order.indexOf(a[0].k) - order.indexOf(b[0].k) || roomArea(b[0]) - roomArea(a[0]));
  $('#rooms').innerHTML = rs.map(([r, i]) => `<button data-i="${i}">${r.label}<span>${r.d ? `${r.d[0].toFixed(2)}×${r.d[1].toFixed(2)} m · ${ftin(r.d[0])}×${ftin(r.d[1])}` : Math.round(roomArea(r) * 10.764) + ' sft'}</span></button>`).join('');
  const ratio = u.size ? u.size / carpet : 0;
  $('#check').innerHTML = (ratio > 1.66 ? `<b>Doesn't add up:</b> the rooms on the approved plan total ${fmt(carpet)} sft, low for a ${fmt(u.size)} sft flat (most flats here would have about ${fmt(Math.round(u.size / 1.55))}). Ask the builder for the carpet area on this flat's agreement.` : `The rooms on the approved plan add up to ${fmt(carpet)} sft, against ${u.size ? fmt(u.size) + ' sft saleable' : 'no published size'}. The carpet area in an agreement is usually within a few percent of this, because it is measured to the wall faces.`);
 } else { $('#stats').innerHTML = ''; $('#rooms').innerHTML = ''; $('#check').textContent = ''; }
 if (FLOOR && FLOOR.heroFor !== sel.u) { FLOOR.heroFor = sel.u; buildHero(); }
}
function togglePanel(open) { $('#panel').classList.toggle('open', open); $('#menu').setAttribute('aria-expanded', open); $('#menu').textContent = open ? 'Close' : 'Towers & flats'; }
$('#menu').addEventListener('click', () => togglePanel(!$('#panel').classList.contains('open')));
$('#furn').addEventListener('change', applyVisibility); $('#city').addEventListener('change', applyVisibility);

/* ================= walking ================= */
function startWalk() {
 const U = FLOOR && FLOOR.units[sel.u]; if (!U) return;
 if (U.door) { walker.x = U.door.outside[0]; walker.z = U.door.outside[1]; walker.yaw = Math.atan2(-(U.door.inside[0] - U.door.outside[0]), -(U.door.inside[1] - U.door.outside[1])); }
 else { walker.x = (U.box[0] + U.box[2]) / 2; walker.z = (U.box[1] + U.box[3]) / 2; }
 walker.pitch = -.05; lastRoom = undefined;
}
function blocked(x, z) {
 const v = FLOOR.v; if (!pip(v.plate, x, z) && !v.balc.some(b => inRect(b, x, z, .35))) return true;
 const r = .22;  // half shoulder width: passes a 75 cm toilet door, as a person does
 for (const [x1, y1, x2, y2, th] of FLOOR.coll) { const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-9; let t = ((x - x1) * dx + (z - y1) * dy) / L2; t = Math.max(0, Math.min(1, t)); const px = x1 + dx * t - x, pz = y1 + dy * t - z; if (px * px + pz * pz < (r + th / 2) ** 2) return true; }
 return false;
}
// how deep (m) a walker of radius r standing at x,z sits inside furniture; 0 when clear
function furnPen(x, z, r = .22) { let p = 0; for (const q of (FLOOR && FLOOR.furnRects) || []) { const dx = Math.max(q[0] - x, 0, x - q[2]), dz = Math.max(q[1] - z, 0, z - q[3]), d = Math.hypot(dx, dz); if (d < r) p = Math.max(p, r - d + (dx === 0 && dz === 0 ? Math.min(x - q[0], q[2] - x, z - q[1], q[3] - z) : 0)); } return p; }
const free = (x, z) => !blocked(x, z) && furnPen(x, z) === 0;
// nearest spot where a person can actually stand (clear of walls and furniture), preferring the same room
function standSpot(x, z, room) { if (free(x, z)) return [x, z]; for (let rad = .1; rad <= 3; rad += .1) { const n = Math.max(8, Math.round(rad * 40)); let alt = null; for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (!free(px, pz)) continue; if (!room || inRoom(room, px, pz)) return [px, pz]; alt = alt || [px, pz]; } if (alt && rad > 1.5) return alt; } return [x, z]; }
function placeWalker(x, z, room) { const p = standSpot(x, z, room); walker.x = p[0]; walker.z = p[1]; }
// shortest walkable route between two points on a 15 cm grid (walls and furniture are obstacles), smoothed to straight runs
function route(a, b) {
 const res = .15, x0 = Math.min(a[0], b[0]) - 6, z0 = Math.min(a[1], b[1]) - 6, nx = Math.ceil((Math.abs(a[0] - b[0]) + 12) / res), nz = Math.ceil((Math.abs(a[1] - b[1]) + 12) / res); if (nx * nz > 160000) return [b];
 const id = (i, j) => j * nx + i, cell = p => [Math.round((p[0] - x0) / res), Math.round((p[1] - z0) / res)], pt = (i, j) => [x0 + i * res, z0 + j * res];
 const [si, sj] = cell(a), [gi, gj] = cell(b), okc = new Int8Array(nx * nz).fill(-1), ok = (i, j) => { const k = id(i, j); if (okc[k] < 0) { const [x, z] = pt(i, j); okc[k] = free(x, z) ? 1 : 0; } return okc[k] === 1; };
 const g = new Float32Array(nx * nz).fill(Infinity), from = new Int32Array(nx * nz).fill(-1), open = [[0, si, sj]]; g[id(si, sj)] = 0; let found = false, it = 0;
 while (open.length && it++ < 60000) { let bi = 0; for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k; const [, i, j] = open.splice(bi, 1)[0]; if (i === gi && j === gj) { found = true; break; }
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a2 = i + di, b2 = j + dj; if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue; if (!(a2 === gi && b2 === gj) && !ok(a2, b2)) continue; if (di && dj && (!ok(i + di, j) || !ok(i, j + dj))) continue;
   const ng = g[id(i, j)] + Math.hypot(di, dj); if (ng < g[id(a2, b2)]) { g[id(a2, b2)] = ng; from[id(a2, b2)] = id(i, j); open.push([ng + Math.hypot(gi - a2, gj - b2), a2, b2]); } } }
 if (!found) return [b];
 const path = []; for (let k = id(gi, gj); k >= 0 && k !== id(si, sj); k = from[k]) path.push(pt(k % nx, Math.floor(k / nx))); path.reverse(); if (!path.length) return [b];
 const clear = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L / .08); for (let k = 1; k < n; k++) { const t = k / n; if (!free(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return false; } return true; };
 const out = []; let cur = a; for (let k = 0; k < path.length; k++) { if (k === path.length - 1 || !clear(cur, path[k + 1])) { out.push(path[k]); cur = path[k]; } } out[out.length - 1] = b; return out;
}
const keys = {};
addEventListener('keydown', e => { if (/INPUT|SELECT|BUTTON/.test(e.target.tagName) && e.target.type !== 'checkbox') { if (e.target.tagName !== 'BUTTON') return; } keys[e.key.toLowerCase()] = 1; if (mode === 'walk' && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) e.preventDefault(); });
addEventListener('keyup', e => keys[e.key.toLowerCase()] = 0);
document.querySelectorAll('#pad button').forEach(b => { const k = 'pad_' + b.dataset.k; b.addEventListener('pointerdown', e => { e.preventDefault(); keys[k] = 1; }); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, () => keys[k] = 0)); });
function walkStep(dt) {
 let f = 0, s = 0, turn = 0;
 if (keys.w || keys.arrowup || keys.pad_f) f++; if (keys.s || keys.arrowdown || keys.pad_b) f--; if (keys.a) s--; if (keys.d) s++;
 if (keys.arrowleft || keys.pad_tl || keys.q) turn++; if (keys.arrowright || keys.pad_tr || keys.e) turn--;
 walker.yaw += turn * dt * 1.6; if (!f && !s) return;
 const sp = (keys.shift ? 3.6 : 1.8) * dt, fx = -Math.sin(walker.yaw), fz = -Math.cos(walker.yaw);
 const dx = (fx * f - fz * s) * sp, dz = (fz * f + fx * s) * sp;
 // walls always stop you; furniture stops you walking into it (but never traps you if you start inside it)
 const can = (x, z) => !blocked(x, z) && furnPen(x, z) <= furnPen(walker.x, walker.z) + 1e-4;
 if (can(walker.x + dx, walker.z)) walker.x += dx; if (can(walker.x, walker.z + dz)) walker.z += dz;
}

/* ================= tour (generated from the door graph) ================= */
let TOUR = [], tourI = 0, tourHold = 0, tourPaused = false, tourCap = '';
function startTour() {
 TOUR = buildTour(); TOUR.forEach(w => w.done = false); tourI = 0; tourHold = 0; tourPaused = false; tourCap = ''; $('#tplay').textContent = 'Pause';
 if (TOUR.length) { placeWalker(TOUR[0].p[0], TOUR[0].p[1]); walker.yaw = Math.atan2(-(TOUR[0].l[0] - walker.x), -(TOUR[0].l[1] - walker.z)); walker.pitch = -.05; }
 lastRoom = undefined;
}
function buildTour() {
 const U = FLOOR.units[sel.u]; if (!U) return []; const v = FLOOR.v;
 const nodes = U.rooms.map(r => ({ r, p: labelPoint(r), adj: [] }));
 const nodeAt = (x, y) => nodes.find(nd => nd.r && inRoom(nd.r, x, y));
 FLOOR.BG.forEach(g => { const b = g.box; if (b[0] < U.box[2] + 2.5 && b[2] > U.box[0] - 2.5 && b[1] < U.box[3] + 2.5 && b[3] > U.box[1] - 2.5) { const big = g.rects.reduce((p, q) => (q[2] - q[0]) * (q[3] - q[1]) > (p[2] - p[0]) * (p[3] - p[1]) ? q : p); nodes.push({ balc: b, g, p: [(big[0] + big[2]) / 2, (big[1] + big[3]) / 2], adj: [] }); } });
 const nodeAt2 = (x, y) => nodeAt(x, y) || nodes.find(nd => nd.g && nd.g.rects.some(q => inRect(q, x, y, .02)));
 const link = (a, b, pa, pb) => { if (!a || !b || a === b || a.adj.some(x => x.n === b)) return; a.adj.push({ n: b, pa, pb }); b.adj.push({ n: a, pa: pb, pb: pa }); };
 v.doors.forEach(q => { const cx = (q[0] + q[2]) / 2, cy = (q[1] + q[3]) / 2, hzW = (q[3] - q[1]) < (q[2] - q[0]); const nx = hzW ? 0 : 1, ny = hzW ? 1 : 0; for (const d of [.95, 1.25, .7, .5]) { const p1 = [cx + nx * d, cy + ny * d], p2 = [cx - nx * d, cy - ny * d]; const a = nodeAt2(...p1), b = nodeAt2(...p2); if (a && b) { link(a, b, p1, p2); break; } } });
 FLOOR.wins.filter(w => w.bal).forEach(w => { const a = nodeAt2(...w.pin), b = nodeAt2(...w.pout); if (a && b) link(a, b, w.pin, w.pout); });
 FLOOR.wins.filter(w => w.k === 'SD' && !w.bal).forEach(w => { const m = (w.a + w.b) / 2; for (const sg of [1, -1]) { const p1 = w.hz ? [m, w.c + sg * .6] : [w.c + sg * .6, m], p2 = w.hz ? [m, w.c - sg * .9] : [w.c - sg * .9, m]; const a = nodeAt2(...p1), b = nodeAt2(...p2); if (a && b) { link(a, b, p1, p2); break; } } });
 // open plan: connect rooms that touch with no wall (polygon living etc.) when no door joins them — via label points if both are big living spaces
 const pr = { livdin: 0, living: 1, drawing: 2, dining: 3, kitchen: 5, wetk: 6, utility: 7, wash: 6, bed: 8, dress: 9, toilet: 10, servant: 12 };
 const start = U.door ? nodeAt2(...U.door.inside) || nodes.reduce((a, b) => Math.hypot(b.p[0] - U.door.inside[0], b.p[1] - U.door.inside[1]) < Math.hypot(a.p[0] - U.door.inside[0], a.p[1] - U.door.inside[1]) ? b : a) : nodes[0];
 const way = []; const cap = nd => nd.balc ? `${nd.g.doors.length ? 'Sit-out' : 'Balcony'}, ${(nd.balc[2] - nd.balc[0]).toFixed(2)} × ${(nd.balc[3] - nd.balc[1]).toFixed(2)} m` : `${nd.r.label}${nd.r.d ? `, ${nd.r.d[0].toFixed(2)} × ${nd.r.d[1].toFixed(2)} m (${ftin(nd.r.d[0])} × ${ftin(nd.r.d[1])})` : ''}`;
 const look = (nd, from) => { const dx = nd.p[0] - from[0], dy = nd.p[1] - from[1], L = Math.hypot(dx, dy) || 1; return [nd.p[0] + dx / L * 4, nd.p[1] + dy / L * 4]; };
 if (U.door) { way.push({ p: U.door.outside, l: U.door.inside, c: `Flat ${U.flat}, entrance from the lift lobby`, h: 1.4 }); way.push({ p: U.door.inside, l: start.p, c: '', h: 0 }); }
 const seen = new Set();
 const visit = (nd, from) => {
  seen.add(nd); way.push({ p: nd.p, l: look(nd, from), c: cap(nd), h: nd.balc ? 2.2 : (nd.r && /toilet|dress|utility|wash/.test(nd.r.k) ? 1.4 : 2.4) });
  nd.adj.filter(x => !seen.has(x.n)).sort((a, b) => (pr[a.n.r && a.n.r.k] ?? 4) - (pr[b.n.r && b.n.r.k] ?? 4)).forEach(x => {
   if (seen.has(x.n)) return; way.push({ p: x.pa, l: x.pb, c: '', h: 0 }); way.push({ p: x.pb, l: x.n.p, c: '', h: 0 });
   visit(x.n, x.pb);
   way.push({ p: x.pb, l: x.pa, c: '', h: 0 }); way.push({ p: x.pa, l: nd.p, c: '', h: 0 }); way.push({ p: nd.p, l: nd.p, c: '', h: 0 });
  });
 };
 visit(start, U.door ? U.door.inside : start.p);
 // rooms not reachable through drawn doors (open-plan): visit directly afterwards
 nodes.filter(nd => !seen.has(nd) && nd.r && !/toilet|dress/.test(nd.r.k)).sort((a, b) => (a.r.staff ? 1 : 0) - (b.r.staff ? 1 : 0)).forEach(nd => { seen.add(nd); way.push({ p: nd.p, l: look(nd, [nd.p[0] - 1, nd.p[1] - 1]), c: cap(nd) + (nd.r.staff ? ', entered from the common lobby' : ''), h: 2.2, jump: true }); });
 return way;
}
function tourStep(dt) {
 if (tourPaused) return; const w = TOUR[tourI];
 // each stop is moved to a real standing spot and routed around furniture when it comes up (furniture may load after the tour starts)
 if (w && !w.snapped) { w.snapped = true; w.p = standSpot(w.p[0], w.p[1], FLOOR.v.rooms.find(r => r.u === sel.u && inRoom(r, ...w.p))); }
 if (w && w.jump && !w.done) { w.done = true; walker.x = w.p[0]; walker.z = w.p[1]; walker.yaw = Math.atan2(-(w.l[0] - w.p[0]), -(w.l[1] - w.p[1])); }
 if (!w) { tourPaused = true; $('#tplay').textContent = 'Replay'; $('#cap').textContent = 'That is the whole flat. Switch to Walk to explore on your own.'; return; }
 if (!w.route) w.route = route([walker.x, walker.z], w.p);
 while (w.route.length > 1 && Math.hypot(w.route[0][0] - walker.x, w.route[0][1] - walker.z) < .08) w.route.shift();
 const tgt = w.route[0] || w.p, dx = tgt[0] - walker.x, dz = tgt[1] - walker.z, dd = Math.hypot(dx, dz), d = w.route.length > 1 ? dd + 1 : dd;
 const lk = d > .6 ? [tgt[0] + dx / (dd || 1) * 2, tgt[1] + dz / (dd || 1) * 2] : w.l;
 const want = Math.atan2(-(lk[0] - walker.x), -(lk[1] - walker.z)); let dy = want - walker.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); walker.yaw += dy * Math.min(1, dt * (d > .6 ? 3.2 : 2.4)); walker.pitch += (-.05 - walker.pitch) * dt * 2;
 if (d > .06) { const sp = Math.min(dd, 1.5 * dt); if (dd > 1e-6) { walker.x += dx / dd * sp; walker.z += dz / dd * sp; } }
 else { if (w.c && tourCap !== w.c) { tourCap = w.c; $('#cap').textContent = w.c; } tourHold += dt; if (tourHold >= w.h + (w.h ? .8 : 0)) { tourI++; tourHold = 0; } }
}
$('#tplay').addEventListener('click', () => { if (!TOUR[tourI]) { startTour(); return; } tourPaused = !tourPaused; $('#tplay').textContent = tourPaused ? 'Play' : 'Pause'; });
$('#trestart').addEventListener('click', startTour);

/* ================= input ================= */
const ptrs = new Map(); let pinch = 0, moved = 0;
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button, s: e.shiftKey }); moved = 0; if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } if (mode === 'tour') { tourPaused = true; $('#tplay').textContent = 'Play'; } });
cv.addEventListener('pointermove', e => {
 const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
 if (ptrs.size === 2) { p.x = e.clientX; p.y = e.clientY; const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch && (mode === 'site' || mode === 'floor')) orbT.r = T.MathUtils.clamp(orbT.r * pinch / d, 8, 1400); pinch = d; return; }
 p.x = e.clientX; p.y = e.clientY;
 if (mode === 'walk' || mode === 'tour') { walker.yaw += dx * .0045; walker.pitch = T.MathUtils.clamp(walker.pitch + dy * .0035, -1.2, 1.2); return; }
 if (p.b === 2 || p.s) { const k = orbT.r * .0016, c = Math.cos(orbT.th), s = Math.sin(orbT.th); orbT.tx += (-c * dx - s * dy) * k; orbT.tz += (s * dx - c * dy) * k; }
 else { orbT.th -= dx * .006; orbT.ph = T.MathUtils.clamp(orbT.ph - dy * .005, .03, 1.48); }
});
const ray = new T.Raycaster(), ndc = new T.Vector2();
function floorHit(e) { if (!FLOOR || mode !== 'floor') return null; ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.intersectObjects(FLOOR.floorMeshes)[0]; }
cv.addEventListener('pointerup', e => { const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId); pinch = 0; if (was && moved < 6) { const h = floorHit(e); if (h && h.object.userData.u && h.object.userData.u !== sel.u) { sel.u = h.object.userData.u; renderUI(); focusUnit(); } } });
cv.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = 0; });
cv.addEventListener('dblclick', e => { const h = floorHit(e); if (!h) return; const loc = FLOOR.grp.worldToLocal(h.point.clone()); if (h.object.userData.u) sel.u = h.object.userData.u; renderUI(); setMode('walk'); placeWalker(loc.x, loc.z); walker.yaw = orb.th; });
cv.addEventListener('wheel', e => { e.preventDefault(); if (mode === 'walk' || mode === 'tour') { cam.fov = T.MathUtils.clamp(cam.fov + e.deltaY * .03, 35, 85); cam.updateProjectionMatrix(); return; } orbT.r = T.MathUtils.clamp(orbT.r * Math.exp(e.deltaY * .0012), 8, 1400); }, { passive: false });

/* ================= mini plan ================= */
const mmc = $('#mmc'), mg = mmc.getContext('2d');
let MM = { s: 1, x0: 0, y0: 0 };
function drawMM() {
 if (!FLOOR) return; const v = FLOOR.v, Wc = mmc.width, Hc = mmc.height;
 const xs = v.plate.map(p => p[0]).concat(v.balc.flatMap(b => [b[0], b[2]])), ys = v.plate.map(p => p[1]).concat(v.balc.flatMap(b => [b[1], b[3]]));
 const x0 = Math.min(...xs) - 1, x1 = Math.max(...xs) + 1, y0 = Math.min(...ys) - 1, y1 = Math.max(...ys) + 1; const s = Math.min(Wc / (x1 - x0), Hc / (y1 - y0)); MM = { s, x0: x0 - (Wc / s - (x1 - x0)) / 2, y0: y0 - (Hc / s - (y1 - y0)) / 2 };
 const P = (x, y) => [(x - MM.x0) * s, (y - MM.y0) * s];
 mg.clearRect(0, 0, Wc, Hc);
 mg.fillStyle = '#2a2f37'; mg.beginPath(); v.plate.forEach((p, i) => { const q = P(p[0], p[1]); i ? mg.lineTo(...q) : mg.moveTo(...q); }); mg.fill();
 v.balc.forEach(b => { const a = P(b[0], b[1]); mg.fillStyle = '#6b4c33'; mg.fillRect(a[0], a[1], (b[2] - b[0]) * s, (b[3] - b[1]) * s); });
 v.rooms.forEach(r => { mg.fillStyle = r.u === sel.u ? 'rgba(214,167,86,.55)' : (r.u ? '#3d434c' : '#333'); mg.strokeStyle = 'rgba(236,232,225,.55)'; mg.lineWidth = .8; mg.beginPath(); (r.p || rectPts(r.r)).forEach((p, i) => { const q = P(p[0], p[1]); i ? mg.lineTo(...q) : mg.moveTo(...q); }); mg.closePath(); mg.fill(); mg.stroke(); });
 mg.strokeStyle = '#ece8e1'; mg.lineWidth = 1.4; mg.beginPath(); v.plate.forEach((p, i) => { const q = P(p[0], p[1]); i ? mg.lineTo(...q) : mg.moveTo(...q); }); mg.closePath(); mg.stroke();
 const inside = mode === 'walk' || mode === 'tour'; let px, pz, yaw;
 if (inside) { px = walker.x; pz = walker.z; yaw = walker.yaw; } else { const O = TW[sel.t].O; px = orb.tx - O[0]; pz = orb.tz - O[1]; yaw = orb.th; }
 const [qx, qz] = P(px, pz); const a = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
 mg.fillStyle = 'rgba(240,207,140,.35)'; mg.beginPath(); mg.moveTo(qx, qz); mg.arc(qx, qz, 22, a - .5, a + .5); mg.fill(); mg.fillStyle = '#f0cf8c'; mg.beginPath(); mg.arc(qx, qz, 3.5, 0, 7); mg.fill();
 { const cx = Wc - 14, cy = 16; mg.save(); mg.translate(cx, cy); mg.rotate(-NORTH_ROT); mg.strokeStyle = mg.fillStyle = '#ece8e1'; mg.lineWidth = 1.5; mg.beginPath(); mg.moveTo(0, 8); mg.lineTo(0, -7); mg.stroke(); mg.beginPath(); mg.moveTo(0, -9); mg.lineTo(-3.5, -3); mg.lineTo(3.5, -3); mg.fill(); mg.restore(); mg.font = '600 11px Figtree'; mg.fillText('N', cx - 15, cy + 4); }
}
mmc.addEventListener('click', e => { if (!FLOOR) return; const b = mmc.getBoundingClientRect(); const x = (e.clientX - b.left) * mmc.width / b.width / MM.s + MM.x0, y = (e.clientY - b.top) * mmc.height / b.height / MM.s + MM.y0; if (!pip(FLOOR.v.plate, x, y)) return; const r = FLOOR.v.rooms.find(q => inRoom(q, x, y)); if (r && r.u) { sel.u = r.u; renderUI(); } if (mode !== 'walk') setMode('walk'); placeWalker(x, y, r); });

/* ================= loop ================= */
function resize() { const w = innerWidth, h = innerHeight; ren.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); const s = innerWidth <= 860 ? .62 : 1; mmc.style.width = 210 * s + 'px'; mmc.style.height = 210 * s + 'px'; }
addEventListener('resize', resize);
const clock = new T.Clock(); let lastRoom, mmTick = 0;
function frame() {
 const dt = Math.min(clock.getDelta(), .05);
 if (mode === 'walk' || mode === 'tour') {
  if (mode === 'walk') walkStep(dt); else tourStep(dt);
  const O = TW[sel.t].O; cam.position.set(O[0] + walker.x, lvl(sel.n) + EYE, O[1] + walker.z); fill.position.copy(cam.position); fill.position.y += .6; fill.intensity = .9; cam.rotation.set(walker.pitch, walker.yaw, 0); cam.up.set(0, 1, 0);
  const r = FLOOR.v.rooms.find(q => inRoom(q, walker.x, walker.z)); const key = r || (FLOOR.v.balc.some(b => inRect(b, walker.x, walker.z)) ? 'balc' : null);
  if (key !== lastRoom) { lastRoom = key; $('#hud').innerHTML = r ? `${r.label || r.n}<span>${r.d ? `${r.d[0].toFixed(2)} × ${r.d[1].toFixed(2)} m` : ''}</span>` : key === 'balc' ? 'Balcony' : 'Lobby'; }
 } else {
  fill.intensity = 0; const k = 1 - Math.pow(.002, dt); for (const p in orb) orb[p] += (orbT[p] - orb[p]) * k;
  const sp = Math.sin(orb.ph); cam.position.set(orb.tx + orb.r * sp * Math.sin(orb.th), orb.ty + orb.r * Math.cos(orb.ph), orb.tz + orb.r * sp * Math.cos(orb.th));
  cam.up.set(0, 1, 0); cam.lookAt(orb.tx, orb.ty, orb.tz);
 }
 sky.position.copy(cam.position); placeLabels();
 if ((mmTick += dt) > .08) { mmTick = 0; drawMM(); }
 ren.render(scene, cam); requestAnimationFrame(frame);
}
resize(); setSun(); selectFloor(sel.t, sel.n, true);
// shareable links: #B-2904 opens that flat, #B-2904/walk or /tour opens it inside
function openLink() { const [f, m] = decodeURIComponent((location.hash || '').slice(1)).split('/'); const ok = f && goFlat(f, true); const mm = ['site', 'floor', 'walk', 'tour'].includes(m) ? m : ok ? 'floor' : null; if (mm && mm !== mode) setMode(mm); }
openLink(); linkReady = true; syncHash(); addEventListener('hashchange', () => { if (location.hash !== lastHash) openLink(); });
$('#load').remove(); requestAnimationFrame(frame);
setTimeout(loadSurroundings, 50);
})();
