import "./styles.css";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function setupAmbientCanvas(): void {
  const canvas = document.querySelector<HTMLCanvasElement>("[data-ambient-canvas]");
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;

  const pointer = { x: 0.5, y: 0.5 };
  const target = { x: 0.5, y: 0.5 };
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const drawRibbon = (index: number, time: number) => {
    const yBase = height * (0.18 + index * 0.145);
    const amplitude = 18 + index * 8;
    const pointerPull = (pointer.y - 0.5) * 42;
    const offset = (pointer.x - 0.5) * 58;

    context.beginPath();
    for (let step = 0; step <= 96; step += 1) {
      const progress = step / 96;
      const x = progress * width;
      const wave =
        Math.sin(progress * Math.PI * 2 + time * (0.38 + index * 0.04) + index) * amplitude +
        Math.sin(progress * Math.PI * 5 - time * 0.18) * (amplitude * 0.32);
      const y = yBase + wave + pointerPull * Math.sin(progress * Math.PI) + offset * 0.08;
      if (step === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.strokeStyle = index % 2 === 0 ? "rgba(205, 168, 92, 0.18)" : "rgba(255, 255, 255, 0.08)";
    context.lineWidth = index % 2 === 0 ? 1.2 : 0.8;
    context.stroke();
  };

  const drawKeyField = (time: number) => {
    const centerX = width * (0.5 + (pointer.x - 0.5) * 0.08);
    const centerY = height * (0.53 + (pointer.y - 0.5) * 0.06);
    const radius = Math.min(width, height) * 0.24;

    context.save();
    context.translate(centerX, centerY);
    context.rotate(Math.sin(time * 0.16) * 0.06);
    context.strokeStyle = "rgba(205, 168, 92, 0.11)";
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(0, 0, radius * 1.75, radius * 0.64, 0, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = "rgba(255, 255, 255, 0.055)";
    context.beginPath();
    context.moveTo(-radius * 1.45, 0);
    context.bezierCurveTo(-radius * 0.55, -radius * 0.35, radius * 0.55, radius * 0.35, radius * 1.45, 0);
    context.stroke();

    context.strokeStyle = "rgba(205, 168, 92, 0.16)";
    context.beginPath();
    context.moveTo(0, -radius * 0.52);
    context.lineTo(0, radius * 0.52);
    context.moveTo(-radius * 0.18, radius * 0.18);
    context.lineTo(radius * 0.18, radius * 0.18);
    context.stroke();
    context.restore();
  };

  const render = () => {
    frame += 1;
    const time = frame / 60;
    pointer.x += (target.x - pointer.x) * 0.055;
    pointer.y += (target.y - pointer.y) * 0.055;

    context.clearRect(0, 0, width, height);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(15, 29, 50, 0.68)");
    gradient.addColorStop(0.55, "rgba(8, 20, 37, 0.26)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.1)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < 7; index += 1) {
      drawRibbon(index, time);
    }
    drawKeyField(time);

    if (!reducedMotion) {
      window.requestAnimationFrame(render);
    }
  };

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      target.x = event.clientX / Math.max(width, 1);
      target.y = event.clientY / Math.max(height, 1);
    },
    { passive: true }
  );
  window.addEventListener(
    "scroll",
    () => {
      target.y = (window.scrollY % Math.max(height, 1)) / Math.max(height, 1);
    },
    { passive: true }
  );

  resize();
  render();
}

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
    .filter((link) => link.hash)
    .map((link) => {
      const target = document.querySelector<HTMLElement>(link.hash);
      return target ? { link, target } : null;
    })
    .filter((entry): entry is { link: HTMLAnchorElement; target: HTMLElement } => Boolean(entry));

  if (!sections.length) return;

  const sync = () => {
    const position = window.scrollY + window.innerHeight * 0.38;
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
    setStatus("Submitting your free consultation request...", "loading");

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
        throw new Error(result.message ?? "The request could not be submitted.");
      }

      form.reset();
      setStatus(`Thank you. Your message has been received. Confirmation ${result.receiptId}.`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The request could not be submitted.", "error");
    } finally {
      form.removeAttribute("aria-busy");
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = originalSubmit;
      }
    }
  });
}

setupAmbientCanvas();
setupAnchorScroll();
setupActiveNavigation();
setupContactForm();
