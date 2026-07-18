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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="quiz_questions" value={JSON.stringify(questions)} />
      {questions.map((q, i) => (
        <div key={i} style={{ border: "1px solid #eee", borderRadius: 6, padding: 12 }}>
          <input
            type="text"
            placeholder="Question"
            value={q.question}
            onChange={(e) => updateQuestion(i, { question: e.target.value })}
            style={{ padding: 8, width: "100%", marginBottom: 8 }}
          />
          {q.options.map((opt, j) => (
            <div key={j} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
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
                style={{ padding: 8, flex: 1 }}
              />
            </div>
          ))}
          <button type="button" onClick={() => removeQuestion(i)} style={{ fontSize: 13, color: "#c00" }}>
            Supprimer la question
          </button>
        </div>
      ))}
      <button type="button" onClick={addQuestion} style={{ padding: 8, alignSelf: "flex-start" }}>
        + Ajouter une question
      </button>
    </div>
  );
}
