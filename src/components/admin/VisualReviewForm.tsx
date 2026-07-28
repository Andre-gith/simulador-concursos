"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  approveVisualQuestions,
  type VisualReviewActionState,
} from "@/app/admin/actions";

const initialState: VisualReviewActionState = {
  status: "idle",
  message: "",
  results: [],
};
const confirmation =
  "Confirmo que o recurso visual corresponde ao documento oficial e está legível.";

export function VisualReviewForm({
  questionIds,
  children,
}: {
  questionIds: string[];
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(
    approveVisualQuestions,
    initialState,
  );
  const [selectAll, setSelectAll] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current
      ?.querySelectorAll<HTMLInputElement>('input[data-visual-question="true"]')
      .forEach((input) => {
        input.checked = selectAll;
      });
  }, [selectAll]);
  return (
    <form ref={formRef} action={action}>
      <label className="mb-4 flex items-center gap-2 font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={selectAll}
          onChange={(event) => setSelectAll(event.target.checked)}
        />
        Selecionar todas as questões visuais exibidas
      </label>
      {children}
      <label className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-slate-800">
        <input
          type="checkbox"
          name="confirmation"
          value={confirmation}
          required
        />
        {confirmation}
      </label>
      <button
        disabled={pending}
        className="mt-4 rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50"
      >
        {pending
          ? "Validando..."
          : "Aprovar visuais selecionados e publicar questões prontas"}
      </button>
      {state.message && (
        <div
          className={`mt-4 rounded-xl p-4 ${
            state.status === "error"
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-800"
          }`}
        >
          <p className="font-bold">{state.message}</p>
          {state.results.map((item) => (
            <p key={item.questionId} className="mt-1 text-sm">
              Questão {item.number ?? "sem número"}: {item.result}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}
