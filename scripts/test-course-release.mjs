import assert from "node:assert/strict";
import { releasePlan } from "../course-release.mjs";

const course = (id, chapterNumber) => ({
  id, title: `Chapitre ${chapterNumber}`, chapterNumber, level: "6", status: "published", manualOrder: null,
  slideCount: 2, blocks: [
    { id: `${id}-a`, slideBreakBefore: false },
    { id: `${id}-b`, slideBreakBefore: false },
    { id: `${id}-c`, slideBreakBefore: true },
  ],
});
const courses = [course("second", "2"), course("first", "1"), { ...course("fourth", "1"), level: "4" }];
const classes = [{ id: "6A", level: "6" }, { id: "6B", level: "6" }];
const progress = [
  { classId: "6A", courseId: "first", maxSlideIndex: 1, maxRevealIndex: 0 },
  { classId: "6B", courseId: "second", maxSlideIndex: 1, maxRevealIndex: 1 },
];

let plan = releasePlan(courses, classes, progress);
assert.equal(plan.get("first").blocks.length, 3, "Earlier chapter is complete");
assert.deepEqual(plan.get("second").blocks.map((block) => block.id), ["second-a", "second-b"]);
assert.equal(plan.get("fourth").blocks.length, 3, "Level without tracked classes stays complete");

plan = releasePlan(courses, classes, progress.slice(0, 1));
assert.deepEqual(plan.get("first").blocks.map((block) => block.id), ["first-a"]);
assert.equal(plan.get("second").blocks.length, 0, "Later chapter is locked");

plan = releasePlan(courses, classes, []);
assert.equal(plan.get("first").blocks.length, 0, "No chapter has started");

plan = releasePlan(courses, [], []);
assert.equal(plan.get("first").blocks.length, 3, "Level without classes stays complete");
console.log("Course release tests passed");
