import * as THREE from "three";
import "./styles.css";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setupAnchorScroll(): void {
  const scrollToTarget = (target: HTMLElement) => {
    const top = target.getBoundingClientRect().top + window.scrollY - 24;
    const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

    window.scrollTo({ top, behavior });

    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }

    window.setTimeout(() => target.focus({ preventScroll: true }), 80);
  };

  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;

      const target = document.querySelector<HTMLElement>(hash);
      if (!target) return;

      event.preventDefault();
      window.history.pushState(null, "", hash);
      scrollToTarget(target);
    });
  });
}

function setupActiveNavigation(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".nav-links a"));
  const sections = links
    .map((link) => {
      const target = document.querySelector<HTMLElement>(link.hash);
      return target ? { link, target } : null;
    })
    .filter((entry): entry is { link: HTMLAnchorElement; target: HTMLElement } => Boolean(entry));

  if (!sections.length) return;

  const sync = () => {
    const position = window.scrollY + window.innerHeight * 0.4;
    let active = sections[0];

    sections.forEach((entry) => {
      if (entry.target.offsetTop <= position) active = entry;
    });

    sections.forEach((entry) => {
      entry.link.classList.toggle("is-active", entry === active);
    });
  };

  window.addEventListener("scroll", sync, { passive: true });
  sync();
}

function setupReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>(".legal-row, .contact-shell");
  if (!targets.length) return;

  document.documentElement.classList.add("reveal-ready");

  if (reducedMotion) {
    targets.forEach((target) => target.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  targets.forEach((target) => observer.observe(target));
}

function createLimeForm(
  radius: number,
  length: number,
  position: THREE.Vector3,
  rotation: THREE.Euler,
  scale: THREE.Vector3,
  material: THREE.Material
): THREE.Mesh {
  const geometry = new THREE.CapsuleGeometry(radius, length, 32, 52);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.rotation.copy(rotation);
  mesh.scale.copy(scale);
  return mesh;
}

function createSmokeLine(offsetY: number, offsetZ: number, opacity: number): THREE.Mesh {
  const points = Array.from({ length: 8 }, (_, index) => {
    const x = -6.2 + index * 1.78;
    const y = Math.sin(index * 1.15) * 0.34 + offsetY;
    const z = Math.cos(index * 0.8) * 0.16 + offsetZ;
    return new THREE.Vector3(x, y, z);
  });
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, 96, 0.012, 8, false);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

function setupHeroScene(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-hero-canvas]");
  if (!canvas) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0.3, 10.8);

  const key = new THREE.DirectionalLight(0xffffff, 2.8);
  key.position.set(3, 5, 7);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x97ff1f, 1.3);
  fill.position.set(-4, -1, 5);
  scene.add(fill);

  scene.add(new THREE.AmbientLight(0x7bff2a, 0.72));

  const group = new THREE.Group();
  scene.add(group);

  const limeMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9ff2e,
    roughness: 0.36,
    metalness: 0.04,
    emissive: 0x385900,
    emissiveIntensity: 0.16,
  });

  const forms = [
    createLimeForm(
      0.72,
      5.2,
      new THREE.Vector3(-4.4, 0.55, -1.2),
      new THREE.Euler(0.18, 0.08, -0.18),
      new THREE.Vector3(1.2, 1.08, 1),
      limeMaterial
    ),
    createLimeForm(
      0.62,
      4.6,
      new THREE.Vector3(4.5, -0.2, -1.1),
      new THREE.Euler(-0.12, -0.24, 0.45),
      new THREE.Vector3(0.95, 1.04, 1),
      limeMaterial
    ),
    createLimeForm(
      0.5,
      3.1,
      new THREE.Vector3(0.9, -2.55, -0.8),
      new THREE.Euler(0.5, 0.0, -0.04),
      new THREE.Vector3(0.82, 0.95, 1),
      limeMaterial
    ),
    createLimeForm(
      0.58,
      3.8,
      new THREE.Vector3(-6.2, -1.55, -1.7),
      new THREE.Euler(-0.55, 0.22, 0.92),
      new THREE.Vector3(1.08, 1, 1),
      limeMaterial
    ),
    createLimeForm(
      0.46,
      3.1,
      new THREE.Vector3(6.25, -2.0, -1.7),
      new THREE.Euler(0.44, -0.2, -0.75),
      new THREE.Vector3(0.92, 1, 1),
      limeMaterial
    ),
  ];

  forms.forEach((form) => group.add(form));

  const smokeGroup = new THREE.Group();
  smokeGroup.add(createSmokeLine(-0.25, 0.2, 0.18));
  smokeGroup.add(createSmokeLine(-0.55, 0.1, 0.12));
  smokeGroup.add(createSmokeLine(0.08, -0.08, 0.1));
  group.add(smokeGroup);

  const resize = () => {
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  };

  window.addEventListener("resize", resize, { passive: true });
  resize();

  let frame = 0;
  const render = () => {
    frame += 0.008;

    group.rotation.y = Math.sin(frame * 0.6) * 0.045;
    group.rotation.x = Math.cos(frame * 0.5) * 0.025;

    forms.forEach((form, index) => {
      form.position.y += Math.sin(frame + index * 0.9) * 0.0009;
      form.rotation.z += Math.sin(frame * 0.5 + index) * 0.0009;
    });

    smokeGroup.position.x = Math.sin(frame * 0.4) * 0.12;
    smokeGroup.rotation.z = Math.sin(frame * 0.35) * 0.035;

    renderer.render(scene, camera);
  };

  if (reducedMotion) {
    render();
  } else {
    renderer.setAnimationLoop(render);
  }
}

function setupContactForm(): void {
  const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
  const status = document.querySelector<HTMLElement>("[data-form-status]");
  if (!form || !status) return;

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const originalSubmit = submit?.innerHTML ?? "";

  const setStatus = (message: string, state: "success" | "error" | "loading") => {
    status.textContent = message;
    status.hidden = false;
    status.dataset.state = state;
    status.focus({ preventScroll: true });
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    form.setAttribute("aria-busy", "true");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Submitting...";
    }
    setStatus("Submitting the intake message...", "loading");

    try {
      const response = await fetch("/api/review-request", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        receiptId?: string;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "The message could not be submitted.");
      }

      form.reset();
      setStatus(`Intake received. Confirmation ${result.receiptId}.`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The message could not be submitted.", "error");
    } finally {
      form.removeAttribute("aria-busy");
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = originalSubmit;
      }
    }
  });
}

setupHeroScene();
setupAnchorScroll();
setupActiveNavigation();
setupReveal();
setupContactForm();
