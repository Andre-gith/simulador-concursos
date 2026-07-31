import { UnrecoverableError } from "bullmq";
const PERMANENT = /SSRF|MIME|assinatura|path|fora do diretório|inválid|protegido|conflito editorial|não permitido/i;
export function isPermanentJobError(error: unknown) {
  return error instanceof UnrecoverableError || (error instanceof Error && PERMANENT.test(error.message));
}
