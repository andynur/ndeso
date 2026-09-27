/**
 * Key parsing for `t()`. Separate from the runtime so it can be tested without a DOM:
 * everything here is pure and depends only on the generated namespace list.
 */

import { GENERATED_NAMESPACES, type GeneratedNamespace } from '@bale/content/i18n';

/** I18N §2: `ui` is the default namespace, so `t('hud.money')` needs no prefix. */
export const DEFAULT_NAMESPACE: GeneratedNamespace = 'ui';

export function isNamespace(value: string): value is GeneratedNamespace {
  return (GENERATED_NAMESPACES as readonly string[]).includes(value);
}

export interface ParsedKey {
  readonly namespace: GeneratedNamespace;
  readonly id: string;
}

/**
 * `'items:crop.cabai.name'` → items / crop.cabai.name; `'hud.money'` → ui / hud.money.
 * An unknown prefix is treated as part of a default-namespace key rather than throwing,
 * so a typo surfaces as one missing-key warning instead of a crash mid-render.
 */
export function splitKey(key: string): ParsedKey {
  const colon = key.indexOf(':');
  if (colon === -1) return { namespace: DEFAULT_NAMESPACE, id: key };
  const prefix = key.slice(0, colon);
  if (!isNamespace(prefix)) return { namespace: DEFAULT_NAMESPACE, id: key };
  return { namespace: prefix, id: key.slice(colon + 1) };
}
