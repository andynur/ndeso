import { expect, test } from 'bun:test';
import { Compiler } from 'inkjs/full';
import { createDialogController, dialogView } from './dialog.ts';

function compiled(source: string): string {
  return new Compiler(source).Compile().ToJson() as string;
}

test('dialog controller presents lines, choices, and the chosen ending', async () => {
  const story = compiled(`=== morning ===
Hello.
* [One]
  First.
  -> END
* [Two]
  Second.
  -> END`);
  const stories = { mbah_hita: story, pak_harjo: story, bu_ratna: story };
  const controller = createDialogController({
    locale: () => 'en',
    loadStories: async () => stories,
  });

  await controller.start('mbah_hita', 'morning');
  expect(dialogView.value?.text).toBe('Hello.');
  expect(dialogView.value?.choices.map((choice) => choice.text)).toEqual(['One', 'Two']);
  controller.choose(1);
  expect(dialogView.value?.text).toBe('Second.');
  expect(dialogView.value?.complete).toBe(true);
  controller.advance();
  expect(dialogView.value).toBeNull();
});

test('an unbound advance callback can close a completed dialog', async () => {
  const story = compiled(`=== morning ===\nDone.\n-> END`);
  const stories = { mbah_hita: story, pak_harjo: story, bu_ratna: story };
  const controller = createDialogController({
    locale: () => 'en',
    loadStories: async () => stories,
  });
  await controller.start('mbah_hita', 'morning');
  const onAdvance = controller.advance;
  onAdvance();
  expect(dialogView.value).toBeNull();
});
