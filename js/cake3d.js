/* Real-3D birthday cake with the name on it + blow-out candles.
   Loaded dynamically; if it fails, the CSS fallback cake stays. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json";

export function mountCake3D(host, name) {
  return new Promise((resolve, reject) => {
    try {
      const W = host.clientWidth || 300, H = host.clientHeight || 260;
      const canvas = document.createElement("canvas");
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W, H, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
      camera.position.set(0, 1.7, 6.2); camera.lookAt(0, 0.4, 0);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 6, 4); scene.add(key);
      const rim = new THREE.DirectionalLight(0xff9ec4, 0.9); rim.position.set(-4, 2, -3); scene.add(rim);

      const cake = new THREE.Group(); scene.add(cake);

      const sponge = new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.8 });
      const cream  = new THREE.MeshStandardMaterial({ color: 0xffd0e4, roughness: 0.5 });
      const creamHot = new THREE.MeshStandardMaterial({ color: 0xff5fa2, roughness: 0.45 });
      const plateMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.25 });

      // plate
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 0.12, 48), plateMat);
      plate.position.y = -1.15; cake.add(plate);
      // base tier
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1.1, 48), sponge);
      base.position.y = -0.55; cake.add(base);
      const baseTop = new THREE.Mesh(new THREE.CylinderGeometry(1.63, 1.63, 0.28, 48), cream);
      baseTop.position.y = 0.05; cake.add(baseTop);
      // top tier
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.9, 48), sponge);
      top.position.y = 0.72; cake.add(top);
      const topTop = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.24, 48), creamHot);
      topTop.position.y = 1.22; cake.add(topTop);

      // candles + flames
      const flames = [], flameLights = [];
      const candleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const flameMat = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff7b00, emissiveIntensity: 2.2 });
      for (let i = 0; i < 3; i++) {
        const a = (i - 1) * 0.55;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 12), candleMat);
        c.position.set(a, 1.7, 0); cake.add(c);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 12), flameMat);
        fl.position.set(a, 2.15, 0); cake.add(fl); flames.push(fl);
        const pl = new THREE.PointLight(0xffa64d, 1.1, 6); pl.position.set(a, 2.2, 0.2); cake.add(pl); flameLights.push(pl);
      }

      // "AMEENA" text on the cake front
      new FontLoader().load(FONT_URL, (font) => {
        try {
          const geo = new TextGeometry(name, { font, size: 0.36, height: 0.06, curveSegments: 6, bevelEnabled: false });
          geo.computeBoundingBox();
          const w = geo.boundingBox.max.x - geo.boundingBox.min.x;
          geo.translate(-w / 2, 0, 0);
          const txt = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb3123f, roughness: 0.4 }));
          txt.position.set(0, -0.55, 1.6); cake.add(txt);
        } catch (_) {}
      }, undefined, () => {});

      // swap CSS cake → 3D
      const cssCake = host.querySelector("#cake"); if (cssCake) cssCake.style.display = "none";
      host.appendChild(canvas);

      // blow handler exposed to app
      let blown = false, smoke = [];
      window.__cakeBlow = () => {
        if (blown) return; blown = true;
        flames.forEach(f => f.visible = false);
        flameLights.forEach(l => l.intensity = 0);
        flames.forEach((f) => {
          for (let i = 0; i < 4; i++) {
            const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 }));
            s.position.copy(f.position); s.userData.v = new THREE.Vector3((Math.random() - .5) * 0.01, 0.02 + Math.random() * 0.02, 0); cake.add(s); smoke.push(s);
          }
        });
      };

      let t = 0, alive = true;
      (function tick() {
        if (!alive) return; requestAnimationFrame(tick);
        t += 0.016;
        cake.rotation.y = Math.sin(t * 0.5) * 0.3;
        if (!blown) flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 12 + i) * 0.12; f.scale.x = 1 + Math.cos(t * 10 + i) * 0.06; });
        smoke.forEach((s) => { s.position.add(s.userData.v); s.material.opacity *= 0.98; s.scale.multiplyScalar(1.01); });
        renderer.render(scene, camera);
      })();

      resolve(true);
    } catch (e) { reject(e); }
  });
}
