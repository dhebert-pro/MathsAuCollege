import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const context = {
  window: { CourseContent: { LEVELS: ["6", "5", "4", "3"] } },
  crypto: webcrypto,
  Intl,
  TextEncoder,
};
runInNewContext(readFileSync(resolve("assessment-bank.js"), "utf8"), context);
const api = context.window.AssessmentBank;
const bank = api.validate({
  format: api.FORMAT,
  version: api.VERSION,
  course: { id: "course-2", level: "6", chapterNumber: "2", title: "Fractions", slideCount: 5 },
  exercises: [
    { id: "direct", title: "Application", pages: [1], durationMinutes: 4, importance: 10, content: "Calculer {{a}} + {{b}}.", variables: { a: { type: "range", min: 2, max: 8, step: 2 }, b: { type: "choice", values: [3, 5] } }, answerLines: 3 },
    { id: "tuple", title: "Problème", pages: [2, 3], durationMinutes: 6, importance: 7, content: "Côtés : {{a}}, {{b}}, {{c}}.", variables: { triangle: { type: "tuple", values: [{ a: 3, b: 4, c: 5 }, { a: 5, b: 5, c: 8 }] } }, answerLines: 5 },
    { id: "vocab", title: "Vocabulaire", pages: [4], durationMinutes: 2, importance: 4, content: "Donner la définition demandée.", variables: {}, answerLines: 2 },
  ],
});
assert.equal(bank.exercises.length, 3);
const one = api.selectExercises(bank.exercises, 10, "same-scope");
const two = api.selectExercises(bank.exercises, 10, "same-scope");
assert.deepEqual(one.exercises.map((item) => item.id), two.exercises.map((item) => item.id));
assert.equal(one.estimatedMinutes, 10);
const generated = api.instantiate(bank.exercises[0]);
assert.doesNotMatch(generated.content, /\{\{/);
assert.match(generated.content, /Calculer/);
assert.throws(() => api.validate({ ...bank, course: { level: "6", title: "X", slideCount: 5 }, exercises: [{ ...bank.exercises[0], content: "{{unknown}}" }] }), /n’est pas définie/);
console.log("Assessment bank tests passed");
