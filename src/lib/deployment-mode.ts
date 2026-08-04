export const DEMO_AUTOMATION_MESSAGE = "Automação indisponível neste ambiente de demonstração.";
export const LITE_AUTOMATION_MESSAGE = "Automações em segundo plano estão desabilitadas no modo Lite.";

export type DeploymentMode = "full" | "demo" | "lite";

export function deploymentMode(environment: NodeJS.ProcessEnv = process.env): DeploymentMode {
  const value = environment.DEPLOYMENT_MODE;
  if (value === "full" || value === "demo" || value === "lite") return value;
  if (environment.NODE_ENV === "production") {
    throw new Error("DEPLOYMENT_MODE deve ser explicitamente definido como full, demo ou lite.");
  }
  return "full";
}

export function isDemoDeployment(environment: NodeJS.ProcessEnv = process.env) {
  return deploymentMode(environment) === "demo";
}

export function isLiteDeployment(environment: NodeJS.ProcessEnv = process.env) {
  return deploymentMode(environment) === "lite";
}

export function assertAutomationAvailable(environment: NodeJS.ProcessEnv = process.env) {
  if (isDemoDeployment(environment)) throw new Error(DEMO_AUTOMATION_MESSAGE);
}

export function demoUnavailableResponse() {
  return Response.json({ error: DEMO_AUTOMATION_MESSAGE }, {
    status: 503,
    headers: { "cache-control": "no-store" },
  });
}

export function liteUnavailableResponse() {
  return Response.json({ error: LITE_AUTOMATION_MESSAGE }, {
    status: 503,
    headers: { "cache-control": "no-store" },
  });
}
