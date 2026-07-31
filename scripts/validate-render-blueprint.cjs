const fs = require("node:fs");
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");

async function main() {
  const blueprint = yaml.load(fs.readFileSync("render.yaml", "utf8"));
  const response = await fetch("https://render.com/schema/render.yaml.json");
  if (!response.ok) throw new Error(`Schema HTTP ${response.status}`);
  const schema = await response.json();
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  const valid = ajv.validate(schema, blueprint);
  if (!valid) {
    console.error(JSON.stringify(ajv.errors, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log("render.yaml: YAML e schema oficial válidos");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
