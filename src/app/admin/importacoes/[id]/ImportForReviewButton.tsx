"use client";

import { useState } from "react";
import { importForReviewAction } from "../actions";

export function ImportForReviewButton({ jobId, enabled }: { jobId: string; enabled: boolean }) {
  const [confirmed, setConfirmed] = useState(false);
  return <form action={importForReviewAction} className="mt-4">
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="confirmation" value={confirmed ? "IMPORT_FOR_REVIEW" : ""} />
    <label className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
      <span>Esta operação criará ou associará um concurso e importará as questões como <b>IN_REVIEW</b>. Nenhuma questão será publicada.</span>
    </label>
    <button disabled={!enabled || !confirmed} className="mt-3 rounded-xl bg-emerald-900 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Importar para revisão</button>
  </form>;
}
