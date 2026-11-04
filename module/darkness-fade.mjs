import {
  DARKNESS_FADE_DEFAULT_SECONDS,
  DARKNESS_FADE_MAX_SECONDS,
  changesDarkness,
  darknessFadeMilliseconds
} from "./darkness-fade-core.mjs";

const SCOPE = "worlds-beyond";

// Every change to a scene's darkness fades over the chosen time: time jumps from calendar modules,
// Foundry's Day/Night buttons and edits in Scene settings. Only the look changes; no game data does.
export function registerDarknessFade() {
  game.settings.register(SCOPE, "darknessFadeSeconds", {
    name: "Day and night fade (seconds)",
    hint: "How long a scene takes to fade when its darkness changes, including big time jumps. 0 leaves fades to Foundry and other modules.",
    scope: "world",
    config: true,
    type: Number,
    default: DARKNESS_FADE_DEFAULT_SECONDS,
    range: { min: 0, max: DARKNESS_FADE_MAX_SECONDS, step: 1 }
  });
  Hooks.on("preUpdateScene", (scene, changes, options) => {
    if (!changesDarkness(changes)) return;
    const duration = darknessFadeMilliseconds(game.settings.get(SCOPE, "darknessFadeSeconds"));
    if (duration !== null) options.animateDarkness = duration;
  });
}
