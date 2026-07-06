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

  type FlowField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

  const screens = Array.from(form.querySelectorAll<HTMLElement>("[data-contact-screen]"));
  const indicators = Array.from(document.querySelectorAll<HTMLElement>("[data-contact-step]"));
  const successPanel = form.querySelector<HTMLElement>("[data-form-success]");
  let activeStep = 0;
  let advanceLocked = false;

  const isSpanish = document.documentElement.lang.toLowerCase().startsWith("es");
  const messages = isSpanish
    ? {
        submitting: "Enviando su solicitud de consulta gratis...",
        submitAria: "Enviando solicitud de consulta gratis",
        submitButton: "Enviando...",
        fallback:
          "No se pudo enviar la solicitud. Comuníquese con HeirRight o intente nuevamente en breve.",
        unknownError: "No se pudo enviar la solicitud.",
      }
    : {
        submitting: "Submitting your free consultation request...",
        submitAria: "Submitting free consultation request",
        submitButton: "Submitting...",
        fallback:
          "The request could not be submitted. Please contact HeirRight or try again shortly.",
        unknownError: "The request could not be submitted.",
      };

  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const originalSubmit = submit?.innerHTML ?? "";

  const clearStatus = () => {
    status.textContent = "";
    status.hidden = true;
    delete status.dataset.state;
  };

  const setStatus = (message: string, state: "success" | "error" | "loading") => {
    status.textContent = message;
    status.hidden = false;
    status.dataset.state = state;
    status.focus({ preventScroll: true });
  };

  const syncFlow = (isSuccess = false) => {
    form.dataset.flowStep = String(activeStep + 1);
    form.classList.toggle("is-success", isSuccess);

    screens.forEach((screen, index) => {
      const isActive = !isSuccess && index === activeStep;
      screen.hidden = !isActive;
      screen.classList.toggle("is-active", isActive);
    });

    indicators.forEach((indicator, index) => {
      const isComplete = isSuccess || index < activeStep;
      const isActive = !isSuccess && index === activeStep;
      indicator.classList.toggle("is-complete", isComplete);
      indicator.classList.toggle("is-active", isActive);
      if (isActive) {
        indicator.setAttribute("aria-current", "step");
      } else {
        indicator.removeAttribute("aria-current");
      }
    });

    if (successPanel) {
      successPanel.hidden = !isSuccess;
      successPanel.classList.toggle("is-visible", isSuccess);
    }
  };

  const setStep = (step: number) => {
    activeStep = Math.max(0, Math.min(step, Math.max(0, screens.length - 1)));
    clearStatus();
    syncFlow(false);

    const firstField = screens[activeStep]?.querySelector<FlowField>("input, textarea, select");
    firstField?.focus({ preventScroll: true });
  };

  const validateScreen = (screen: HTMLElement | undefined) => {
    if (!screen) return true;
    const fields = Array.from(screen.querySelectorAll<FlowField>("input, textarea, select"));
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus({ preventScroll: true });
        return false;
      }
    }
    return true;
  };

  const getFlowNextTarget = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
    return element?.closest<HTMLButtonElement>("[data-flow-next]") ?? null;
  };

  const advanceFromEvent = (event: Event) => {
    const target = getFlowNextTarget(event.target);
    if (!target || !form.contains(target)) return;
    event.preventDefault();
    if (advanceLocked) return;
    advanceLocked = true;
    window.setTimeout(() => {
      advanceLocked = false;
    }, 0);
    if (!validateScreen(screens[activeStep])) return;
    setStep(activeStep + 1);
  };

  form.addEventListener("pointerup", advanceFromEvent);
  form.addEventListener("click", advanceFromEvent);
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    advanceFromEvent(event);
  });

  syncFlow(false);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (activeStep < screens.length - 1) {
      if (validateScreen(screens[activeStep])) setStep(activeStep + 1);
      return;
    }

    if (!validateScreen(screens[activeStep])) return;

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    form.setAttribute("aria-busy", "true");
    if (submit) {
      submit.disabled = true;
      submit.textContent = messages.submitButton;
      submit.setAttribute("aria-label", messages.submitAria);
    }
    setStatus(messages.submitting, "loading");

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
        throw new Error(result?.message ?? messages.fallback);
      }

      form.reset();
      clearStatus();
      syncFlow(true);
      successPanel?.focus({ preventScroll: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : messages.unknownError, "error");
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

function setupHeritageViewer(): void {
  const viewer = document.querySelector<HTMLElement>("[data-heritage-viewer]");
  const panels = Array.from(viewer?.querySelectorAll<HTMLElement>("[data-heritage-panel]") ?? []);
  const tabs = Array.from(viewer?.querySelectorAll<HTMLButtonElement>("[data-heritage-target]") ?? []);
  const caption = viewer?.querySelector<HTMLElement>("[data-heritage-caption]");
  const supportsHover = window.matchMedia("(hover: hover)").matches;

  if (!viewer || !panels.length || !tabs.length) return;

  const setActive = (index: number) => {
    const activeTab = tabs[index];
    if (!activeTab) return;

    panels.forEach((panel, panelIndex) => {
      const isActive = panelIndex === index;
      panel.classList.toggle("is-active", isActive);
      panel.setAttribute("aria-hidden", String(!isActive));
    });

    tabs.forEach((tab, tabIndex) => {
      const isActive = tabIndex === index;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    if (caption && activeTab.dataset.heritageCaption) {
      caption.textContent = activeTab.dataset.heritageCaption;
    }
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setActive(index));
    tab.addEventListener("focus", () => setActive(index));

    if (supportsHover) {
      tab.addEventListener("pointerenter", () => setActive(index));
    }

    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + direction + tabs.length) % tabs.length;
      setActive(nextIndex);
      tabs[nextIndex]?.focus();
    });
  });

  setActive(Math.max(tabs.findIndex((tab) => tab.classList.contains("is-active")), 0));
}

