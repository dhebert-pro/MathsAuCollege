(function () {
  "use strict";

  let banks = [];
  let unsubscribe = null;

  function replace(items) {
    banks = items.map((item) => window.AssessmentBank.validate({
      format: item.format,
      version: item.version,
      course: {
        id: item.courseId,
        level: item.level,
        chapterNumber: item.chapterNumber,
        title: item.courseTitle,
        slideCount: item.slideCount,
      },
      exercises: item.exercises,
      updatedAt: item.updatedAt,
    }));
    window.dispatchEvent(new CustomEvent("assessments:changed"));
  }

  window.AssessmentStore = {
    all() { return [...banks]; },
    forLevel(level) { return banks.filter((bank) => bank.level === String(level)); },
    startPublic() {
      this.stop();
      if (!window.FirebaseBackend?.configured) return;
      unsubscribe = window.FirebaseBackend.subscribePublishedAssessmentBanks(replace, () => replace([]));
    },
    startAdmin(onError) {
      this.stop();
      if (!window.FirebaseBackend?.configured) return;
      unsubscribe = window.FirebaseBackend.subscribeAssessmentBanks(replace, onError);
    },
    stop() { unsubscribe?.(); unsubscribe = null; banks = []; },
    async save(bank) { return window.FirebaseBackend.saveAssessmentBank(bank); },
    async remove(courseId) { return window.FirebaseBackend.deleteAssessmentBank(courseId); },
  };
})();
