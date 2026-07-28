"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type SimuladoAlternative = {
  id: string;
  letter: string;
  text: string;
};

export type SimuladoQuestion = {
  id: string;
  order: number;
  type: "CE" | "MC";
  statement: string;
  subject: string;
  topic: string | null;
  visualAssets: Array<{ id: string; sourcePage: number }>;
  alternatives: SimuladoAlternative[];
};

type SimuladoClientProps = {
  attemptId: string;
  title: string;
  questions: SimuladoQuestion[];
  serverNow: string;
  expiresAt: string | null;
};

type FinishAttemptResponse = {
  attemptId?: string;
  totalScore?: number;
  error?: string;
};

export default function SimuladoClient({
  attemptId,
  title,
  questions,
  serverNow,
  expiresAt,
}: SimuladoClientProps) {
  const router = useRouter();

  const [currentIndex, setCurrentIndex] = useState(0);

  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    return Object.fromEntries(
      questions.map((question) => [question.id, ""]),
    );
  });

  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(
    expiresAt
      ? Math.max(
          0,
          Math.ceil(
            (new Date(expiresAt).getTime() -
              new Date(serverNow).getTime()) /
              1000,
          ),
        )
      : null,
  );
  const finishingRef = useRef(false);

  const currentQuestion = questions[currentIndex];

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(
      (answer) => answer !== "",
    ).length;
  }, [answers]);

  const blankCount = questions.length - answeredCount;

  function selectAnswer(questionId: string, answer: string) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: answer,
    }));

    setError("");
  }

  function goToQuestion(index: number) {
    if (index < 0 || index >= questions.length) {
      return;
    }

    setCurrentIndex(index);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function finishAttempt(automatic = false) {
    if (finishingRef.current) return;
    const confirmationMessage =
      blankCount > 0
        ? `${blankCount} questão(ões) ficarão em branco. Deseja finalizar o simulado?`
        : "Deseja finalizar o simulado e calcular sua nota?";

    if (!automatic && !window.confirm(confirmationMessage)) {
      return;
    }

    try {
      finishingRef.current = true;
      setIsFinishing(true);
      setError("");

      const response = await fetch(
        `/api/attempts/${attemptId}/finish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            answers: questions.map((question) => ({
              questionId: question.id,
              userAnswer: answers[question.id] ?? "",
            })),
          }),
        },
      );

      const data = (await response.json()) as FinishAttemptResponse;

      if (!response.ok) {
        throw new Error(
          data.error ?? "Não foi possível finalizar o simulado.",
        );
      }

      router.push(`/resultado/${attemptId}`);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Ocorreu um erro ao finalizar o simulado.",
      );
    } finally {
      setIsFinishing(false);
      finishingRef.current = false;
    }
  }

  useEffect(() => {
    if (!expiresAt) return;

    const serverOffset =
      new Date(serverNow).getTime() - Date.now();
    const expiresAtMilliseconds = new Date(expiresAt).getTime();
    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (expiresAtMilliseconds - (Date.now() + serverOffset)) / 1000,
        ),
      );
      setRemainingSeconds(remaining);
      if (remaining === 0) void finishAttempt(true);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, serverNow, answers]);

  if (!currentQuestion) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          Este simulado não possui questões.
        </div>
      </main>
    );
  }

  const selectedAnswer = answers[currentQuestion.id] ?? "";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Simulado em andamento
            </p>

            <h1 className="mt-1 text-xl font-black text-slate-950">
              {title}
            </h1>
          </div>
          {remainingSeconds !== null && (
            <div
              className={
                remainingSeconds <= 300
                  ? "rounded-full bg-red-50 px-3 py-2 font-bold text-red-700"
                  : "rounded-full bg-emerald-50 px-3 py-2 font-semibold text-emerald-800"
              }
            >
              Tempo restante:{" "}
              {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
              {String(remainingSeconds % 60).padStart(2, "0")}
              {remainingSeconds <= 300 && remainingSeconds > 0
                ? " — tempo quase esgotado"
                : ""}
            </div>
          )}

          <div className="text-sm text-slate-600">
            <strong className="text-slate-950">
              {answeredCount}
            </strong>{" "}
            respondidas ·{" "}
            <strong className="text-slate-950">{blankCount}</strong>{" "}
            em branco
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-800 transition-all"
            style={{
              width: `${
                ((currentIndex + 1) / questions.length) * 100
              }%`,
            }}
          />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-bold text-emerald-800">
              Questão {currentIndex + 1} de {questions.length}
            </span>

            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              {currentQuestion.subject}
              {currentQuestion.topic
                ? ` · ${currentQuestion.topic}`
                : ""}
            </span>
          </div>

          <p className="mt-7 whitespace-pre-line text-base leading-8 text-slate-800">
            {currentQuestion.statement}
          </p>
          {currentQuestion.visualAssets.length > 0 && (
            <div className="mt-6 grid gap-4">
              {currentQuestion.visualAssets.map((asset) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={asset.id}
                  src={`/api/visual-assets/${asset.id}`}
                  alt={`Recurso visual da questão, página ${asset.sourcePage}`}
                  className="h-auto max-h-[900px] w-full rounded-xl border border-slate-200 object-contain"
                />
              ))}
            </div>
          )}

          <div className="mt-8 space-y-3">
            {currentQuestion.type === "CE" ? (
              <>
                <AnswerButton
                  label="Certo"
                  value="C"
                  selected={selectedAnswer === "C"}
                  onClick={() =>
                    selectAnswer(currentQuestion.id, "C")
                  }
                />

                <AnswerButton
                  label="Errado"
                  value="E"
                  selected={selectedAnswer === "E"}
                  onClick={() =>
                    selectAnswer(currentQuestion.id, "E")
                  }
                />
              </>
            ) : (
              currentQuestion.alternatives.map((alternative) => (
                <AnswerButton
                  key={alternative.id}
                  label={alternative.text}
                  value={alternative.letter}
                  selected={
                    selectedAnswer === alternative.letter
                  }
                  onClick={() =>
                    selectAnswer(
                      currentQuestion.id,
                      alternative.letter,
                    )
                  }
                />
              ))
            )}

            <button
              type="button"
              onClick={() =>
                selectAnswer(currentQuestion.id, "")
              }
              className={`w-full rounded-xl border px-4 py-4 text-left transition-colors ${
                selectedAnswer === ""
                  ? "border-amber-400 bg-amber-50 text-slate-900"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-400"
              }`}
            >
              <span className="mr-3 inline-flex min-w-8 justify-center rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold">
                —
              </span>
              Deixar em branco
            </button>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => goToQuestion(currentIndex - 1)}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Questão anterior
            </button>

            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex + 1)}
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300"
              >
                Próxima questão
              </button>
            ) : (
              <button
                type="button"
                disabled={isFinishing}
                onClick={() => void finishAttempt()}
                className="rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFinishing
                  ? "Calculando resultado..."
                  : "Finalizar simulado"}
              </button>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
          <h2 className="text-sm font-bold text-slate-950">
            Navegação
          </h2>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((question, index) => {
              const isCurrent = index === currentIndex;
              const isAnswered = answers[question.id] !== "";

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => goToQuestion(index)}
                  className={`aspect-square rounded-lg text-xs font-semibold transition-colors ${
                    isCurrent
                      ? "bg-amber-400 text-slate-950"
                      : isAnswered
                        ? "bg-emerald-800 text-white hover:bg-emerald-700"
                        : "border border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-500"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={isFinishing}
            onClick={() => void finishAttempt()}
            className="mt-6 w-full rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finalizar agora
          </button>
        </aside>
      </div>
    </main>
  );
}

type AnswerButtonProps = {
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
};

function AnswerButton({
  label,
  value,
  selected,
  onClick,
}: AnswerButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-start rounded-xl border px-4 py-4 text-left transition-colors ${
        selected
          ? "border-emerald-700 bg-emerald-50 text-slate-950"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-400"
      }`}
    >
      <span
        className={`mr-3 inline-flex min-w-8 justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
          selected
            ? "border-emerald-700 bg-emerald-800 text-white"
            : "border-slate-300 text-slate-600"
        }`}
      >
        {value}
      </span>

      <span className="leading-6">{label}</span>
    </button>
  );
}
