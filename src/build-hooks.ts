#!/usr/bin/env node
/**
 * Converts hooks YAML source files to JSON for platforms that require JSON configuration.
 *
 * For each plugin in plugins/, finds hooks/*.yaml files and writes corresponding hooks/*.json files.
 * Only YAML sources are committed to git; JSON files are generated and gitignored.
 *
 * Usage: pnpm run build:hooks
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLUGINS_DIR = path.join(ROOT, "plugins");

function buildHooksForPlugin(pluginDir: string, pluginName: string): number {
  const hooksDir = path.join(pluginDir, "hooks");
  if (!fs.existsSync(hooksDir)) return 0;

  const yamlFiles = fs
    .readdirSync(hooksDir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  let count = 0;
  for (const yamlFile of yamlFiles) {
    const yamlPath = path.join(hooksDir, yamlFile);
    const jsonFile = yamlFile.replace(/\.ya?ml$/, ".json");
    const jsonPath = path.join(hooksDir, jsonFile);

    const content = fs.readFileSync(yamlPath, "utf-8");
    const parsed: unknown = parseYaml(content);
    fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2) + "\n", "utf-8");

    console.log(`  ${pluginName}/hooks/${yamlFile} → ${jsonFile}`);
    count++;
  }

  return count;
}

function main(): void {
  if (!fs.existsSync(PLUGINS_DIR)) {
    console.error(`plugins/ directory not found at ${PLUGINS_DIR}`);
    process.exit(1);
  }

  const plugins = fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  if (plugins.length === 0) {
    console.log("No plugins found in plugins/");
    return;
  }

  console.log("Building hooks (YAML → JSON):\n");

  let totalCount = 0;
  for (const plugin of plugins) {
    const pluginDir = path.join(PLUGINS_DIR, plugin);
    totalCount += buildHooksForPlugin(pluginDir, plugin);
  }

  if (totalCount === 0) {
    console.log("  No YAML hook files found.");
  }

  console.log(`\nConverted ${totalCount} hook file(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
