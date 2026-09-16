import {
  getThemeMode,
  getUserThemeId,
  isEnabled,
  isExecutorSearchFixEnabled,
  isSimplifyTitlesEnabled,
  setEnabled,
  setExecutorSearchFixEnabled,
  setSimplifyTitlesEnabled,
  setThemeMode,
  setUserThemeId,
} from "../core/storage.js";
import {
  DEFAULT_USER_THEME_ID,
  getThemes,
  isThemeMode,
  loadThemes,
  type ThemeMode,
} from "../core/theme-meta.js";

const enabledCheckbox = document.getElementById("enabled") as HTMLInputElement | null;
const simplifyCheckbox = document.getElementById("simplify-titles") as HTMLInputElement | null;
const executorFixCheckbox = document.getElementById("executor-fix") as HTMLInputElement | null;
const hint = document.getElementById("hint") as HTMLParagraphElement | null;
const themeIdSelect = document.getElementById("theme-id") as HTMLSelectElement | null;
const themeIdRow = themeIdSelect?.closest(".popup__theme-row") as HTMLElement | null;
const themeModeRadios = Array.from(
  document.querySelectorAll<HTMLInputElement>("input[name='theme-mode']")
);

function syncSelectVisibility(mode: ThemeMode): void {
  if (!themeIdRow) return;
  themeIdRow.style.display = mode === "fixed" ? "" : "none";
}

async function init(): Promise<void> {
  if (enabledCheckbox) {
    enabledCheckbox.checked = await isEnabled();
    enabledCheckbox.addEventListener("change", async () => {
      await setEnabled(enabledCheckbox.checked);
      setHint(enabledCheckbox.checked ? "Обогащение включено." : "Обогащение выключено.");
    });
  }

  if (simplifyCheckbox) {
    simplifyCheckbox.checked = await isSimplifyTitlesEnabled();
    simplifyCheckbox.addEventListener("change", async () => {
      await setSimplifyTitlesEnabled(simplifyCheckbox.checked);
      setHint(
        simplifyCheckbox.checked
          ? "Упрощение названий включено (применится к новым карточкам)."
          : "Упрощение названий выключено (уже упрощённые заголовки вернутся после перезагрузки)."
      );
    });
  }

  if (executorFixCheckbox) {
    executorFixCheckbox.checked = await isExecutorSearchFixEnabled();
    executorFixCheckbox.addEventListener("change", async () => {
      await setExecutorSearchFixEnabled(executorFixCheckbox.checked);
      setHint(
        executorFixCheckbox.checked
          ? "Поиск в «Исполнителе»: исправлен (нужен ввод в поле)."
          : "Поиск в «Исполнителе»: стоковое поведение Admin24."
      );
    });
  }

  const loaded = await loadThemes();
  if (!loaded) {
    setHint("Не удалось загрузить список тем (themes.json).");
    syncSelectVisibility("fixed");
    if (themeIdSelect) themeIdSelect.disabled = true;
    for (const radio of themeModeRadios) {
      radio.disabled = true;
    }
    return;
  }

  if (themeIdSelect) {
    for (const theme of getThemes()) {
      const opt = document.createElement("option");
      opt.value = theme.id;
      opt.textContent = theme.label;
      themeIdSelect.appendChild(opt);
    }

    const currentId = await getUserThemeId();
    themeIdSelect.value = currentId;

    themeIdSelect.addEventListener("change", async () => {
      await setUserThemeId(themeIdSelect.value);
      const label =
        themeIdSelect.selectedOptions[0]?.textContent ?? themeIdSelect.value;
      setHint(`Тема: ${label}.`);
    });
  }

  const currentMode = await getThemeMode();
  syncSelectVisibility(currentMode);

  for (const radio of themeModeRadios) {
    radio.checked = radio.value === currentMode;
    radio.addEventListener("change", async () => {
      if (!radio.checked) return;
      const value = radio.value;
      if (!isThemeMode(value)) return;
      await setThemeMode(value);
      syncSelectVisibility(value);
      setHint(modeHint(value, themeIdSelect));
    });
  }
}

function modeHint(mode: ThemeMode, select: HTMLSelectElement | null): string {
  if (mode === "native") return "Тема: оригинальная Admin24.";
  if (mode === "auto") return "Тема: авто по системной.";
  const label = select?.selectedOptions[0]?.textContent ?? DEFAULT_USER_THEME_ID;
  return `Тема: ${label}.`;
}

function setHint(text: string): void {
  if (hint) hint.textContent = text;
}

void init();