const fs = require("node:fs");
const yaml = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020");

async function main() {
  const response = await fetch("https://render.com/schema/render.yaml.json");
  if (!response.ok) throw new Error(`Schema HTTP ${response.status}`);
  const schema = await response.json();
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
  });
  const files = process.argv.slice(2);
  for (const file of files.length ? files : ["render.yaml", "render.demo.yaml"]) {
    const blueprint = yaml.load(fs.readFileSync(file, "utf8"));
    const valid = ajv.validate(schema, blueprint);
    if (!valid) {
      console.error(`${file}: ${JSON.stringify(ajv.errors, null, 2)}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`${file}: YAML e schema oficial válidos`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
