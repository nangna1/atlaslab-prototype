"use client";

type Question = { question: string; options: string[]; correct: number };

export default function QuizPlayer({
  questions,
  action,
  resultScore,
}: {
  questions: Question[];
  action: (formData: FormData) => void;
  resultScore: number | null;
}) {
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {questions.map((q, i) => (
        <fieldset key={i} style={{ border: "1px solid #eee", borderRadius: 6, padding: 12 }}>
          <legend>{q.question}</legend>
          {q.options.map((opt, j) => (
            <label key={j} style={{ display: "block", padding: 4 }}>
              <input type="radio" name={`answer-${i}`} value={j} required={j === 0} /> {opt}
            </label>
          ))}
        </fieldset>
      ))}
      <button type="submit" style={{ padding: 10 }}>
        Valider le quiz
      </button>
      {resultScore !== null && (
        <p style={{ color: "#080" }}>Score : {resultScore}%</p>
      )}
    </form>
  );
}
