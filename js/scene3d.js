/* Optional real-3D upgrade for the name reveal.
   Loaded dynamically; if anything fails, the CSS-3D name stays. */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json";

export function mountName3D(host, text) {
  return new Promise((resolve, reject) => {
    try {
      const W = Math.min(host.clientWidth || 320, 460);
      const H = 200;
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%"; canvas.style.maxWidth = W + "px"; canvas.style.height = H + "px";
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W, H, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
      camera.position.set(0, 0, 6);

      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xff5fa2, metalness: 1.0, roughness: 0.22,
        clearcoat: 1.0, clearcoatRoughness: 0.15,
        iridescence: 0.6, iridescenceIOR: 1.3, envMapIntensity: 1.0,
      });
      const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(4, 6, 5); scene.add(key);
      const rim = new THREE.DirectionalLight(0xff9ec4, 1.4); rim.position.set(-6, -2, -3); scene.add(rim);
      scene.add(new THREE.AmbientLight(0x442233, 0.6));

      const group = new THREE.Group(); scene.add(group);
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      addEventListener("pointermove", (e) => {
        pointer.tx = (e.clientX / innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / innerHeight) * 2 - 1;
      }, { passive: true });

      new FontLoader().load(FONT_URL, (font) => {
        const geo = new TextGeometry(text, {
          font, size: 1, height: 0.3, curveSegments: 8,
          bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3,
        });
        geo.computeBoundingBox();
        const bb = geo.boundingBox, w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
        geo.translate(-(bb.min.x + w / 2), -(bb.min.y + h / 2), -(bb.min.z + d / 2));
        const mesh = new THREE.Mesh(geo, mat); group.add(mesh);
        const s = 4.7 / w; group.userData.baseS = s; group.scale.setScalar(s);

        // swap CSS-3D for the canvas now that it's ready
        host.innerHTML = ""; host.appendChild(canvas);

        let t = 0, alive = true;
        (function tick() {
          if (!alive) return;
          requestAnimationFrame(tick);
          t += 0.016;
          pointer.x += (pointer.tx - pointer.x) * 0.06;
          pointer.y += (pointer.ty - pointer.y) * 0.06;
          group.rotation.y = Math.sin(t * 0.8) * 0.55 + pointer.x * 0.5;
          group.rotation.x = -pointer.y * 0.3 + Math.sin(t * 0.6) * 0.1;
          group.rotation.z = Math.sin(t * 0.9) * 0.05;
          // no vertical bob here — the whole balloon+name group floats together via CSS, so the string stays tied
          const b = group.userData.baseS || 1; group.scale.setScalar(b * (1 + Math.sin(t * 1.3) * 0.04));
          renderer.render(scene, camera);
        })();
        resolve(true);
      }, undefined, reject);
    } catch (e) { reject(e); }
  });
}
