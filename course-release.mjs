// A course becomes complete once a tracked class has started a later course.
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

export function sortLevelCourses(courses) {
  return [...courses].sort((a, b) => {
    const aManual = Number.isInteger(a.manualOrder);
    const bManual = Number.isInteger(b.manualOrder);
    if (aManual && bManual && a.manualOrder !== b.manualOrder) return a.manualOrder - b.manualOrder;
    if (aManual !== bManual) return aManual ? -1 : 1;
    if (Boolean(a.chapterNumber) !== Boolean(b.chapterNumber)) return a.chapterNumber ? -1 : 1;
    if (a.chapterNumber && b.chapterNumber) {
      const byNumber = collator.compare(a.chapterNumber, b.chapterNumber);
      if (byNumber) return byNumber;
    }
    return collator.compare(a.title, b.title);
  });
}

export function releasedCourse(course, progressRecords, mode = "partial") {
  if (mode === "full") return { ...course };
  if (mode === "locked") return { ...course, blocks: [], slideCount: 1 };
  const slides = [];
  (course.blocks || []).forEach((block) => {
    if (!slides.length || (block.slideBreakBefore && slides.at(-1).length)) slides.push([]);
    slides.at(-1).push(block);
  });
  let furthestSlide = 0;
  let furthestReveal = 0;
  progressRecords.forEach((progress) => {
    const slide = Math.max(0, Math.min(slides.length, Number(progress.maxSlideIndex ?? progress.slideIndex) || 0));
    const reveal = Math.max(0, Number(progress.maxRevealIndex ?? progress.revealIndex) || 0);
    if (slide > furthestSlide || (slide === furthestSlide && reveal > furthestReveal)) {
      furthestSlide = slide;
      furthestReveal = reveal;
    }
  });
  const blocks = slides.slice(0, Math.max(0, furthestSlide - 1)).flat();
  if (furthestSlide) blocks.push(...slides[furthestSlide - 1].slice(0, furthestReveal + 1));
  return { ...course, blocks, slideCount: Math.max(1, furthestSlide) };
}

export function releasePlan(courses, classes, progressRecords) {
  const result = new Map();
  const levels = new Set(courses.map((course) => course.level));
  levels.forEach((level) => {
    const ordered = sortLevelCourses(courses.filter((course) => course.level === level && course.status === "published"));
    const matchingClasses = classes.filter((item) => item.level === level);
    if (!matchingClasses.length) {
      ordered.forEach((course) => result.set(course.id, releasedCourse(course, [], "full")));
      return;
    }
    const classIds = new Set(matchingClasses.map((item) => item.id));
    const matchingProgress = progressRecords.filter((item) => classIds.has(item.classId));
    const furthest = ordered.reduce((index, course, current) =>
      matchingProgress.some((progress) => progress.courseId === course.id && Number(progress.maxSlideIndex ?? progress.slideIndex) > 0)
        ? current : index, -1);
    ordered.forEach((course, index) => {
      const mode = index < furthest ? "full" : index === furthest ? "partial" : "locked";
      result.set(course.id, releasedCourse(course, matchingProgress.filter((item) => item.courseId === course.id), mode));
    });
  });
  return result;
}
