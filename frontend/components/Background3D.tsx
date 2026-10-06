"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Ambient scene behind the whole site: a DNA double helix, drifting capsules, wireframe molecules, particles. */
export default function Background3D() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    } catch {
      return; // no WebGL: the CSS gradient background still looks fine
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block" });
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 16);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0x7ff5e0, 2.4); key.position.set(5, 6, 8); scene.add(key);
    const rim = new THREE.PointLight(0xa78bfa, 70, 50); rim.position.set(-9, -4, 6); scene.add(rim);

    // --- DNA helix ---
    const helix = new THREE.Group();
    const STEPS = 30, R = 1.6, GAP = 0.55, TURN = 0.46;
    const sphere = new THREE.SphereGeometry(0.2, 24, 24);
    const matA = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.25, metalness: 0.15 });
    const matB = new THREE.MeshStandardMaterial({ color: 0xa78bfa, roughness: 0.25, metalness: 0.15 });
    const rungGeo = new THREE.CylinderGeometry(0.04, 0.04, R * 2, 8);
    const rungMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    const ptsA: THREE.Vector3[] = [], ptsB: THREE.Vector3[] = [];
    for (let i = 0; i < STEPS; i++) {
      const a = i * TURN, y = (i - STEPS / 2) * GAP;
      const pa = new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
      const pb = new THREE.Vector3(-Math.cos(a) * R, y, -Math.sin(a) * R);
      ptsA.push(pa); ptsB.push(pb);
      const sa = new THREE.Mesh(sphere, matA); sa.position.copy(pa);
      const sb = new THREE.Mesh(sphere, matB); sb.position.copy(pb);
      const rung = new THREE.Mesh(rungGeo, rungMat); rung.rotation.z = Math.PI / 2;
      const holder = new THREE.Group(); holder.position.y = y; holder.rotation.y = -a; holder.add(rung);
      helix.add(sa, sb, holder);
    }
    const tube = (pts: THREE.Vector3[], color: number) =>
      new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.055, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.35, transparent: true, opacity: 0.8 }));
    helix.add(tube(ptsA, 0x2dd4bf), tube(ptsB, 0xa78bfa));
    helix.rotation.z = 0.38;
    scene.add(helix);

    // --- drifting capsules (tablets) ---
    const capGeo = new THREE.CapsuleGeometry(0.28, 0.7, 6, 16);
    const palette = [0x5eead4, 0x67e8f9, 0xffffff, 0xc4b5fd, 0x2dd4bf];
    const caps: { m: THREE.Mesh; base: THREE.Vector3; speed: number; spin: THREE.Vector3 }[] = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({
        color: palette[i % palette.length], roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.88 }));
      const base = new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 17, -7 + Math.random() * 9);
      m.position.copy(base); m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const s = 0.6 + Math.random() * 0.9; m.scale.setScalar(s);
      caps.push({ m, base, speed: 0.3 + Math.random() * 0.5, spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.25) });
      scene.add(m);
    }

    // --- wireframe molecules ---
    const molGeo = new THREE.IcosahedronGeometry(0.7, 0);
    const molMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, wireframe: true, transparent: true, opacity: 0.45 });
    const mols: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(molGeo, molMat);
      m.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 17, -8 + Math.random() * 8);
      m.scale.setScalar(0.6 + Math.random() * 1.2);
      mols.push(m); scene.add(m);
    }

    // --- particles ---
    const N = 260, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 44; pos[i * 3 + 1] = (Math.random() - 0.5) * 26; pos[i * 3 + 2] = -12 + Math.random() * 16; }
    const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xbffcf2, size: 0.045, transparent: true, opacity: 0.6 }));
    scene.add(points);

    // --- sizing ---
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const wide = w >= 900;
      helix.position.set(wide ? 6.2 : 0, 0, wide ? 0 : -3);
      helix.scale.setScalar(wide ? 1 : 0.7);
      if (reduce) renderer.render(scene, camera);
    };
    resize();
    window.addEventListener("resize", resize);

    // --- interaction ---
    let mx = 0, my = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; };
    if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const t = clock.getElapsedTime();
      helix.rotation.y = t * 0.25;
      caps.forEach(({ m, base, speed, spin }) => {
        m.position.y = base.y + Math.sin(t * speed + base.x) * 0.6;
        m.position.x = base.x + Math.cos(t * speed * 0.7 + base.y) * 0.4;
        m.rotation.x += spin.x * 0.01; m.rotation.y += spin.y * 0.01; m.rotation.z += spin.z * 0.01;
      });
      mols.forEach((m, i) => { m.rotation.x = t * 0.15 + i; m.rotation.y = t * 0.2 + i; });
      points.rotation.y = t * 0.012;
      camera.position.x += (mx * 1.6 - camera.position.x) * 0.04;
      camera.position.y += (-my * 1.0 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      scene.position.y = window.scrollY * 0.004; // gentle depth as the page scrolls
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      scene.traverse(o => {
        const obj = o as THREE.Mesh;
        obj.geometry?.dispose?.();
        const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach(x => x.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="absolute inset-0" />;
}
