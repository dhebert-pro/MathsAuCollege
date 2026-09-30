(function () {
  "use strict";

  const FORMAT = "maths-au-college/assessment-bank";
  const VERSION = 1;
  const MAX_FILE_BYTES = 1024 * 1024;
  const variableName = /^[a-z][a-z0-9_]{0,31}$/i;
  const COMPETENCIES = ["Chercher", "Représenter", "Modéliser", "Raisonner", "Calculer", "Communiquer"];

  function invalid(message) {
    const error = new Error(message);
    error.code = "invalid-assessment-bank";
    throw error;
  }

  function text(value, maximum, label, required = true) {
    const result = String(value || "").trim();
    if ((required && !result) || result.length > maximum) invalid(`${label} est absent ou trop long.`);
    return result;
  }

  function finite(value, minimum, maximum, label) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum) invalid(`${label} doit être compris entre ${minimum} et ${maximum}.`);
    return number;
  }

  function cleanScalar(value, label) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && value.length <= 80) return value.trim();
    invalid(`${label} doit être un nombre ou un texte court.`);
  }

  function cleanVariable(name, source, exerciseNumber) {
    if (!variableName.test(name)) invalid(`Le nom de variable « ${name} » de l’exercice ${exerciseNumber} est invalide.`);
    if (!source || typeof source !== "object") invalid(`La variable « ${name} » de l’exercice ${exerciseNumber} est invalide.`);
    if (source.type === "choice") {
      const values = Array.isArray(source.values) ? source.values.map((value) => cleanScalar(value, `Une valeur de ${name}`)) : [];
      if (!values.length || values.length > 100) invalid(`La variable « ${name} » doit proposer entre 1 et 100 valeurs.`);
      return { type: "choice", values };
    }
    if (source.type === "range") {
      const minimum = finite(source.min, -1000000, 1000000, `Le minimum de ${name}`);
      const maximum = finite(source.max, -1000000, 1000000, `Le maximum de ${name}`);
      const step = finite(source.step ?? 1, 0.000001, 1000000, `Le pas de ${name}`);
      if (maximum < minimum || Math.floor((maximum - minimum) / step) > 10000) invalid(`L’intervalle de « ${name} » est invalide ou trop large.`);
      const exclude = Array.isArray(source.exclude) ? source.exclude.map((value) => finite(value, -1000000, 1000000, `Une exclusion de ${name}`)).slice(0, 100) : [];
      return { type: "range", min: minimum, max: maximum, step, exclude };
    }
    if (source.type === "tuple") {
      const values = Array.isArray(source.values) ? source.values : [];
      if (!values.length || values.length > 100) invalid(`La variable liée « ${name} » doit proposer entre 1 et 100 jeux de valeurs.`);
      const cleaned = values.map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) invalid(`Un jeu de valeurs de « ${name} » est invalide.`);
        const pairs = Object.entries(entry);
        if (!pairs.length || pairs.length > 20) invalid(`Un jeu de valeurs de « ${name} » est vide ou trop grand.`);
        return Object.fromEntries(pairs.map(([key, value]) => {
          if (!variableName.test(key)) invalid(`La sous-variable « ${key} » est invalide.`);
          return [key, cleanScalar(value, `La sous-variable ${key}`)];
        }));
      });
      const expectedKeys = Object.keys(cleaned[0]).sort().join("|");
      if (cleaned.some((entry) => Object.keys(entry).sort().join("|") !== expectedKeys)) {
        invalid(`Tous les jeux de valeurs de « ${name} » doivent contenir les mêmes sous-variables.`);
      }
      return { type: "tuple", values: cleaned };
    }
    invalid(`Le type de la variable « ${name} » doit être choice, range ou tuple.`);
  }

  function cleanVariables(source, exerciseNumber, label = "L’exercice") {
    const variables = source && typeof source === "object" && !Array.isArray(source) ? source : {};
    if (Object.keys(variables).length > 24) invalid(`${label} ${exerciseNumber} contient trop de variables.`);
    return Object.fromEntries(Object.entries(variables).map(([name, variable]) => [name, cleanVariable(name, variable, exerciseNumber)]));
  }

  function availableVariableNames(variables) {
    const available = new Set();
    Object.entries(variables).forEach(([name, variable]) => {
      if (variable.type === "tuple") Object.keys(variable.values[0]).forEach((key) => available.add(key));
      else available.add(name);
    });
    return available;
  }

  function validatePlaceholders(template, variables, label) {
    const available = availableVariableNames(variables);
    const placeholders = [...String(template).matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((match) => match[1]);
    const unknown = placeholders.find((name) => !available.has(name));
    if (unknown) invalid(`La variable {{${unknown}}} de ${label} n’est pas définie.`);
  }

  function cleanRepeat(source, exerciseNumber) {
    if (!source) return null;
    if (typeof source !== "object" || Array.isArray(source)) invalid(`La série de questions de l’exercice ${exerciseNumber} est invalide.`);
    const count = Math.round(finite(source.count, 2, 12, `Le nombre de questions répétées de l’exercice ${exerciseNumber}`));
    const template = text(source.template, 600, `Le modèle de question répétée de l’exercice ${exerciseNumber}`);
    const variables = cleanVariables(source.variables, exerciseNumber, "La série de l’exercice");
    validatePlaceholders(template, variables, `la série de l’exercice ${exerciseNumber}`);
    return { count, template, variables };
  }

  function coordinate(value, label) { return finite(value, 0, 1000, label); }

  function cleanFigureElement(source, figureNumber, elementNumber) {
    if (!source || typeof source !== "object") invalid(`L’élément ${elementNumber} de la figure ${figureNumber} est invalide.`);
    const type = String(source.type || "");
    const label = text(source.label || source.text || "", 100, `Le texte de l’élément ${elementNumber}`, false);
    const common = { type, label, dashed: Boolean(source.dashed) };
    if (type === "point") return { ...common, x: coordinate(source.x, "L’abscisse du point"), y: coordinate(source.y, "L’ordonnée du point") };
    if (type === "segment") return { ...common, x1: coordinate(source.x1, "x1"), y1: coordinate(source.y1, "y1"), x2: coordinate(source.x2, "x2"), y2: coordinate(source.y2, "y2") };
    if (type === "circle") return { ...common, cx: coordinate(source.cx, "L’abscisse du centre"), cy: coordinate(source.cy, "L’ordonnée du centre"), r: finite(source.r, 1, 500, "Le rayon") };
    if (type === "text") return { ...common, x: coordinate(source.x, "L’abscisse du texte"), y: coordinate(source.y, "L’ordonnée du texte") };
    if (type === "polygon") {
      const points = Array.isArray(source.points) ? source.points : [];
      if (points.length < 3 || points.length > 12) invalid(`Le polygone de la figure ${figureNumber} doit avoir entre 3 et 12 sommets.`);
      return { ...common, points: points.map((point) => {
        if (!Array.isArray(point) || point.length !== 2) invalid(`Un sommet de la figure ${figureNumber} est invalide.`);
        return [coordinate(point[0], "L’abscisse du sommet"), coordinate(point[1], "L’ordonnée du sommet")];
      }) };
    }
    invalid(`Le type « ${type} » de la figure ${figureNumber} doit être point, segment, circle, polygon ou text.`);
  }

  function cleanFigures(source, exerciseNumber, variables) {
    const figures = Array.isArray(source) ? source : [];
    if (figures.length > 2) invalid(`L’exercice ${exerciseNumber} ne peut pas contenir plus de deux figures.`);
    return figures.map((figure, index) => {
      const number = index + 1;
      if (!figure || typeof figure !== "object") invalid(`La figure ${number} de l’exercice ${exerciseNumber} est invalide.`);
      const elements = Array.isArray(figure.elements) ? figure.elements : [];
      if (!elements.length || elements.length > 60) invalid(`La figure ${number} doit contenir entre 1 et 60 éléments.`);
      const cleaned = {
        width: finite(figure.width ?? 600, 100, 1000, `La largeur de la figure ${number}`),
        height: finite(figure.height ?? 300, 80, 700, `La hauteur de la figure ${number}`),
        description: text(figure.description, 180, `La description de la figure ${number}`),
        elements: elements.map((element, elementIndex) => cleanFigureElement(element, number, elementIndex + 1)),
      };
      cleaned.elements.forEach((element) => validatePlaceholders(element.label, variables, `la figure ${number} de l’exercice ${exerciseNumber}`));
      return cleaned;
    });
  }

  function validateExercise(source, index, slideCount) {
    const number = index + 1;
    if (!source || typeof source !== "object") invalid(`L’exercice ${number} est invalide.`);
    const pages = [...new Set((Array.isArray(source.pages) ? source.pages : []).map(Number))].sort((a, b) => a - b);
    if (!pages.length || pages.length > 20 || pages.some((page) => !Number.isInteger(page) || page < 1 || page > slideCount)) {
      invalid(`Les pages de l’exercice ${number} doivent être comprises entre 1 et ${slideCount}.`);
    }
    const cleanedVariables = cleanVariables(source.variables, number);
    const content = text(source.content, 4000, `Le texte de l’exercice ${number}`);
    validatePlaceholders(content, cleanedVariables, `l’exercice ${number}`);
    const competencies = [...new Set(Array.isArray(source.competencies) ? source.competencies.map(String) : [])];
    if (competencies.some((competency) => !COMPETENCIES.includes(competency))) invalid(`Une compétence de l’exercice ${number} n’est pas reconnue.`);
    const repeat = cleanRepeat(source.repeat, number);
    const figures = cleanFigures(source.figures, number, cleanedVariables);
    return {
      id: text(source.id || `exercise-${number}`, 80, `L’identifiant de l’exercice ${number}`).replace(/[^a-z0-9_-]+/gi, "-").toLowerCase(),
      title: text(source.title || `Exercice ${number}`, 100, `Le titre de l’exercice ${number}`),
      pages,
      durationMinutes: Math.round(finite(source.durationMinutes, 1, 30, `La durée de l’exercice ${number}`)),
      importance: Math.round(finite(source.importance ?? 5, 0, 10, `L’importance de l’exercice ${number}`)),
      content,
      variables: cleanedVariables,
      repeat,
      figures,
      competencies: COMPETENCIES.filter((competency) => competencies.includes(competency)),
      answerLines: Math.round(finite(source.answerLines ?? 4, 0, 20, `Le nombre de lignes de l’exercice ${number}`)),
    };
  }

  function validate(value) {
    if (!value || typeof value !== "object" || value.format !== FORMAT || Number(value.version) !== VERSION) invalid("Le format du fichier d’évaluation n’est pas reconnu.");
    const course = value.course;
    if (!course || typeof course !== "object") invalid("La section course est absente.");
    const level = String(course.level || "");
    if (!window.CourseContent.LEVELS.includes(level)) invalid("Le niveau doit être 6, 5, 4 ou 3.");
    const slideCount = Math.round(finite(course.slideCount, 1, 200, "Le nombre de pages du cours"));
    const sources = Array.isArray(value.exercises) ? value.exercises : [];
    if (!sources.length || sources.length > 200) invalid("Le fichier doit contenir entre 1 et 200 exercices.");
    const exercises = sources.map((source, index) => validateExercise(source, index, slideCount));
    if (new Set(exercises.map((exercise) => exercise.id)).size !== exercises.length) invalid("Chaque exercice doit avoir un identifiant différent.");
    return {
      format: FORMAT,
      version: VERSION,
      courseId: String(course.id || "").trim(),
      level,
      chapterNumber: String(course.chapterNumber || "").trim().slice(0, 20),
      courseTitle: text(course.title, 120, "Le titre du cours"),
      slideCount,
      exercises,
      updatedAt: String(value.updatedAt || new Date().toISOString()),
    };
  }

  async function read(file) {
    if (!file || file.size > MAX_FILE_BYTES) invalid("Le fichier dépasse la limite de 1 Mo.");
    try { return validate(JSON.parse(await file.text())); }
    catch (error) { if (error?.code === "invalid-assessment-bank") throw error; invalid("Le fichier n’est pas un JSON valide."); }
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); }
    return result >>> 0;
  }

  function seeded(seed) {
    let state = hash(seed) || 1;
    return () => { state += 0x6D2B79F5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
  }

  function selectExercises(candidates, duration, seed) {
    const random = seeded(seed);
    const scored = candidates.map((item) => ({ ...item, selectionScore: (item.importance + 0.05) * (0.75 + random() * 0.5) }));
    const target = Math.max(1, Math.round(Number(duration) || 1));
    const states = Array(target + 1).fill(null);
    states[0] = { score: 0, items: [] };
    scored.forEach((item) => {
      for (let time = target; time >= item.durationMinutes; time -= 1) {
        const previous = states[time - item.durationMinutes];
        if (!previous) continue;
        const next = { score: previous.score + item.selectionScore, items: [...previous.items, item] };
        if (!states[time] || next.score > states[time].score) states[time] = next;
      }
    });
    for (let time = target; time >= 1; time -= 1) if (states[time]) return { exercises: states[time].items, estimatedMinutes: time };
    const shortest = [...scored].sort((a, b) => a.durationMinutes - b.durationMinutes || b.selectionScore - a.selectionScore)[0];
    return shortest ? { exercises: [shortest], estimatedMinutes: shortest.durationMinutes } : { exercises: [], estimatedMinutes: 0 };
  }

  function mergeExercises(current, incoming) {
    const merged = new Map((Array.isArray(current) ? current : []).map((exercise) => [exercise.id, exercise]));
    let replacements = 0;
    let unchanged = 0;
    const addedIds = [];
    const replacedIds = [];
    const unchangedIds = [];
    (Array.isArray(incoming) ? incoming : []).forEach((exercise) => {
      if (!merged.has(exercise.id)) addedIds.push(exercise.id);
      else if (JSON.stringify(merged.get(exercise.id)) === JSON.stringify(exercise)) {
        unchanged += 1;
        unchangedIds.push(exercise.id);
      } else {
        replacements += 1;
        replacedIds.push(exercise.id);
      }
      merged.set(exercise.id, exercise);
    });
    return { exercises: [...merged.values()], replacements, additions: addedIds.length, unchanged, addedIds, replacedIds, unchangedIds };
  }

  function secureIndex(length) {
    if (length <= 1) return 0;
    const maximum = Math.floor(0x100000000 / length) * length;
    const values = new Uint32Array(1);
    do { crypto.getRandomValues(values); } while (values[0] >= maximum);
    return values[0] % length;
  }

  function formatValue(value) {
    return typeof value === "number" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 8 }).format(value) : String(value);
  }

  function drawValues(variables) {
    const values = {};
    Object.entries(variables).forEach(([name, variable]) => {
      if (variable.type === "choice") values[name] = variable.values[secureIndex(variable.values.length)];
      else if (variable.type === "tuple") Object.assign(values, variable.values[secureIndex(variable.values.length)]);
      else {
        const count = Math.floor((variable.max - variable.min) / variable.step) + 1;
        const excluded = new Set(variable.exclude.map(String));
        const allowed = Array.from({ length: count }, (_, index) => Number((variable.min + index * variable.step).toFixed(10))).filter((value) => !excluded.has(String(value)));
        if (!allowed.length) invalid(`La variable « ${name} » ne possède aucune valeur utilisable.`);
        values[name] = allowed[secureIndex(allowed.length)];
      }
    });
    return values;
  }

  function replaceValues(template, values) {
    return String(template).replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, (_, name) => formatValue(values[name]));
  }

  function instantiate(exercise) {
    const values = drawValues(exercise.variables);
    const repeatedItems = exercise.repeat ? Array.from({ length: exercise.repeat.count }, () => {
      const itemValues = drawValues(exercise.repeat.variables);
      return { content: replaceValues(exercise.repeat.template, itemValues), generatedValues: itemValues };
    }) : [];
    const figures = (exercise.figures || []).map((figure) => ({ ...figure, elements: figure.elements.map((element) => ({ ...element, label: replaceValues(element.label, values) })) }));
    return { ...exercise, content: replaceValues(exercise.content, values), figures, repeatedItems, generatedValues: values };
  }

  window.AssessmentBank = { FORMAT, VERSION, COMPETENCIES, validate, read, hash, selectExercises, mergeExercises, instantiate };
})();
