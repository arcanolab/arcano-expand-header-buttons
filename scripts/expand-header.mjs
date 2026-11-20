/**
 * Expand Header Buttons 1.0.1 — Foundry VTT v14
 *
 * Shows the controls that Foundry hides in the three-dot header menu as
 * always-visible icon buttons: a bar on the left or right of the window,
 * or inline in the window header.
 *
 * v14 no longer renders a dropdown in the DOM (the three-dot button opens a
 * context menu built on demand), so this version works on the control data
 * (`_headerControlButtons`) instead of scraping the DOM:
 *  - controls moved to the bar are filtered out of the three-dot menu;
 *  - controls left in the menu stay there, and the three-dot button hides
 *    by itself when nothing is left.
 */

const MODULE_ID = "expand-header-buttons";
const BAR_CLASS = "ehb-sidebar";
const INLINE_CLASS = "ehb-inline";

const { ApplicationV2, HandlebarsApplicationMixin, DocumentSheetV2 } = foundry.applications.api;

/** True while the module itself reads the unfiltered control list. */
let readingRaw = false;

/** Cached set of control keys that must stay in the three-dot menu. */
let disabledCache = null;

/** Every control seen so far: key -> {key, action, icon, label}. */
const known = new Map();
let knownDirty = false;

/* -------------------------------------------- */
/*  Settings                                    */
/* -------------------------------------------- */

export function registerSettings() {
  game.settings.register(MODULE_ID, "position", {
    name: "EHB.Settings.Position.Name",
    hint: "EHB.Settings.Position.Hint",
    scope: "client",
    config: true,
    type: String,
    choices: {
      left: "EHB.Settings.Position.Left",
      right: "EHB.Settings.Position.Right",
      header: "EHB.Settings.Position.Header"
    },
    default: "left",
    onChange: refreshAll
  });

  game.settings.register(MODULE_ID, "sheetsOnly", {
    name: "EHB.Settings.SheetsOnly.Name",
    hint: "EHB.Settings.SheetsOnly.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: refreshAll
  });

  game.settings.register(MODULE_ID, "gmOnly", {
    name: "EHB.Settings.GmOnly.Name",
    hint: "EHB.Settings.GmOnly.Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: refreshAll
  });

  // JSON array of control keys kept in the three-dot menu (same storage as the v13 release).
  game.settings.register(MODULE_ID, "disabledButtons", {
    scope: "world",
    config: false,
    type: String,
    default: "[]",
    onChange: () => {
      disabledCache = null;
      refreshAll();
    }
  });

  // Controls this client has already seen, so the config window can list
  // them without a sheet being open.
  game.settings.register(MODULE_ID, "knownButtons", {
    scope: "client",
    config: false,
    type: String,
    default: "[]"
  });

  game.settings.registerMenu(MODULE_ID, "buttonConfig", {
    name: "EHB.Settings.Menu.Name",
    label: "EHB.Settings.Menu.Label",
    hint: "EHB.Settings.Menu.Hint",
    icon: "fa-solid fa-bars",
    type: EHBConfigApp,
    restricted: true
  });
}

function disabledKeys() {
  if ( !disabledCache ) {
    try {
      disabledCache = new Set(JSON.parse(game.settings.get(MODULE_ID, "disabledButtons")));
    } catch {
      disabledCache = new Set();
    }
  }
  return disabledCache;
}

/* -------------------------------------------- */
/*  Control helpers                             */
/* -------------------------------------------- */

function controlKey(control) {
  return control.action || `${control.icon ?? ""}|${control.label ?? ""}`;
}

/** Is this control configured to stay in the three-dot menu? */
function isDisabled(control) {
  const keys = disabledKeys();
  // The second test understands lists saved by the v13 release, which keyed by icon class.
  return keys.has(controlKey(control)) || keys.has(`control-icon fa-fw ${control.icon}`);
}

/** Mirror of the core rule: actions bound only to other mouse buttons never reach the menu. */
function isLeftClickable(app, control) {
  const handler = app.options?.actions?.[control.action];
  return !((typeof handler === "object") && handler?.buttons && !handler.buttons.includes(0));
}

/** Does this window get expanded buttons for the current user? */
function isActive(app) {
  if ( !app?.hasFrame ) return false;
  if ( game.settings.get(MODULE_ID, "gmOnly") && !game.user.isGM ) return false;
  if ( game.settings.get(MODULE_ID, "sheetsOnly") && !(app instanceof DocumentSheetV2) ) return false;
  return true;
}

