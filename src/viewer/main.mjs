import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { canOccupy, move } from './collision.mjs';

const $ = id => document.getElementById(id), canvas = $('scene'), viewport = $('viewport');
const abort = new AbortController(), listen = (target, event, fn, options = {}) => target.addEventListener(event, fn, { ...options, signal: abort.signal });
let renderer, frame = 0, timer, observer;
function fail(error) { $('error').hidden = false; $('error').textContent = `Scene could not load: ${error.message}`; $('status').textContent = 'Load failed'; canvas.dataset.ready = 'error'; }
try {
  const response = await fetch('./compiled.json'); if (!response.ok) throw Error('Missing compiled scene');
  const data = await response.json(), { width: w, depth: d, height: h } = data.room;
  document.title = `${data.name} · Room Builder`; $('name').textContent = data.name;
  $('area').textContent = (w * d).toFixed(1); $('height').textContent = h.toFixed(2); $('dimensions').textContent = `${w} × ${d} m`;
  $('count').textContent = String(data.furnitureBounds.length).padStart(2, '0'); $('revision').textContent = `REV ${data.revision}`;
  for (const f of data.furnitureBounds) {
    const li = document.createElement('li'), label = document.createElement('span'), size = document.createElement('small');
    label.textContent = f.id.replaceAll('-', ' '); size.textContent = `${(f.maxX - f.minX).toFixed(2)} × ${(f.maxZ - f.minZ).toFixed(2)} m`; li.append(label, size); $('furniture').append(li);
  }
  const svg = $('map'), svgElement = (tag, attributes) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attributes)) e.setAttribute(k, v); return e; };
  svg.setAttribute('viewBox', `-.15 -.15 ${w + .3} ${d + .3}`);
  svg.append(svgElement('rect', { x: 0, y: 0, width: w, height: d, fill: '#e3e7d9', stroke: '#8b9b7e', 'stroke-width': .06 }));
  for (const f of data.furnitureBounds) svg.append(svgElement('rect', { x: f.minX, y: d - f.maxZ, width: f.maxX - f.minX, height: f.maxZ - f.minZ, rx: .03, fill: '#9fae90', opacity: .75 }));
  const marker = svgElement('circle', { cx: data.spawn.x, cy: d - data.spawn.z, r: .12, fill: '#35563e', stroke: '#f8f9f2', 'stroke-width': .04 }); svg.append(marker);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e7eadf');
  const camera = new THREE.PerspectiveCamera(42, 1, .05, 160), controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2; controls.maxDistance = Math.max(w, d) * 4; controls.maxPolarAngle = Math.PI * .48;
  const materials = new Map(), meshes = [];
  for (const [id, m] of Object.entries(data.materials)) materials.set(id, new THREE.MeshStandardMaterial({ color: m.color, roughness: m.roughness, metalness: m.metalness || 0, ...(id === 'glass' ? { transparent: true, opacity: .3, depthWrite: false } : {}) }));
  for (const p of data.primitives) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.width, p.height, p.depth), materials.get(p.material));
    mesh.position.set(p.x, p.y, p.z); mesh.rotation.y = p.rotation * Math.PI / 180; mesh.name = p.id;
    mesh.castShadow = p.id !== 'floor' && p.category !== 'ceiling' && p.material !== 'glass'; mesh.receiveShadow = true; mesh.userData.definition = p; scene.add(mesh); meshes.push(mesh);
  }
  // Subtle floor seams are procedural and carry no external image assets.
  const seams = [], seamMat = new THREE.LineBasicMaterial({ color: '#706044', transparent: true, opacity: .12 });
  for (let x = .22; x < w; x += .22) seams.push(x, .001, 0, x, .001, d);
  for (let z = .85; z < d; z += .85) seams.push(0, .001, z, w, .001, z);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seams, 3)), seamMat));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#dfe4d6', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.14; ground.receiveShadow = true; scene.add(ground);
  scene.add(new THREE.HemisphereLight(data.lights.ambient.color, '#c6c9b7', data.lights.ambient.intensity));
  const sun = new THREE.DirectionalLight(data.lights.sun.color, data.lights.sun.intensity);
  sun.position.set(-w * .6, h * 3, -d * .5); sun.target.position.set(w / 2, 0, d / 2); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const size = Math.max(w, d) * 1.3; Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: .1, far: 100 }); sun.shadow.normalBias = .035;
  scene.add(sun, sun.target);
  for (const p of data.lights.points) { const light = new THREE.PointLight(p.color, p.intensity, Math.max(w, d) * 2, 2); light.position.set(p.x, p.y, p.z); scene.add(light); }
  const body = { x: data.spawn.x, z: data.spawn.z }, keys = new Set(); let mode = 'overview', yaw = data.spawn.yaw * Math.PI / 180, pitch = 0, dragging = null, previous = performance.now();
  const resetBody = () => { body.x = data.spawn.x; body.z = data.spawn.z; yaw = data.spawn.yaw * Math.PI / 180; pitch = 0; keys.clear(); };
  function setMode(next) {
    mode = next; controls.enabled = mode === 'overview'; keys.clear(); dragging = null;
    document.body.classList.toggle('walking', mode === 'walk'); $('crosshair').hidden = mode !== 'walk';
    for (const id of ['overview', 'walk']) { $(id).classList.toggle('active', id === mode); $(id).setAttribute('aria-pressed', String(id === mode)); }
    if (mode === 'overview') { if (document.pointerLockElement === canvas) document.exitPointerLock(); controls.target.set(w / 2, .25, d / 2); camera.fov = 42; camera.position.set(w * 1.45, Math.max(w, d) * 1.05, -d * .65); controls.update(); }
    else { resetBody(); camera.fov = 65; }
    camera.updateProjectionMatrix(); $('mode-label').textContent = mode === 'walk' ? '02 / FIRST PERSON' : '01 / OVERVIEW';
    $('hint').textContent = mode === 'walk' ? 'WASD / arrows · Drag or click to look · Q/E turn · R reset · Esc release' : 'Drag to orbit · Scroll to zoom';
    canvas.focus({ preventScroll: true });
  }
  listen($('overview'), 'click', () => setMode('overview')); listen($('walk'), 'click', () => setMode('walk'));
  listen($('reset'), 'click', () => mode === 'walk' ? resetBody() : setMode('overview'));
  const movement = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  listen(window, 'keydown', e => { if (mode !== 'walk') return; if (movement.has(e.code)) { e.preventDefault(); keys.add(e.code); } if (e.code === 'KeyR') resetBody(); });
  listen(window, 'keyup', e => keys.delete(e.code)); listen(window, 'blur', () => { keys.clear(); dragging = null; });
  const look = (dx, dy) => { yaw -= dx * .0024; pitch = Math.max(-1.35, Math.min(1.35, pitch - dy * .0024)); };
  listen(canvas, 'pointerdown', e => { if (mode !== 'walk' || e.button !== 0) return; dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  listen(canvas, 'pointermove', e => { if (!dragging || e.pointerId !== dragging.id || document.pointerLockElement === canvas) return; look(e.clientX - dragging.x, e.clientY - dragging.y); dragging.moved ||= Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 2; dragging.x = e.clientX; dragging.y = e.clientY; });
  listen(canvas, 'pointerup', () => { const click = dragging && !dragging.moved; dragging = null; if (click && canvas.requestPointerLock) { try { canvas.requestPointerLock()?.catch(() => {}); } catch {} } });
  for (const event of ['pointercancel', 'lostpointercapture']) listen(canvas, event, () => { dragging = null; });
  listen(document, 'mousemove', e => { if (mode === 'walk' && document.pointerLockElement === canvas) look(e.movementX, e.movementY); });
  listen(document, 'pointerlockchange', () => keys.clear());
  const resize = () => { const { width, height } = viewport.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
  observer = new ResizeObserver(resize); observer.observe(viewport); resize(); setMode('overview');
  function render(now) {
    frame = requestAnimationFrame(render); const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
    if (document.hidden) return;
    if (mode === 'walk') {
      let forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      let side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      yaw += (Number(keys.has('KeyQ')) - Number(keys.has('KeyE'))) * dt * 1.5;
      const length = Math.max(1, Math.hypot(forward, side)), travel = data.player.speed * dt;
      forward *= travel / length; side *= travel / length;
      move(body, Math.sin(yaw) * forward + Math.cos(yaw) * side, Math.cos(yaw) * forward - Math.sin(yaw) * side, data);
      camera.position.set(body.x, data.player.eyeHeight, body.z); camera.rotation.set(pitch, yaw + Math.PI, 0, 'YXZ');
      $('location').textContent = `x ${body.x.toFixed(2)} · z ${body.z.toFixed(2)} m`;
    } else { controls.update(); $('location').textContent = 'Your room, in perspective.'; }
    for (const mesh of meshes) {
      const p = mesh.userData.definition;
      mesh.visible = p.category !== 'ceiling' || mode === 'walk';
      if (mode === 'overview' && p.category === 'structure' && p.id !== 'floor') {
        const frontX = camera.position.x < w / 2 ? p.x < 0 : p.x > w;
        const frontZ = camera.position.z < d / 2 ? p.z < 0 : p.z > d;
        if (frontX || frontZ) mesh.visible = false;
      }
    }
    marker.setAttribute('cx', body.x); marker.setAttribute('cy', d - body.z);
    canvas.dataset.mode = mode; canvas.dataset.revision = String(data.revision); canvas.dataset.position = JSON.stringify({ ...body, yaw, valid: canOccupy(body.x, body.z, data) });
    renderer.render(scene, camera);
    canvas.dataset.resources = JSON.stringify({ geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length, canvases: document.querySelectorAll('canvas').length });
  }
  frame = requestAnimationFrame(render); $('status').textContent = 'Scene ready'; canvas.dataset.ready = 'true'; canvas.dataset.hash = data.hash;
  listen(canvas, 'webglcontextlost', e => { e.preventDefault(); fail(Error('Graphics context lost. Reload this preview.')); });
  if (new URLSearchParams(location.search).has('live')) timer = setInterval(async () => {
    try { const r = await fetch('/__current'); if (r.ok && (await r.json()).hash !== data.hash) location.replace('/'); } catch {}
  }, 1500);
  listen(document, 'visibilitychange', () => { keys.clear(); previous = performance.now(); });
  listen(window, 'pagehide', () => {
    cancelAnimationFrame(frame); clearInterval(timer); observer.disconnect(); controls.dispose();
    scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const m of new Set([...materials.values(), seamMat, ground.material])) m.dispose();
    renderer.dispose(); renderer.forceContextLoss(); abort.abort();
  }, { once: true });
} catch (e) { fail(e); }
