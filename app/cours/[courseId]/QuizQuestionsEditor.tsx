"use client";

import { useState } from "react";

type Question = { question: string; options: string[]; correct: number };

const EMPTY_QUESTION: Question = { question: "", options: ["", "", "", ""], correct: 0 };

export default function QuizQuestionsEditor({
  initialQuestions,
}: {
  initialQuestions: Question[];
}) {
  const [questions, setQuestions] = useState<Question[]>(
    initialQuestions.length > 0 ? initialQuestions : [{ ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }],
  );

  function updateQuestion(index: number, patch: Partial<Question>) {
    setQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function updateOption(index: number, optionIndex: number, value: string) {
    const options = [...questions[index].options];
    options[optionIndex] = value;
    updateQuestion(index, { options });
  }

  function addQuestion() {
    setQuestions([...questions, { ...EMPTY_QUESTION, options: [...EMPTY_QUESTION.options] }]);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="quiz_questions" value={JSON.stringify(questions)} />
      {questions.map((q, i) => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-3">
          <input
            type="text"
            placeholder="Question"
            value={q.question}
            onChange={(e) => updateQuestion(i, { question: e.target.value })}
            className="input mb-2"
          />
          {q.options.map((opt, j) => (
            <div key={j} className="mb-1 flex items-center gap-2">
              <input
                type="radio"
                checked={q.correct === j}
                onChange={() => updateQuestion(i, { correct: j })}
              />
              <input
                type="text"
                placeholder={`Option ${j + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, j, e.target.value)}
                className="input flex-1"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => removeQuestion(i)}
            className="mt-1 text-sm font-medium text-red-600 hover:underline"
          >
            Supprimer la question
          </button>
        </div>
      ))}
      <button type="button" onClick={addQuestion} className="btn-secondary self-start">
        + Ajouter une question
      </button>
    </div>
  );
}