/** The visible controls of a window, unfiltered and without duplicates. */
function collectControls(app) {
  let controls = [];
  readingRaw = true;
  try {
    controls = Array.from(app._headerControlButtons());
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not read header controls of "${app.title}"`, err);
  } finally {
    readingRaw = false;
  }

  const unique = new Map();
  for ( const control of controls ) {
    if ( !isLeftClickable(app, control) ) continue;
    unique.set(controlKey(control), control);
    remember(control);
  }
  return Array.from(unique.values());
}

function remember(control) {
  const key = controlKey(control);
  const label = game.i18n.localize(control.label ?? "");
  const previous = known.get(key);
  if ( previous && (previous.label === label) && (previous.icon === control.icon) ) return;
  known.set(key, { key, action: control.action ?? "", icon: control.icon ?? "", label });
  knownDirty = true;
  saveKnown();
}

const saveKnown = foundry.utils.debounce(() => {
  if ( !knownDirty ) return;
  knownDirty = false;
  game.settings.set(MODULE_ID, "knownButtons", JSON.stringify(Array.from(known.values())));
}, 1000);

function loadKnown() {
  try {
    for ( const entry of JSON.parse(game.settings.get(MODULE_ID, "knownButtons")) ) {
      if ( entry?.key && !known.has(entry.key) ) known.set(entry.key, entry);
    }
  } catch { /* A broken list only means the config window starts empty. */ }
}

/* -------------------------------------------- */
/*  Three-dot menu filter                       */
/* -------------------------------------------- */

/**
 * Core and system code build the three-dot menu (and decide whether to show
 * the three-dot button) from `_headerControlButtons`. Filtering there keeps
 * the moved controls out of the menu without touching the DOM.
 */
export function patchHeaderControls() {
  const proto = ApplicationV2.prototype;
  if ( proto._headerControlButtons.ehbPatched ) return;
  const original = proto._headerControlButtons;

  proto._headerControlButtons = function* () {
    const filter = !readingRaw && isActive(this);
    for ( const control of original.call(this) ) {
      if ( filter && !isDisabled(control) && isLeftClickable(this, control) ) continue;
      yield control;
    }
  };
  proto._headerControlButtons.ehbPatched = true;
}

/* -------------------------------------------- */
/*  Building the buttons                        */
/* -------------------------------------------- */

function placementFor(app) {
  // A detached window fills its own browser window: a bar outside the frame
  // would be invisible there, so the buttons go into the header instead.
  if ( app.element.ownerDocument !== document ) return "header";
  return game.settings.get(MODULE_ID, "position");
}

function makeButton(app, control, placement) {
  const doc = app.element.ownerDocument;
  const button = doc.createElement("button");
  const label = game.i18n.localize(control.label ?? "");
  button.type = "button";
  button.dataset.tooltip = label;
  button.setAttribute("aria-label", label);

  if ( placement === "header" ) {
    button.className = `header-control icon ${control.icon ?? ""} ${INLINE_CLASS}`;
  } else {
    button.className = "ehb-btn";
    button.dataset.tooltipDirection = placement === "right" ? "RIGHT" : "LEFT";
    const icon = doc.createElement("i");
    icon.className = `fa-fw ${control.icon ?? ""}`;
    icon.inert = true;
    button.append(icon);
  }

  // Same precedence as the core menu: an explicit onClick wins; otherwise the
  // window's own [data-action] click handling runs the action.
  if ( typeof control.onClick === "function" ) {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      control.onClick(event, button);
    });
  } else if ( control.action ) {
    button.dataset.action = control.action;
  }
  return button;
}

export function build(app) {
  const element = app?.element;
  if ( !element || !app.hasFrame || !app.window?.header ) return;

  element.querySelectorAll(`.${BAR_CLASS}, .${INLINE_CLASS}`).forEach(el => el.remove());

  const controls = collectControls(app);
  const moved = isActive(app) ? controls.filter(c => !isDisabled(c)) : [];

  // The three-dot button only stays while something is left in its menu.
  app.window.controls?.classList.toggle("hidden", controls.length === moved.length);
  if ( !moved.length ) return;

  const placement = placementFor(app);
  const buttons = moved.map(control => makeButton(app, control, placement));

  if ( placement === "header" ) {
    const anchor = app.window.controls ?? app.window.close;
    if ( anchor ) anchor.before(...buttons);
    else app.window.header.append(...buttons);
    return;
  }

  const bar = element.ownerDocument.createElement("nav");
  bar.className = `${BAR_CLASS} ehb-${placement}`;
  bar.append(...buttons);
  element.append(bar);
}

export function refreshAll() {
  for ( const app of foundry.applications.instances.values() ) {
    try {
      build(app);
    } catch (err) {
      console.warn(`${MODULE_ID} |`, err);
    }
  }
}

/* -------------------------------------------- */
/*  Config window                               */
/* -------------------------------------------- */

class EHBConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "ehb-config",
    tag: "form",
    classes: ["ehb-config"],
    window: {
      title: "EHB.Config.Title",
      icon: "fa-solid fa-bars",
      contentClasses: ["standard-form"]
    },
    position: { width: 480 },
    form: {
      handler: EHBConfigApp.#onSubmit,
      closeOnSubmit: true
    },
    actions: {
      ehbCheckAll: EHBConfigApp.#onCheckAll,
      ehbCheckNone: EHBConfigApp.#onCheckAll
    }
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/config.hbs`, scrollable: [".ehb-config-list"] },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  async _prepareContext() {
    // Pick up controls of the windows that are open right now.
    for ( const app of foundry.applications.instances.values() ) {
      if ( app.hasFrame ) collectControls(app);
    }
    const buttons = Array.from(known.values())
      .map(b => ({ ...b, enabled: !isDisabled(b) }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    return {
      buttons,
      footer: [{ type: "submit", icon: "fa-solid fa-floppy-disk", label: "EHB.Config.Save" }]
    };
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( partId === "footer" ) context.buttons = context.footer;
    return context;
  }

  static #onCheckAll(_event, target) {
    const checked = target.dataset.action === "ehbCheckAll";
    for ( const box of this.element.querySelectorAll(".ehb-config-list input[type=checkbox]") ) {
      box.checked = checked;
    }
  }

  static async #onSubmit() {
    // Read the checkboxes directly: control keys may contain dots, which
    // FormData expansion would turn into nested objects.
    const disabled = [];
    for ( const box of this.element.querySelectorAll(".ehb-config-list input[type=checkbox]") ) {
      if ( !box.checked ) disabled.push(box.dataset.key);
    }
    await game.settings.set(MODULE_ID, "disabledButtons", JSON.stringify(disabled));
    ui.notifications.info("EHB.Config.Saved", { localize: true });
  }
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerSettings();
  patchHeaderControls();
});

Hooks.once("ready", () => {
  loadKnown();
  refreshAll();
});

Hooks.on("renderApplicationV2", app => {
  try {
    build(app);
  } catch (err) {
    console.warn(`${MODULE_ID} |`, err);
  }
});
