// Builds the TurboWarp settings form. Used for global defaults and for per-game overrides.
import { PLAYER_SETTING_GROUPS, PlayerSettings } from '../../shared/settings';

type Key = keyof PlayerSettings;

export interface FormOptions {
  /** Current values shown in the form. */
  values: PlayerSettings;
  /** Per-game mode: the global defaults. Rows that differ get a "Custom" badge and a reset button. */
  defaults?: PlayerSettings;
  /** Per-game mode: which keys this game overrides. */
  overridden?: ReadonlySet<Key>;
  onChange(key: Key, value: PlayerSettings[Key]): void;
  onReset?(key: Key): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function describeValue(key: Key, value: PlayerSettings[Key]): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (key === 'framerate') return `${value} FPS`;
  if (typeof value === 'number') return `${value}px`;
  return value ? `"${value}"` : 'empty';
}

export function renderSettingsForm(container: HTMLElement, options: FormOptions): void {
  const perGame = !!options.defaults;
  container.replaceChildren();

  for (const group of PLAYER_SETTING_GROUPS) {
    const section = el('section', 'settings-group');
    section.append(el('h3', '', group.title));
    if (group.blurb) section.append(el('p', 'group-blurb', group.blurb));

    for (const info of group.settings) {
      const key = info.key;
      const value = options.values[key];
      const isCustom = perGame && options.overridden?.has(key);

      const row = el('div', `setting-row${isCustom ? ' is-custom' : ''}`);
      const text = el('div', 'setting-text');
      const labelLine = el('div', 'setting-label');
      const inputId = `${container.id}-${key}`; // unique per form: both forms can exist at once
      const label = el('label', '', info.label);
      label.htmlFor = inputId;
      labelLine.append(label);
      if (isCustom) labelLine.append(el('span', 'custom-badge', 'Custom'));
      text.append(labelLine, el('p', 'setting-description', info.description));
      if (perGame && options.defaults) {
        text.append(el('p', 'setting-default', `Default: ${describeValue(key, options.defaults[key])}`));
      }

      const control = el('div', 'setting-control');
      if (info.type === 'toggle') {
        const toggle = el('input', 'toggle');
        toggle.type = 'checkbox';
        toggle.id = inputId;
        toggle.checked = value as boolean;
        toggle.setAttribute('role', 'switch');
        toggle.addEventListener('change', () => options.onChange(key, toggle.checked));
        control.append(toggle);
      } else if (info.type === 'select') {
        const select = el('select');
        select.id = inputId;
        const choices = [...info.options];
        // Keep odd values (e.g. edited by hand) selectable instead of silently showing another one.
        if (!choices.some((o) => o.value === value)) choices.push({ value: value as number, label: `${value} FPS` });
        for (const option of choices) {
          const opt = el('option', '', option.label);
          opt.value = String(option.value);
          opt.selected = option.value === value;
          select.append(opt);
        }
        select.addEventListener('change', () => options.onChange(key, Number(select.value)));
        control.append(select);
      } else if (info.type === 'number') {
        const input = el('input', 'number-input');
        input.type = 'number';
        input.id = inputId;
        input.min = String(info.min);
        input.max = String(info.max);
        input.value = String(value);
        input.addEventListener('change', () => {
          const n = Math.round(Number(input.value));
          if (!Number.isFinite(n) || n < info.min || n > info.max) {
            input.value = String(options.values[key]); // reject and restore
            return;
          }
          options.onChange(key, n);
        });
        control.append(input);
        if (info.unit) control.append(el('span', 'unit', info.unit));
      } else {
        const input = el('input', 'text-input');
        input.type = 'text';
        input.id = inputId;
        input.maxLength = info.maxLength;
        input.placeholder = info.placeholder ?? '';
        input.value = String(value);
        input.spellcheck = false;
        input.addEventListener('change', () => options.onChange(key, input.value.trim()));
        control.append(input);
      }

      if (isCustom && options.onReset) {
        const reset = el('button', 'reset-button', 'Reset');
        reset.type = 'button';
        reset.title = 'Use the default for this setting';
        reset.addEventListener('click', () => options.onReset!(key));
        control.append(reset);
      }

      row.append(text, control);
      section.append(row);
    }
    container.append(section);
  }
}
