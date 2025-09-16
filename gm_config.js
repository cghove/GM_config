/*
  GM_config (2025 modernized, HTML-optional)
  Backward-compatible, drop-in replacement for the classic GM_config library.

  Upgrades:
  - i18n-ready labels: Save / Close / Reset via `labels`
  - Optional HTML rendering (opt-in): labels.titleHTML, field.labelHTML, field.sectionHTML
  - Safer DOM defaults (text only unless explicitly enabled)
  - Accessibility tweaks and theme variables
  - Legacy storage kept (GM_*), fallback to localStorage
  - Preserves public API and classic behaviors (like reload on save)

  License: LGPL-3.0-or-later
*/

/* =========================
 *  Public Constructor
 * ========================= */
function GM_configStruct() {
  if (arguments.length) {
    GM_configInit(this, arguments);
    this.onInit();
  }
}

/* =========================
 *  Initializer
 * ========================= */
function GM_configInit(config, args) {
  // One-time bootstrap
  if (typeof config.fields === "undefined") {
    config.fields = {};
    config.onInit = config.onInit || function () {};
    config.onOpen = config.onOpen || function () {};
    config.onSave = config.onSave || function () {};
    config.onClose = config.onClose || function () {};
    config.onReset = config.onReset || function () {};
    config.isOpen = false;

    // Default i18n labels (user can override via settings.labels)
    config.labels = {
      title: "User Script Settings",
      titleHTML: false,              // NEW: allow HTML in title if true
      save: "Save",
      saveTitle: "Save settings",
      close: "Close",
      closeTitle: "Close window",
      reset: "Reset to defaults",
      resetTitle: "Reset fields to default values"
    };

    // Base CSS (scoped by #<id>) + user CSS
    config.css = {
      basic: [
        ":root { --gm-font: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;",
        "        --gm-bg: #ffffff; --gm-fg: #111; --gm-muted: #666; --gm-border: #ddd;",
        "        --gm-primary: #1f6feb; --gm-primary-fg: #fff; --gm-section-bg: #efefef; }",
        "@media (prefers-color-scheme: dark) {",
        "  :root { --gm-bg: #1f1f1f; --gm-fg: #f2f2f2; --gm-muted: #a0a0a0; --gm-border: #3a3a3a; --gm-section-bg: #2a2a2a; }",
        "}",
        "",
        "#GM_config * { font-family: var(--gm-font); box-sizing: border-box; }",
        "#GM_config { background: var(--gm-bg); color: var(--gm-fg); }",
        "#GM_config .config_header { font-size: 1.5rem; margin: 0; padding: 12px 16px; }",
        "#GM_config .config_desc, #GM_config .section_desc, #GM_config .reset { font-size: 0.9rem; color: var(--gm-muted); }",
        "#GM_config .section_header_holder { margin-top: 12px; }",
        "#GM_config .config_var { margin: 0 0 10px; padding: 10px 16px; }",
        "#GM_config .field_label { font-size: 0.95rem; font-weight: 600; margin-right: 8px; }",
        "#GM_config input[type='radio'] { margin-right: 6px; }",
        "#GM_config .radio_label { font-size: 0.95rem; margin-right: 12px; }",
        "#GM_config .block { display: block; }",
        "#GM_config .center { text-align: center; }",
        "#GM_config .section_header { background: #414141; border: 1px solid #000; color: #fff; font-size: 1.1rem; margin: 0; padding: 8px 12px; }",
        "#GM_config .section_desc { background: var(--gm-section-bg); border: 1px solid var(--gm-border); color: var(--gm-muted); font-size: 0.9rem; margin: 0 0 8px; padding: 8px 12px; }",
        "#GM_config .buttons_bar { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px 16px; }",
        "#GM_config .btn { appearance: none; border: 1px solid var(--gm-border); background: var(--gm-bg); color: var(--gm-fg); padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.95rem; }",
        "#GM_config .btn.primary { background: var(--gm-primary); border-color: var(--gm-primary); color: var(--gm-primary-fg); }",
        "#GM_config .btn:focus { outline: 2px solid var(--gm-primary); outline-offset: 2px; }",
        "#GM_config .reset_holder { display: flex; justify-content: flex-end; padding: 0 16px 16px; }",
        "#GM_config .reset { font-size: 0.9rem; }",
        "#GM_config .textlike { font-size: 0.95rem; padding: 6px 8px; border: 1px solid var(--gm-border); border-radius: 6px; width: min(700px, 100%); background: var(--gm-bg); color: var(--gm-fg); }"
      ].join("\n") + "\n",
      basicPrefix: "GM_config",
      stylish: ""
    };
  }

  // Parse initializer args (new style or legacy positional)
  let settings;
  if (
    args.length === 1 &&
    typeof args[0].id === "string" &&
    typeof args[0].appendChild !== "function"
  ) {
    settings = args[0];
  } else {
    settings = {};
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (typeof arg.appendChild === "function") {
        settings.frame = arg;
        continue;
      }

      switch (typeof arg) {
        case "object": {
          let treatedAsFields = false;
          for (const k in arg) {
            if (typeof arg[k] !== "function") {
              treatedAsFields = true;
              settings.fields = arg;
              break;
            }
          }
          if (!treatedAsFields) {
            settings.events = settings.events || {};
            Object.assign(settings.events, arg);
          }
          break;
        }
        case "function":
          settings.events = { onOpen: arg };
          break;
        case "string":
          if (/\w+\s*\{\s*\w+\s*:\s*[\w#().%-]+[\s\S]*\}/.test(arg)) settings.css = arg;
          else settings.title = arg;
          break;
      }
    }
  }

  // id
  if (settings.id) config.id = settings.id;
  else if (typeof config.id === "undefined") config.id = "GM_config";

  // title (goes into labels.title)
  if (settings.title) config.labels.title = settings.title;

  // labels (i18n + options)
  if (settings.labels) {
    config.labels = Object.assign({}, config.labels, settings.labels);
  }

  // user CSS
  if (settings.css) config.css.stylish = settings.css;

  // frame
  if (settings.frame) config.frame = settings.frame;

  // events
  if (settings.events) {
    const events = settings.events;
    for (const e in events) {
      config["on" + e.charAt(0).toUpperCase() + e.slice(1)] = events[e];
    }
  }

  // fields
  if (settings.fields) {
    const stored = config.read();
    const fields = settings.fields;
    const customTypes = settings.types || {};
    const configId = config.id;

    for (const id in fields) {
      const field = fields[id];
      if (field) {
        config.fields[id] = new GM_configField(
          field,
          stored[id],
          id,
          customTypes[field.type],
          configId
        );
      } else if (config.fields[id]) {
        delete config.fields[id];
      }
    }
  }

  // Update internal CSS id prefix if id changed
  if (config.id !== config.css.basicPrefix) {
    config.css.basic = config.css.basic.replace(
      new RegExp("#" + config.css.basicPrefix, "gm"),
      "#" + config.id
    );
    config.css.basicPrefix = config.id;
  }
}

/* =========================
 *  Prototype (public API)
 * ========================= */
GM_configStruct.prototype = {
  init: function () {
    GM_configInit(this, arguments);
    this.onInit();
  },

  open: function () {
    const match = document.getElementById(this.id);
    if (match && (match.tagName === "IFRAME" || match.childNodes.length > 0)) return;

    const config = this;

    function buildConfigWin(body, head, doc) {
      const { create } = config;
      const fields = config.fields;
      const configId = config.id;

      const styleEl = create("style", { type: "text/css" });
      styleEl.appendChild(doc.createTextNode(config.css.basic + config.css.stylish));
      head.appendChild(styleEl);

      const bodyWrapper = create("div", {
        id: configId + "_wrapper",
        role: "dialog",
        "aria-modal": "true"
      });

      const header = create("div", {
        id: configId + "_header",
        className: "config_header block"
      });
      if (config.labels.titleHTML) header.innerHTML = config.labels.title;
      else header.appendChild(doc.createTextNode(config.labels.title));
      bodyWrapper.appendChild(header);

      let section = bodyWrapper;
      let secNum = 0;

      for (const id in fields) {
        const field = fields[id];
        const settings = field.settings;

        if (settings.section) {
          section = bodyWrapper.appendChild(
            create("div", {
              className: "section_header_holder",
              id: configId + "_section_" + secNum
            })
          );

          const sec = Array.isArray(settings.section) ? settings.section : [settings.section];
          const secHTML = !!settings.sectionHTML;

          if (sec[0]) {
            const sh = create("div", {
              className: "section_header center",
              id: configId + "_section_header_" + secNum
            });
            if (secHTML) sh.innerHTML = sec[0];
            else sh.appendChild(doc.createTextNode(sec[0]));
            section.appendChild(sh);
          }
          if (sec[1]) {
            const sd = create("p", {
              className: "section_desc center",
              id: configId + "_section_desc_" + secNum
            });
            if (secHTML) sd.innerHTML = sec[1];
            else sd.appendChild(doc.createTextNode(sec[1]));
            section.appendChild(sd);
          }
          secNum++;
        }

        section.appendChild((field.wrapper = field.toNode(doc)));
      }

      const buttonsBar = create("div", { className: "buttons_bar", id: configId + "_buttons_holder" });

      const saveBtn = create("button", {
        id: configId + "_saveBtn",
        className: "btn primary",
        type: "button",
        title: config.labels.saveTitle
      });
      saveBtn.appendChild(doc.createTextNode(config.labels.save));
      saveBtn.addEventListener("click", function (e) {
        config.save(e);
        try { window.location.reload(); } catch (_) {}
      });

      const closeBtn = create("button", {
        id: configId + "_closeBtn",
        className: "btn",
        type: "button",
        title: config.labels.closeTitle
      });
      closeBtn.appendChild(doc.createTextNode(config.labels.close));
      closeBtn.addEventListener("click", function () { config.close(); });

      buttonsBar.appendChild(saveBtn);
      buttonsBar.appendChild(closeBtn);

      const resetHolder = create("div", { className: "reset_holder block" });
      const resetBtn = create("button", {
        id: configId + "_resetBtn",
        className: "btn",
        type: "button",
        title: config.labels.resetTitle
      });
      resetBtn.appendChild(doc.createTextNode(config.labels.reset));
      resetBtn.addEventListener("click", function (e) {
        e.preventDefault();
        config.reset(e);
        config.save(e);
        try { window.location.reload(); } catch (_) {}
      });
      resetHolder.appendChild(resetBtn);

      bodyWrapper.appendChild(buttonsBar);
      bodyWrapper.appendChild(resetHolder);

      body.appendChild(bodyWrapper);

      config.center();

      setTimeout(() => {
        const firstFieldInput = bodyWrapper.querySelector("input, select, textarea, button");
        (firstFieldInput || saveBtn).focus();
      }, 0);

      config.onOpen(doc, config.frame.contentWindow || window, config.frame);

      doc.addEventListener("keydown", function onKey(e) {
        if (e.key === "Escape") config.close();
      }, { passive: true });

      (config.frame.contentWindow || window).addEventListener("resize", config.center, false);

      config.frame.style.display = "block";
      config.isOpen = true;
    }

    const defaultStyle =
      "position: fixed; inset: 0; margin: auto; height: 75%; width: 75%; max-height: 95%; max-width: 95%;" +
      " border: 1px solid #000; display: none; opacity: 0; background: transparent; z-index: 9999;";

    if (this.frame) {
      this.frame.id = this.id;
      this.frame.setAttribute("style", defaultStyle);
      const doc = this.frame.ownerDocument;
      buildConfigWin(this.frame, doc.getElementsByTagName("head")[0], doc);
    } else {
      const iframe = (this.frame = this.create("iframe", {
        id: this.id,
        style: defaultStyle,
        title: this.labels.title,
        allowtransparency: "true"
      }));
      document.body.appendChild(iframe);

      this.frame.addEventListener("load", () => {
        const frame = this.frame;
        if (frame.src && !frame.contentDocument) frame.src = "";
        const doc = frame.contentDocument;
        if (!doc) { this.log("GM_config failed to initialize default settings dialog node!"); return; }
        const body = doc.getElementsByTagName("body")[0];
        const head = doc.getElementsByTagName("head")[0];
        body.id = this.id;
        body.style.margin = "0";
        buildConfigWin(body, head, doc);
      }, false);

      this.frame.src = "about:blank";
    }
  },

  save: function () {
    const forgotten = this.write();
    this.onSave(forgotten);
  },

  close: function () {
    if (!this.frame) return;

    if (this.frame.contentDocument) {
      this.remove(this.frame);
      this.frame = null;
    } else {
      this.frame.innerHTML = "";
      this.frame.style.display = "none";
    }

    const fields = this.fields;
    for (const id in fields) {
      const field = fields[id];
      field.wrapper = null;
      field.node = null;
    }

    this.onClose();
    this.isOpen = false;
  },

  set: function (name, val) {
    this.fields[name].value = val;
    if (this.fields[name].node) {
      this.fields[name].reload();
    }
  },

  get: function (name, getLive) {
    const field = this.fields[name];
    let fieldVal = null;
    if (getLive && field.node) {
      fieldVal = field.toValue();
    }
    return fieldVal != null ? fieldVal : field.value;
  },

  write: function (store, obj) {
    let values, forgotten;
    if (!obj) {
      values = {};
      forgotten = {};
      const fields = this.fields;
      for (const id in fields) {
        const field = fields[id];
        const value = field.toValue();
        if (field.save) {
          if (value != null) {
            values[id] = value;
            field.value = value;
          } else {
            values[id] = field.value;
          }
        } else {
          forgotten[id] = value;
        }
      }
    }
    try {
      this.setValue(store || this.id, this.stringify(obj || values));
    } catch (e) {
      this.log("GM_config failed to save settings!");
    }
    return forgotten;
  },

  read: function (store) {
    try {
      const raw = this.getValue(store || this.id, "{}");
      return this.parser(raw);
    } catch (e) {
      this.log("GM_config failed to read saved settings!");
      return {};
    }
  },

  reset: function () {
    const fields = this.fields;
    for (const id in fields) fields[id].reset();
    this.onReset();
  },

  create: function () {
    if (arguments.length === 1) {
      return document.createTextNode(arguments[0]);
    }
    const el = document.createElement(arguments[0]);
    const props = arguments[1] || {};
    for (const b in props) {
      if (b.indexOf("on") === 0 && typeof props[b] === "function") {
        el.addEventListener(b.substring(2), props[b], false);
      } else if (",style,accesskey,id,name,src,href,which,for,title,role,aria-modal,allowtransparency".indexOf("," + b.toLowerCase()) !== -1) {
        el.setAttribute(b, props[b]);
      } else {
        el[b] = props[b];
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const child = arguments[i];
      if (typeof child === "string") el.appendChild(document.createTextNode(child));
      else el.appendChild(child);
    }
    return el;
  },

  center: function () {
    const node = this.frame;
    if (!node) return;
    const style = node.style;
    const before = style.opacity;
    if (style.display === "none") style.opacity = "0";
    style.display = "";
    requestAnimationFrame(() => {
      style.transition = "opacity 120ms ease-out";
      style.opacity = before === "0" ? "1" : "1";
    });
  },

  remove: function (el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
};

/* =========================
 *  Storage and logging API
 * ========================= */
(function () {
  const isGM =
    typeof GM_getValue !== "undefined" &&
    typeof GM_getValue("a", "b") !== "undefined";

  let setValue, getValue, stringify, parser;

  if (!isGM) {
    setValue = function (name, value) { try { return localStorage.setItem(name, value); } catch (_) {} };
    getValue = function (name, def) { try { const s = localStorage.getItem(name); return s == null ? def : s; } catch (_) { return def; } };
    stringify = JSON.stringify;
    parser = JSON.parse;
  } else {
    setValue = function (name, value) { return GM_setValue(name, value); };
    getValue = function (name, def) { const v = GM_getValue(name); return typeof v === "undefined" ? def : v; };
    stringify = typeof JSON === "undefined" ? function (obj) { return obj.toSource(); } : JSON.stringify;
    /* eslint-disable no-new-func */
    parser = typeof JSON === "undefined" ? function (jsonData) { return (new Function("return " + jsonData + ";"))(); } : JSON.parse;
  }

  GM_configStruct.prototype.isGM = isGM;
  GM_configStruct.prototype.setValue = setValue;
  GM_configStruct.prototype.getValue = getValue;
  GM_configStruct.prototype.stringify = stringify;
  GM_configStruct.prototype.parser = parser;
  GM_configStruct.prototype.log =
    (window.console && console.log)
      ? console.log.bind(console, "[GM_config]")
      : (typeof GM_log !== "undefined" ? GM_log : (window.opera ? opera.postError : function () {}));
})();

/* =========================
 *  Helpers
 * ========================= */
function GM_configDefaultValue(type, options) {
  let value;
  if ((type || "").indexOf("unsigned ") === 0) type = type.substring(9);

  switch (type) {
    case "radio":
    case "select":
      value = options && options.length ? options[0] : "";
      break;
    case "checkbox":
      value = false;
      break;
    case "int":
    case "integer":
    case "float":
    case "number":
      value = 0;
      break;
    default:
      value = "";
  }
  return value;
}

/* =========================
 *  Field class
 * ========================= */
function GM_configField(settings, stored, id, customType, configId) {
  this.settings = settings || {};
  this.id = id;
  this.configId = configId;
  this.node = null;
  this.wrapper = null;
  this.save = typeof settings.save === "undefined" ? true : settings.save;

  if (settings.type === "button") this.save = false;

  this["default"] =
    typeof settings["default"] === "undefined"
      ? (customType
          ? customType["default"]
          : GM_configDefaultValue(settings.type || "text", settings.options))
      : settings["default"];

  this.value = typeof stored === "undefined" ? this["default"] : stored;

  if (customType) {
    this.toNode = customType.toNode;
    this.toValue = customType.toValue;
    this.reset = customType.reset;
  }
}

GM_configField.prototype = {
  create: GM_configStruct.prototype.create,

  toNode: function (doc) {
    const field = this.settings;
    const value = this.value;
    const options = field.options || [];
    let type = field.type || "text";
    const id = this.id;
    const configId = this.configId;
    const labelPos = field.labelPos;
    const create = this.create;

    const d = doc || document;

    const retNode = create("div", {
      className: "config_var",
      id: configId + "_" + id + "_var",
      title: field.title || ""
    });

    let firstProp;
    for (const k in field) { firstProp = k; break; }

    const needsLabel = field.label && type !== "button";
    const labelEl = needsLabel
      ? create("label", {
          id: configId + "_" + id + "_field_label",
          for: configId + "_field_" + id,
          className: "field_label"
        })
      : null;

    if (labelEl) {
      if (field.labelHTML === true) labelEl.innerHTML = field.label;
      else labelEl.appendChild(d.createTextNode(field.label));
    }

    const attachLabel = (pos, parentNode, beforeEl) => {
      if (!beforeEl) beforeEl = parentNode.firstChild;
      switch (pos) {
        case "right":
        case "below":
          if (pos === "below") parentNode.appendChild(create("br", {}));
          parentNode.appendChild(labelEl);
          break;
        default:
          if (pos === "above") parentNode.insertBefore(create("br", {}), beforeEl);
          parentNode.insertBefore(labelEl, beforeEl);
      }
    };

    switch (type) {
      case "textarea": {
        this.node = create("textarea", {
          id: configId + "_field_" + id,
          className: "block textlike",
          cols: field.cols ? field.cols : 20,
          rows: field.rows ? field.rows : 3
        });
        this.node.value = value != null ? String(value) : "";
        retNode.appendChild(this.node);
        break;
      }
      case "radio": {
        const wrap = create("div", { id: configId + "_field_" + id });
        this.node = wrap;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const radio = create("input", {
            value: opt,
            type: "radio",
            name: id,
            checked: opt === value
          });
          const radLabel = create("label", { className: "radio_label" });
          radLabel.appendChild(d.createTextNode(opt));
          wrap.appendChild(radio);
          wrap.appendChild(radLabel);
        }
        retNode.appendChild(wrap);
        break;
      }
      case "select": {
        const wrap = create("select", { id: configId + "_field_" + id, className: "textlike" });
        this.node = wrap;
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          const optEl = d.createElement("option");
          optEl.value = opt;
          optEl.appendChild(d.createTextNode(opt));
          if (opt === value) optEl.selected = true;
          wrap.appendChild(optEl);
        }
        retNode.appendChild(wrap);
        break;
      }
      default: {
        const props = { id: configId + "_field_" + id };
        switch (type) {
          case "checkbox":
            this.node = create("input", Object.assign(props, { type: "checkbox", checked: !!value }));
            break;
          case "button": {
            const size = field.size ? field.size : 25;
            this.node = create("input", Object.assign(props, { type: "button", value: field.label || "", size }));
            if (field.script) this.node.addEventListener("click", field.script, false);
            if (field.click) this.node.addEventListener("click", field.click, false);
            break;
          }
          case "hidden":
            this.node = create("input", Object.assign(props, { type: "hidden", value: value != null ? String(value) : "" }));
            break;
          case "int":
          case "integer":
          case "float":
          case "number":
          case "text":
          default: {
            let inputType = "text";
            if (type === "int" || type === "integer" || type === "float" || type === "number") {
              inputType = "number";
            }
            const size = field.size ? field.size : 25;
            this.node = create("input", Object.assign(props, {
              type: inputType,
              value: value != null ? String(value) : "",
              size,
              className: "textlike"
            }));
            if (field.min != null) this.node.setAttribute("min", String(field.min));
            if (field.max != null) this.node.setAttribute("max", String(field.max));
            if (field.step != null) this.node.setAttribute("step", String(field.step));
          }
        }
        retNode.appendChild(this.node);
      }
    }

    if (labelEl) {
      let lp = labelPos;
      if (!lp) lp = firstProp === "label" || type === "radio" ? "left" : "right";
      attachLabel(lp, retNode);
    }

    return retNode;
  },

  toValue: function () {
    const node = this.node;
    const field = this.settings;
    let type = field.type || "text";
    let unsigned = false;
    let rval = null;

    if (!node) return rval;

    if (type.indexOf("unsigned ") === 0) {
      type = type.substring(9);
      unsigned = true;
    }

    switch (type) {
      case "checkbox":
        rval = !!node.checked;
        break;
      case "select":
        rval = node[node.selectedIndex] ? node[node.selectedIndex].value : "";
        break;
      case "radio": {
        const radios = node.querySelectorAll("input[type='radio']");
        for (let i = 0; i < radios.length; i++) {
          if (radios[i].checked) { rval = radios[i].value; break; }
        }
        break;
      }
      case "button":
        break;
      case "int":
      case "integer":
      case "float":
      case "number": {
        const raw = node.value;
        const num = Number(raw);
        const isInt = type.substr(0, 3) === "int";
        const warn = 'Field labeled "' + (field.label || this.id) + '" expects a' + (unsigned ? " positive " : " ") + (isInt ? "integer" : "number") + " value";

        if (raw !== "" && (Number.isNaN(num) || (isInt && Math.ceil(num) !== Math.floor(num)) || (unsigned && num < 0))) {
          alert(warn + ".");
          return null;
        }
        if (!this._checkNumberRange(num, warn)) return null;
        rval = raw === "" ? "" : num;
        break;
      }
      default:
        rval = node.value;
        break;
    }

    return rval;
  },

  reset: function () {
    const node = this.node;
    const field = this.settings;
    const type = field.type || "text";
    if (!node) return;

    switch (type) {
      case "checkbox":
        node.checked = !!this["default"];
        break;
      case "select": {
        const opts = node.options || [];
        for (let i = 0; i < opts.length; i++) {
          if (opts[i].textContent === String(this["default"])) { node.selectedIndex = i; break; }
        }
        break;
      }
      case "radio": {
        const radios = node.querySelectorAll("input[type='radio']");
        for (let i = 0; i < radios.length; i++) {
          if (radios[i].value === String(this["default"])) { radios[i].checked = true; break; }
        }
        break;
      }
      case "button":
        break;
      default:
        node.value = this["default"] != null ? String(this["default"]) : "";
        break;
    }
  },

  remove: function (el) {
    GM_configStruct.prototype.remove(el || this.wrapper);
    this.wrapper = null;
    this.node = null;
  },

  reload: function () {
    const wrapper = this.wrapper;
    if (wrapper) {
      const fieldParent = wrapper.parentNode;
      fieldParent.insertBefore((this.wrapper = this.toNode(wrapper.ownerDocument || document)), wrapper);
      this.remove(wrapper);
    }
  },

  _checkNumberRange: function (num, warn) {
    const field = this.settings;
    if (typeof field.min === "number" && num < field.min) {
      alert(warn + " greater than or equal to " + field.min + ".");
      return null;
    }
    if (typeof field.max === "number" && num > field.max) {
      alert(warn + " less than or equal to " + field.max + ".");
      return null;
    }
    return true;
  }
};

/* =========================
 *  Default singleton
 * ========================= */
var GM_config = new GM_configStruct();
