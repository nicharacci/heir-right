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
      submit.setAttribute("aria-label", "Submitting free consultation request");
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

      const contentType = response.headers.get("content-type") ?? "";
      const result = contentType.includes("application/json")
        ? ((await response.json()) as {
            ok?: boolean;
            receiptId?: string;
            message?: string;
          })
        : null;

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ?? "The request could not be submitted. Please contact HeirRight or try again shortly."
        );
      }

      form.reset();
      setStatus(`Thank you. Your message has been received. Confirmation ${result.receiptId}.`, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The request could not be submitted.", "error");
    } finally {
      form.removeAttribute("aria-busy");
      if (submit) {
        submit.disabled = false;
        submit.removeAttribute("aria-label");
        submit.innerHTML = originalSubmit;
      }
    }
  });
}

function setupArchiveGallery(): void {
  const gallery = document.querySelector<HTMLElement>("[data-archive-gallery]");
  const feature = gallery?.querySelector<HTMLElement>(".archive-feature");
  const featureImage = gallery?.querySelector<HTMLImageElement>("[data-archive-feature]");
  const tiles = Array.from(gallery?.querySelectorAll<HTMLButtonElement>("[data-gallery-src]") ?? []);
  const supportsHover = window.matchMedia("(hover: hover)").matches;
  let swapTimer: number | undefined;

  if (!gallery || !feature || !featureImage || !tiles.length) return;

  const setActive = (tile: HTMLButtonElement) => {
    const src = tile.dataset.gallerySrc;
    const alt = tile.dataset.galleryAlt;

    if (!src || !alt) return;

    tiles.forEach((entry) => {
      const isActive = entry === tile;
      entry.classList.toggle("is-active", isActive);
      if (isActive) {
        entry.setAttribute("aria-current", "true");
      } else {
        entry.removeAttribute("aria-current");
      }
    });

    if (featureImage.getAttribute("src") === src) return;

    window.clearTimeout(swapTimer);
    feature.classList.add("is-swapping");
    featureImage.src = src;
    featureImage.alt = alt;
    swapTimer = window.setTimeout(() => feature.classList.remove("is-swapping"), 220);
  };

  tiles.forEach((tile) => {
    tile.addEventListener("click", () => setActive(tile));
    tile.addEventListener("focus", () => setActive(tile));

    if (supportsHover) {
      tile.addEventListener("pointerenter", () => setActive(tile));
    }
  });
}

function setupTestimonialPlayer(): void {
  const player = document.querySelector<HTMLElement>("[data-testimonial-player]");
  const video = player?.querySelector<HTMLVideoElement>("[data-testimonial-video]");
  const source = player?.querySelector<HTMLSourceElement>("[data-testimonial-source]");
  const dock = player?.querySelector<HTMLElement>("[data-testimonial-dock]");
  const thumbs = Array.from(player?.querySelectorAll<HTMLButtonElement>("[data-video-src]") ?? []);

  if (!player || !video || !source || !dock || !thumbs.length) return;

  let activeIndex = Math.max(
    thumbs.findIndex((thumb) => thumb.classList.contains("is-active")),
    0
  );
  let cycleTimer: number | undefined;
  let userPausedCycle = false;

  const clearNeighborLift = () => {
    thumbs.forEach((thumb) => thumb.classList.remove("is-near"));
  };

  const syncNeighborLift = (index: number) => {
    thumbs.forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-near", Math.abs(thumbIndex - index) === 1);
    });
  };

  const setActive = (index: number, playAfterSwap = false) => {
    const nextThumb = thumbs[index];
    const src = nextThumb?.dataset.videoSrc;
    const poster = nextThumb?.dataset.videoPoster;

    if (!nextThumb || !src || !poster) return;

    activeIndex = index;
    thumbs.forEach((thumb, thumbIndex) => {
      const isActive = thumbIndex === activeIndex;
      thumb.classList.toggle("is-active", isActive);
      if (isActive) {
        thumb.setAttribute("aria-current", "true");
      } else {
        thumb.removeAttribute("aria-current");
      }
    });

    const absoluteSrc = new URL(src, window.location.href).href;
    if (source.src !== absoluteSrc) {
      video.pause();
      source.src = src;
      video.poster = poster;
      video.load();
    }

    const playerRect = player.getBoundingClientRect();
    const playerIsVisible = playerRect.bottom > 0 && playerRect.top < window.innerHeight;

    if (playerIsVisible) {
      nextThumb.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }

    if (playAfterSwap) {
      void video.play().catch(() => undefined);
    }
  };

  const stopCycle = () => {
    window.clearInterval(cycleTimer);
    cycleTimer = undefined;
  };

  const advance = () => {
    setActive((activeIndex + 1) % thumbs.length);
  };

  const startCycle = () => {
    if (reducedMotion || userPausedCycle || cycleTimer) return;

    cycleTimer = window.setInterval(() => {
      if (!document.hidden && video.paused) {
        advance();
      }
    }, 8500);
  };

  thumbs.forEach((thumb, index) => {
    thumb.addEventListener("click", () => {
      userPausedCycle = true;
      stopCycle();
      setActive(index);
    });

    thumb.addEventListener("pointerenter", () => syncNeighborLift(index));
    thumb.addEventListener("focus", () => {
      dock.classList.add("is-open");
      syncNeighborLift(index);
    });
  });

  dock.addEventListener("pointerleave", clearNeighborLift);
  dock.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!dock.contains(document.activeElement)) {
        dock.classList.remove("is-open");
        clearNeighborLift();
      }
    }, 0);
  });

  player.addEventListener("mouseenter", stopCycle);
  player.addEventListener("mouseleave", startCycle);
  player.addEventListener("focusin", stopCycle);

  video.addEventListener("play", () => {
    userPausedCycle = true;
    stopCycle();
  });
  video.addEventListener("ended", () => {
    userPausedCycle = false;
    advance();
    startCycle();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopCycle();
    } else {
      startCycle();
    }
  });

  setActive(activeIndex);
  startCycle();
}

setupAmbientCanvas();
setupAnchorScroll();
setupActiveNavigation();
setupContactForm();
setupArchiveGallery();
setupTestimonialPlayer();
