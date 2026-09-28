// ============================================================================
// Engine — renderer, post-processing (bloom, DOF, grade, output, FXAA), environment
// lighting, colour grades, dynamic resolution. Owned by: core.
// Engine.camera is the ONLY rendered camera; Director.camUpdate() poses it every frame.
// ============================================================================
const Engine = (() => {
  let renderer, scene, camera, composer, overlay;
  let renderPass, overlayPass, bloomPass, bokehPass, gradePass, outputPass, fxaaPass;
  let pmrem, envTex = null;
  const size = { w: 1, h: 1 };
  let scale = 1, perfAcc = 0, perfN = 0, perfGood = 0;
  const focusTmp = new THREE.Vector3();

  const GradeShader = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uExposure: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1 },
      uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
      uVignette: { value: 0.3 }, uGrain: { value: 0.2 }, uFringe: { value: 0.1 },
      uDesat: { value: 0 },      // pause / airplane mode
      uListen: { value: 0 },     // airplane mode darkening
      uNightShift: { value: 0 }, // red goggle view
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uExposure, uSat, uContrast, uVignette, uGrain, uFringe, uDesat, uListen, uNightShift;
      uniform vec3 uLift, uGamma, uGain; uniform vec2 uRes; varying vec2 vUv;
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d, d);
        vec2 off = d * uFringe * 0.012 * (0.3 + r2 * 2.0);
        vec3 c = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
        c *= uExposure;
        c = 0.18 * pow(max(c, 0.0) / 0.18, vec3(uContrast));
        c = c * uGain + uLift;
        c = pow(max(c, 0.0), 1.0 / uGamma);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat * (1.0 - uDesat));
        c *= 1.0 - uListen * 0.45;
        if (uNightShift > 0.0) { vec3 red = vec3(l * 1.6, l * 0.18, l * 0.12); c = mix(c, red, uNightShift); c *= 1.0 - uNightShift * smoothstep(0.12, 0.4, r2) * 0.8; }
        float vig = smoothstep(0.75, 0.15, r2 * (1.0 + uVignette));
        c *= mix(1.0, vig, uVignette);
        float g = h12(vUv * uRes + fract(uTime * 13.7) * 91.0) - 0.5;
        c += g * uGrain * 0.06 * (0.25 + sqrt(max(l, 0.0)));
        gl_FragColor = vec4(max(c, 0.0), 1.0);
      }`,
  };

  // Active grade (numbers only) and blend state.
  const grade = JSON.parse(JSON.stringify(CONTENT.grades.neutral));
  let gradeFrom = null, gradeTo = null, gradeT = 0, gradeDur = 0;

  const dof = { enabled: false, target: null, focus: 5, aperture: 0.0025, maxblur: 0.008 };

  // Cinematic cheats the Director drives in long-lens shots: a soft key light on the subject's face (always in the
  // scene so the light count never changes) and a shadow frustum pulled tight around the subject for crisp face shadows.
  let key = null, keyTarget = 0, sun = null, sunSave = null;
  const kv = new THREE.Vector3(), kd = new THREE.Vector3();
  function cineKey(subject, camPos, strength = 0.7, color = 0xffe4c8) {
    keyTarget = subject ? strength : 0;
    if (!subject) return;
    kd.subVectors(camPos, subject).setY(0).normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, 0.7);
    key.position.copy(subject).addScaledVector(kd, 1.3); key.position.y += 0.4;
    key.color.set(color);
  }
  const inScene = o => { while (o) { if (o === scene) return true; o = o.parent; } return false; };
  function shadowFocus(center, radius = 3) {
    if (!sun || !inScene(sun)) { sun = null; sunSave = null; scene.traverse(o => { if (!sun && o.isDirectionalLight && o.castShadow) sun = o; }); }
    if (!sun) return;
    const cam = sun.shadow.camera;
    if (!center) { if (sunSave) { sun.position.copy(sunSave.p); sun.target.position.copy(sunSave.t); Object.assign(cam, sunSave.b); cam.updateProjectionMatrix(); sunSave = null; } return; }
    if (!sunSave) sunSave = { p: sun.position.clone(), t: sun.target.position.clone(), b: { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom } };
    const step = radius / 256;                                   // snap to a coarse grid so a tracking shot doesn't shimmer
    kv.set(Math.round(center.x / step) * step, Math.round(center.y / step) * step, Math.round(center.z / step) * step);
    if (sun.target.parent) sun.target.parent.worldToLocal(kv);
    sun.position.copy(kv).add(sunSave.p).sub(sunSave.t); sun.target.position.copy(kv);
    cam.left = cam.bottom = -radius; cam.right = cam.top = radius; cam.updateProjectionMatrix();
  }

  function init(parent) {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    parent.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    overlay = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 1200);
    scene.add(camera);
    pmrem = new THREE.PMREMGenerator(renderer);
    key = new THREE.PointLight(0xffe4c8, 0, 4, 2); scene.add(key);

    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    overlayPass = new RenderPass(overlay, camera); overlayPass.clear = false; overlayPass.clearDepth = true;
    bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.85);
    bokehPass = new BokehPass(scene, camera, { focus: 5, aperture: 0.0025, maxblur: 0.008 });
    bokehPass.enabled = false;
    gradePass = new ShaderPass(GradeShader);
    outputPass = new OutputPass();
    fxaaPass = new ShaderPass(FXAAShader);
    composer.addPass(renderPass);
    composer.addPass(overlayPass);
    composer.addPass(bloomPass);
    composer.addPass(bokehPass);
    composer.addPass(gradePass);
    composer.addPass(outputPass);
    composer.addPass(fxaaPass);
    addEventListener('resize', resize);
    setQuality(SETTINGS.quality);
    applyGrade();
  }

  function resize() {
    size.w = innerWidth; size.h = innerHeight;
    const q = CONFIG.quality[SETTINGS.quality] || CONFIG.quality.high;
    const pr = Math.min(devicePixelRatio || 1, q.pixelRatioCap) * scale;
    renderer.setPixelRatio(pr);
    renderer.setSize(size.w, size.h, false);
    composer.setPixelRatio(pr);
    composer.setSize(size.w, size.h);
    camera.aspect = size.w / size.h; camera.updateProjectionMatrix();
    const W = size.w * pr, H = size.h * pr;
    fxaaPass.material.uniforms.resolution.value.set(1 / W, 1 / H);
    gradePass.material.uniforms.uRes.value.set(W, H);
    bloomPass.resolution.set(W / 2, H / 2);
  }

  function setQuality(name) {
    const q = CONFIG.quality[name] || CONFIG.quality.high;
    scale = q.scale;
    renderer.shadowMap.enabled = q.shadows;
    fxaaPass.enabled = q.fxaa;
    Engine.shadowMapSize = q.shadowMap;
    resize();
  }

  // Grade: name from CONTENT.grades or a partial params object; blends over dur seconds.
  function setGrade(g, dur = 0) {
    const target = Object.assign(JSON.parse(JSON.stringify(CONTENT.grades.neutral)), typeof g === 'string' ? CONTENT.grades[g] : g);
    if (dur <= 0) { Object.assign(grade, target); gradeTo = null; applyGrade(); return; }
    gradeFrom = JSON.parse(JSON.stringify(grade)); gradeTo = target; gradeT = 0; gradeDur = dur;
  }
  function mixGrade(a, b, t) {
    for (const k in b) {
      if (Array.isArray(b[k])) grade[k] = b[k].map((v, i) => U.lerp(a[k][i], v, t));
      else if (typeof b[k] === 'number') grade[k] = U.lerp(a[k], b[k], t);
    }
  }
  function applyGrade() {
    const u = gradePass.material.uniforms;
    u.uExposure.value = grade.exposure; u.uSat.value = grade.sat; u.uContrast.value = grade.contrast;
    u.uLift.value.fromArray(grade.lift); u.uGamma.value.fromArray(grade.gamma); u.uGain.value.fromArray(grade.gain);
    u.uVignette.value = grade.vignette;
    u.uGrain.value = SETTINGS.grain ? grade.grain : 0;
    u.uFringe.value = SETTINGS.motion ? grade.fringe : grade.fringe * 0.3;
    bloomPass.strength = grade.bloom[0]; bloomPass.radius = grade.bloom[1]; bloomPass.threshold = grade.bloom[2];
    renderer.toneMappingExposure = grade.toneExposure;
  }

  // Environment lighting for PBR materials, from a simple gradient dome (+ optional bright patches).
  // opts: { top, horizon, bottom, intensity, spots:[{dir:[x,y,z], color, size}] } or 'room'
  function setEnv(opts) {
    if (envTex) { envTex.dispose(); envTex = null; }
    if (!opts) { scene.environment = null; return; }
    let rt;
    if (opts === 'room') rt = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
    else {
      const s = new THREE.Scene();
      const geo = new THREE.SphereGeometry(50, 32, 16);
      const top = new THREE.Color(opts.top ?? 0x445566), hor = new THREE.Color(opts.horizon ?? 0x887766), bot = new THREE.Color(opts.bottom ?? 0x222018);
      const k = opts.intensity ?? 1, cols = [], p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / 50, c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(bot, Math.pow(-y, 0.4));
        cols.push(c.r * k, c.g * k, c.b * k);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      for (const sp of opts.spots || []) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(sp.size ?? 6, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(sp.color ?? 0xffffff).multiplyScalar(sp.power ?? 4) }));
        m.position.fromArray(sp.dir).normalize().multiplyScalar(40); s.add(m);
      }
      rt = pmrem.fromScene(s, 0.02);
      geo.dispose();
    }
    envTex = rt.texture; scene.environment = envTex;
  }

  // DOF: Director sets Engine.dof.enabled / target (Vector3 or () => Vector3) / aperture.
  function updateDof() {
    const on = dof.enabled && SETTINGS.quality !== 'low';
    bokehPass.enabled = on;
    if (!on) return;
    const t = typeof dof.target === 'function' ? dof.target() : dof.target;
    if (t) { focusTmp.copy(t); dof.focus = U.lerp(dof.focus, camera.position.distanceTo(focusTmp), 0.25); }
    const u = bokehPass.uniforms;
    u.focus.value = dof.focus; u.aperture.value = dof.aperture; u.maxblur.value = dof.maxblur;
  }

  function dynRes(dt) {
    const q = CONFIG.quality[SETTINGS.quality] || CONFIG.quality.high;
    perfAcc += dt; perfN++;
    if (perfAcc < 1) return;
    const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
    if (avg > 0.02 && scale > 0.6) { scale = Math.max(0.6, +(scale - 0.1).toFixed(2)); perfGood = 0; resize(); }
    else if (avg < 0.014 && scale < q.maxScale) { if (++perfGood >= 3) { scale = Math.min(q.maxScale, +(scale + 0.1).toFixed(2)); perfGood = 0; resize(); } }
    else perfGood = 0;
  }

  let time = 0;
  function render(dt, measure = true) {
    time += dt;
    key.intensity = U.damp(key.intensity, keyTarget, 6, dt);
    if (gradeTo) { gradeT += dt; const t = U.clamp(gradeT / gradeDur); mixGrade(gradeFrom, gradeTo, U.ease.inOut(t)); if (t >= 1) gradeTo = null; applyGrade(); }
    gradePass.material.uniforms.uTime.value = time;
    updateDof();
    composer.render(dt);
    if (measure && !CONFIG.dev) dynRes(dt);
  }

  return {
    init, render, resize, setQuality, setGrade, setEnv, grade, dof, applyGrade, cineKey, shadowFocus,
    get renderer() { return renderer; }, get scene() { return scene; }, get camera() { return camera; },
    get overlay() { return overlay; }, get composer() { return composer; }, get size() { return size; },
    get uniforms() { return gradePass.material.uniforms; }, get time() { return time; },
    shadowMapSize: 2048,
  };
})();
