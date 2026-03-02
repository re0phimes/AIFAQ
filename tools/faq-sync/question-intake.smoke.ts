import { normalizeQuestions } from "./question-intake";

const questions = normalizeQuestions(["  什么是Transformer  ", "", "什么是Transformer"]);
if (questions.length !== 1) {
  throw new Error("normalizeQuestions should dedupe and drop empties");
}
