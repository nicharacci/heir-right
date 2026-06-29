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

  const drawField = (time: number) => {
    const driftX = (pointer.x - 0.5) * width * 0.08;
    const driftY = (pointer.y - 0.5) * height * 0.08;
    const fields = [
      {
        x: width * 0.2 + driftX,
        y: height * 0.16 + driftY,
        radius: Math.min(width, height) * 0.48,
        color: "rgba(199, 159, 74, 0.11)",
      },
      {
        x: width * 0.78 - driftX * 0.6,
        y: height * 0.34 - driftY * 0.8,
        radius: Math.min(width, height) * 0.42,
        color: "rgba(240, 234, 214, 0.055)",
      },
      {
        x: width * (0.5 + Math.sin(time * 0.08) * 0.035),
        y: height * 0.94,
        radius: Math.min(width, height) * 0.56,
        color: "rgba(199, 159, 74, 0.075)",
      },
    ];

    fields.forEach((field) => {
      const gradient = context.createRadialGradient(field.x, field.y, 0, field.x, field.y, field.radius);
      gradient.addColorStop(0, field.color);
      gradient.addColorStop(1, "rgba(5, 4, 2, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    });
  };

  const render = () => {
    frame += 1;
    const time = frame / 60;
    pointer.x += (target.x - pointer.x) * 0.055;
    pointer.y += (target.y - pointer.y) * 0.055;

    context.clearRect(0, 0, width, height);

    context.fillStyle = "rgba(5, 4, 2, 0.68)";
    context.fillRect(0, 0, width, height);
    drawField(time);

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
