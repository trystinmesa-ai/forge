// Find an exercise by id across the built-in library and your custom exercises.
import { EXERCISES } from './exercises.js';

const builtIn = new Map(EXERCISES.map((e) => [e.id, e]));
let custom = new Map();

export const setCustom = (list) => { custom = new Map(list.map((e) => [e.id, e])); };
export const exercise = (id) => custom.get(id) || builtIn.get(id) || null;

/** Display name; an unknown id (e.g. a removed exercise) still shows something readable. */
export const exerciseName = (id) =>
  exercise(id)?.name || String(id).replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const allExercises = () => [...builtIn.values(), ...custom.values()];
