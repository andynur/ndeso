import type { DialogNpcId, DialogStories } from '@bale/content/dialog';
import type { LocaleId } from '@bale/shared';
import { signal } from '@preact/signals';
import { Story } from 'inkjs';

export interface DialogChoiceView {
  readonly index: number;
  readonly text: string;
}

export interface DialogView {
  readonly npcId: DialogNpcId;
  readonly text: string;
  readonly choices: readonly DialogChoiceView[];
  readonly complete: boolean;
}

export const dialogView = signal<DialogView | null>(null);

export interface DialogController {
  readonly active: boolean;
  start(npcId: DialogNpcId, script: 'morning' | 'day' | 'evening'): Promise<void>;
  advance(): void;
  choose(index: number): void;
  close(): void;
}

interface DialogOptions {
  readonly locale: () => LocaleId;
  readonly loadStories: (locale: LocaleId) => Promise<DialogStories>;
}

/** Owns ephemeral Ink continuation state; durable game state stays in the sim. */
export function createDialogController(options: DialogOptions): DialogController {
  const cache = new Map<LocaleId, DialogStories>();
  let story: Story | undefined;
  let npcId: DialogNpcId | undefined;
  let opening = false;
  let request = 0;

  const present = (): void => {
    if (!story || !npcId) return;
    while (story.canContinue) {
      const text = story.Continue()?.trim() ?? '';
      if (text === '') continue;
      dialogView.value = {
        npcId,
        text,
        choices: story.currentChoices.map((choice) => ({
          index: choice.index,
          text: choice.text.trim(),
        })),
        complete: !story.canContinue && story.currentChoices.length === 0,
      };
      return;
    }
    const current = dialogView.peek();
    if (current && story.currentChoices.length > 0) {
      dialogView.value = {
        ...current,
        choices: story.currentChoices.map((choice) => ({
          index: choice.index,
          text: choice.text.trim(),
        })),
        complete: false,
      };
      return;
    }
    if (current) dialogView.value = { ...current, choices: [], complete: true };
    else dialogView.value = null;
  };
  const close = (): void => {
    request++;
    opening = false;
    story = undefined;
    npcId = undefined;
    dialogView.value = null;
  };

  return {
    get active() {
      return opening || dialogView.peek() !== null;
    },
    async start(nextNpcId, script) {
      const ownRequest = ++request;
      opening = true;
      const activeLocale = options.locale();
      let stories = cache.get(activeLocale);
      if (!stories) {
        stories = await options.loadStories(activeLocale);
        cache.set(activeLocale, stories);
      }
      if (ownRequest !== request) return;
      story = new Story(stories[nextNpcId]);
      npcId = nextNpcId;
      story.ChoosePathString(script);
      opening = false;
      present();
    },
    advance() {
      if (!story || !dialogView.peek()) return;
      if (dialogView.peek()?.complete) {
        close();
        return;
      }
      present();
    },
    choose(index) {
      if (!story || !story.currentChoices.some((choice) => choice.index === index)) return;
      story.ChooseChoiceIndex(index);
      present();
    },
    close,
  };
}
