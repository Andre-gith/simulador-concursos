export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { assertProductionConfig } = await import("./lib/production-config");
    assertProductionConfig();
  }
}
