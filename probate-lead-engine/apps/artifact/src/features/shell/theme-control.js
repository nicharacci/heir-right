import { setTheme, subscribeTheme } from "../../core/theme-store.js";

const THEME_CHOICES = Object.freeze([
  Object.freeze({ id: "dark", label: "Dark" }),
  Object.freeze({ id: "cream", label: "Cream" }),
  Object.freeze({ id: "system", label: "System" }),
]);

function createThemeControl({ announce = () => {} } = {}) {
  const root = document.createElement("div");
  root.className = "shell-theme-control";
  root.setAttribute("role", "group");
  root.setAttribute("aria-label", "Workspace theme");
  root.innerHTML = THEME_CHOICES.map((choice) => `
    <button type="button" data-shell-theme="${choice.id}" aria-pressed="false">${choice.label}</button>
  `).join("");

  const onClick = (event) => {
    const button = event.target.closest("[data-shell-theme]");
    if (!button || !root.contains(button)) return;
    const choice = THEME_CHOICES.find((item) => item.id === button.dataset.shellTheme);
    if (!choice) return;
    setTheme(choice.id);
    announce(`${choice.label} theme selected.`);
  };
  root.addEventListener("click", onClick);

  const unsubscribe = subscribeTheme((theme) => {
    root.querySelectorAll("[data-shell-theme]").forEach((button) => {
      const selected = button.dataset.shellTheme === theme.mode;
      button.setAttribute("aria-pressed", String(selected));
      button.dataset.resolved = selected ? theme.resolved : "";
    });
  });

  return {
    element: root,
    destroy() {
      unsubscribe();
      root.removeEventListener("click", onClick);
      root.remove();
    },
  };
}

export { THEME_CHOICES, createThemeControl };
