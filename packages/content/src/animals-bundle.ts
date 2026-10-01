/// <reference path="./json5.d.ts" />
import type { AnimalData } from '@bale/shared/content';
import animals from '../data/animals.json5';

/** Browser animal data, source-validated by `check:content` without bundling Zod. */
export const ANIMAL_DATA = animals as AnimalData;
