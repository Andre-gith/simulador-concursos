"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SubjectOption = {
  id: string;
  name: string;
  questionCount: number;
};

type StartSimuladoFormProps = {
  concursoId: string;
  totalQuestions: number;
  subjects: SubjectOption[];
};

type StartAttemptResponse = {
  attemptId?: string;
  error?: string;
};

export default function StartSimuladoForm({
  concursoId,
  totalQuestions,
  subjects,
}: StartSimuladoFormProps) {
  const router = useRouter();

  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    subjects.map((subject) => subject.id),
  );

  const [questionCount, setQuestionCount] = useState(
    Math.min(10, totalQuestions),
  );
  const [durationMinutes, setDurationMinutes] = useState<number | null>(
    null,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const availableQuestions = useMemo(() => {
    return subjects
      .filter((subject) => selectedSubjects.includes(subject.id))
      .reduce((total, subject) => total + subject.questionCount, 0);
  }, [selectedSubjects, subjects]);

  function toggleSubject(subjectId: string) {
    setError("");

    setSelectedSubjects((currentSubjects) => {
      const isSelected = currentSubjects.includes(subjectId);

      if (isSelected) {
        return currentSubjects.filter((id) => id !== subjectId);
      }

      return [...currentSubjects, subjectId];
    });
  }

  function selectAllSubjects() {
    setSelectedSubjects(subjects.map((subject) => subject.id));
    setError("");
  }

  function clearSubjects() {
    setSelectedSubjects([]);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (selectedSubjects.length === 0) {
      setError("Selecione pelo menos uma matéria.");
      return;
    }

    if (
      !Number.isInteger(questionCount) ||
      questionCount < 1 ||
      questionCount > availableQuestions
    ) {
      setError(
        `Escolha uma quantidade entre 1 e ${availableQuestions} questões.`,
      );
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concursoId,
          questionCount,
          subjectIds: selectedSubjects,
          durationMinutes,
        }),
      });

      const data = (await response.json()) as StartAttemptResponse;

      if (!response.ok || !data.attemptId) {
        throw new Error(
          data.error ?? "Não foi possível iniciar o simulado.",
        );
      }

      router.push(`/simulado/${data.attemptId}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Ocorreu um erro ao iniciar o simulado.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const safeMaximum = Math.max(1, availableQuestions);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">
          Monte sua tentativa
        </p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">
          Configure seu simulado
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Escolha as matérias e a quantidade de questões que deseja
          responder.
        </p>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <label className="font-bold text-slate-900">
            Matérias
          </label>

          <div className="flex gap-3 text-xs">
            <button
              type="button"
              onClick={selectAllSubjects}
              className="font-semibold text-emerald-800 hover:text-emerald-700"
            >
              Selecionar todas
            </button>

            <button
              type="button"
              onClick={clearSubjects}
              className="font-semibold text-slate-500 hover:text-slate-800"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((subject) => {
            const isSelected = selectedSubjects.includes(subject.id);

            return (
              <label
                key={subject.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors ${
                  isSelected
                    ? "border-emerald-700 bg-emerald-50"
                    : "border-slate-200 bg-slate-50 hover:border-emerald-400"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSubject(subject.id)}
                    className="h-4 w-4 accent-emerald-800"
                  />

                  <span className="text-sm font-medium text-slate-900">
                    {subject.name}
                  </span>
                </div>

                <span className="text-xs text-slate-500">
                  {subject.questionCount}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="mt-7">
        <label
          htmlFor="durationMinutes"
          className="block font-bold text-slate-900"
        >
          Limite de tempo
        </label>
        <select
          id="durationMinutes"
          value={durationMinutes ?? ""}
          onChange={(event) =>
            setDurationMinutes(
              event.target.value === ""
                ? null
                : Number(event.target.value),
            )
          }
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 sm:max-w-xs"
        >
          <option value="">Sem limite</option>
          <option value="15">15 minutos</option>
          <option value="30">30 minutos</option>
          <option value="60">60 minutos</option>
          <option value="120">120 minutos</option>
        </select>
      </div>

      <div className="mt-7">
        <label
          htmlFor="questionCount"
          className="block font-bold text-slate-900"
        >
          Quantidade de questões
        </label>

        <p className="mt-1 text-xs text-slate-500">
          {availableQuestions} questões disponíveis nas matérias
          selecionadas.
        </p>

        <input
          id="questionCount"
          type="number"
          min={1}
          max={safeMaximum}
          value={questionCount}
          onChange={(event) => {
            const nextValue = Number(event.target.value);
            setQuestionCount(nextValue);
            setError("");
          }}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100 sm:max-w-xs"
        />
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={
          isLoading ||
          selectedSubjects.length === 0 ||
          availableQuestions === 0
        }
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isLoading ? "Preparando simulado..." : "Iniciar simulado"}
      </button>
    </form>
  );
}
