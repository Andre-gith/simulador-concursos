"use client";

import { useState } from "react";

import { bulkReviewQuestions } from "@/app/admin/actions";

export function BulkReviewForm({
  children,
}: {
  children: React.ReactNode;
}) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [validationMessage, setValidationMessage] = useState("");

  return (
    <form
      action={bulkReviewQuestions}
      onChange={(event) => {
        const form = event.currentTarget;
        const nextSelectedCount = form.querySelectorAll<HTMLInputElement>(
          'input[name="questionIds"]:checked',
        ).length;
        setSelectedCount(nextSelectedCount);
        if (nextSelectedCount > 0) setValidationMessage("");
      }}
      onSubmit={(event) => {
        if (selectedCount === 0) {
          event.preventDefault();
          setValidationMessage(
            "Selecione pelo menos uma questão antes de aplicar a ação em lote.",
          );
          return;
        }
        setValidationMessage("");
        if (
          !window.confirm(
            `Confirmar a ação em lote para ${selectedCount} questão(ões)? A operação será validada e executada em uma única transação.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <select name="operation" required className="input max-w-sm">
          <option value="">Escolha uma ação em lote</option>
          <option value="TEXT_REVIEWED">Marcar texto como conferido</option>
          <option value="ALTERNATIVES_REVIEWED">
            Marcar alternativas como conferidas
          </option>
          <option value="ANSWER_KEY_REVIEWED">
            Marcar gabarito como confirmado
          </option>
          <option value="NOT_ANNULLED">Confirmar como não anulada</option>
          <option value="PUBLISH_READY">Publicar questões prontas</option>
        </select>
        <input type="hidden" name="confirmation" value="CONFIRM" />
        <button
          type="submit"
          className="rounded-xl bg-amber-400 px-4 py-3 font-bold text-slate-950 hover:bg-amber-300"
        >
          Aplicar a {selectedCount} selecionada(s)
        </button>
        {validationMessage && (
          <p role="alert" className="w-full text-sm font-semibold text-red-700">
            {validationMessage}
          </p>
        )}
      </div>
      {children}
    </form>
  );
}
