import type { LocaleId } from '@bale/shared';

export type DialogNpcId = 'bu_ratna' | 'mbah_hita' | 'pak_harjo';
export type DialogStories = Readonly<Record<DialogNpcId, string>>;

/** Locale chunks stay lazy; Ink JSON is compiled from source by the Bun plugin. */
export async function loadDialogStories(locale: LocaleId): Promise<DialogStories> {
  return locale === 'id'
    ? (await import('./dialog-id.ts')).DIALOG_ID
    : (await import('./dialog-en.ts')).DIALOG_EN;
}
