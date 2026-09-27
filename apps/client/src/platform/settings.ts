import type { SettingsStore } from '../i18n/runtime.ts';

/**
 * Settings persistence backed by `localStorage`. ARCHITECTURE §4.4 puts saves in
 * `idb-keyval`, but a setting read before the first render has to be synchronous, and
 * IndexedDB is not. M2's storage adapter takes this over.
 *
 * Every access is guarded: in a private window or with site data blocked, touching
 * `localStorage` throws rather than returning null.
 */
export const localSettings: SettingsStore = {
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore: a forgotten preference is better than a failed locale switch.
    }
  },
};