function setupTestimonialPlayer(): void {
  const player = document.querySelector<HTMLElement>("[data-testimonial-player]");
  const video = player?.querySelector<HTMLVideoElement>("[data-testimonial-video]");
  const source = player?.querySelector<HTMLSourceElement>("[data-testimonial-source]");
  const playButton = player?.querySelector<HTMLButtonElement>("[data-testimonial-play]");
  const thumbs = Array.from(player?.querySelectorAll<HTMLButtonElement>("[data-video-src]") ?? []);

  if (!player || !video || !source || !playButton || !thumbs.length) return;

  let activeIndex = Math.max(
    thumbs.findIndex((thumb) => thumb.classList.contains("is-active")),
    0
  );
  let swapTimer: number | undefined;

  const syncPlayButton = () => {
    player.classList.toggle("is-playing", !video.paused && !video.ended);
  };

  const fadeMainVideo = () => {
    if (reducedMotion) return;

    window.clearTimeout(swapTimer);
    player.classList.add("is-swapping");
    swapTimer = window.setTimeout(() => player.classList.remove("is-swapping"), 260);
  };

  const setActive = (index: number) => {
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
      fadeMainVideo();
      source.src = src;
      video.poster = poster;
      video.load();
    }

    syncPlayButton();

    const playerRect = player.getBoundingClientRect();
    const playerIsVisible = playerRect.bottom > 0 && playerRect.top < window.innerHeight;

    if (playerIsVisible) {
      nextThumb.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
  };

  thumbs.forEach((thumb, index) => {
    thumb.addEventListener("click", () => {
      setActive(index);
    });
  });

  playButton.addEventListener("click", () => {
    void video.play().catch(() => undefined);
  });

  video.addEventListener("play", syncPlayButton);
  video.addEventListener("pause", syncPlayButton);
  video.addEventListener("ended", syncPlayButton);

  setActive(activeIndex);
  syncPlayButton();
}

setupAmbientCanvas();
setupAnchorScroll();
setupActiveNavigation();
setupContactForm();
setupArchiveGallery();
setupHeritageViewer();
setupTestimonialPlayer();
