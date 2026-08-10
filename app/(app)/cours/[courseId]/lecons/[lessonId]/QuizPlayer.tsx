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
    <form action={action} className="flex flex-col gap-4">
      {questions.map((q, i) => (
        <fieldset key={i} className="card">
          <legend className="px-1 font-medium text-gray-900">{q.question}</legend>
          {q.options.map((opt, j) => (
            <label key={j} className="block p-1 text-sm text-gray-700">
              <input type="radio" name={`answer-${i}`} value={j} required={j === 0} className="mr-2" />
              {opt}
            </label>
          ))}
        </fieldset>
      ))}
      <button type="submit" className="btn-primary self-start">
        Valider le quiz
      </button>
      {resultScore !== null && <p className="font-medium text-green-700">Score : {resultScore}%</p>}
    </form>
  );
}
