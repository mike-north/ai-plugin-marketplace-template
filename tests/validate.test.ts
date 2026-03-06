/**
 * Tests for src/validate.ts
 *
 * @see https://agentskills.io — SKILL.md frontmatter spec
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  normalizePathField,
  parseFrontmatterField,
  REQUIRED_FILES,
  resolveMarketplaceSource,
  validateAgentFrontmatter,
  validateClaudeHooks,
  validateManifestFileRefs,
  validateNameConsistency,
  validatePluginFiles,
  validatePowerMdFrontmatter,
  validateReadme,
  validateSkillFrontmatter,
  type ValidationResult,
} from "../src/validate.js";

function freshResult(): ValidationResult {
  return { passed: [], failed: [] };
}

let tmpDir: string | undefined;

function makeTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "validate-test-"));
  return tmpDir;
}

afterEach(() => {
  if (tmpDir !== undefined) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

/**
 * Write a file inside the given directory, creating intermediate dirs.
 */
function writeFile(dir: string, relPath: string, content: string): void {
  const fullPath = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf-8");
}

// ---------------------------------------------------------------------------
// parseFrontmatterField
// ---------------------------------------------------------------------------

describe("parseFrontmatterField", () => {
  it("extracts a field from valid frontmatter", () => {
    const content = "---\nname: my-skill\ndescription: A skill\n---\n# Body";
    expect(parseFrontmatterField(content, "name")).toBe("my-skill");
    expect(parseFrontmatterField(content, "description")).toBe("A skill");
  });

  it("returns undefined for a missing field", () => {
    const content = "---\nname: my-skill\n---\n# Body";
    expect(parseFrontmatterField(content, "description")).toBeUndefined();
  });

  it("returns undefined when no frontmatter is present", () => {
    const content = "# Just a heading\nSome text.";
    expect(parseFrontmatterField(content, "name")).toBeUndefined();
  });

  it("handles frontmatter with multiple fields", () => {
    const content = "---\nname: test\nversion: 1.0.0\nauthor: Alice\n---\n";
    expect(parseFrontmatterField(content, "version")).toBe("1.0.0");
    expect(parseFrontmatterField(content, "author")).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// normalizePathField
// ---------------------------------------------------------------------------

describe("normalizePathField", () => {
  it("returns empty array for undefined", () => {
    expect(normalizePathField(undefined)).toEqual([]);
  });

  it("wraps a string in an array", () => {
    expect(normalizePathField("./skills/foo")).toEqual(["./skills/foo"]);
  });

  it("filters non-string entries from arrays", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- testing runtime behavior with mixed types
    const mixed = ["./a.md", 42, "./b.md", null] as any;
    expect(normalizePathField(mixed)).toEqual(["./a.md", "./b.md"]);
  });

  it("returns empty array for objects", () => {
    expect(normalizePathField({ key: "value" })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// resolveMarketplaceSource
// ---------------------------------------------------------------------------

describe("resolveMarketplaceSource", () => {
  it("strips leading ./ from string sources", () => {
    expect(resolveMarketplaceSource("./plugins/foo")).toBe("plugins/foo");
  });

  it("returns string as-is when no ./ prefix", () => {
    expect(resolveMarketplaceSource("plugins/foo")).toBe("plugins/foo");
  });

  it("returns undefined for object sources", () => {
    expect(resolveMarketplaceSource({ github: "owner/repo" })).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(resolveMarketplaceSource(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validatePluginFiles
// ---------------------------------------------------------------------------

describe("validatePluginFiles", () => {
  it("passes when all required files and skills/ are present", () => {
    const dir = makeTmpDir();
    for (const f of REQUIRED_FILES) {
      writeFile(dir, f, "{}");
    }
    writeFile(dir, "skills/my-skill/SKILL.md", "---\nname: my-skill\n---\n");

    const results = freshResult();
    validatePluginFiles(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.length).toBeGreaterThan(0);
  });

  it("fails for each missing required file", () => {
    const dir = makeTmpDir();
    // Create skills/ with a SKILL.md but no required files
    writeFile(dir, "skills/my-skill/SKILL.md", "---\nname: my-skill\n---\n");

    const results = freshResult();
    validatePluginFiles(dir, "test-plugin", results);

    expect(results.failed.length).toBe(REQUIRED_FILES.length);
    for (const f of REQUIRED_FILES) {
      expect(results.failed.some((msg) => msg.includes(f))).toBe(true);
    }
  });

  it("fails when skills/ directory is missing", () => {
    const dir = makeTmpDir();
    for (const f of REQUIRED_FILES) {
      writeFile(dir, f, "{}");
    }

    const results = freshResult();
    validatePluginFiles(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("Missing skills/ directory"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateNameConsistency
// ---------------------------------------------------------------------------

describe("validateNameConsistency", () => {
  it("passes when all manifest names match directory name", () => {
    const dir = makeTmpDir();
    const name = "my-plugin";
    writeFile(dir, ".claude-plugin/plugin.json", JSON.stringify({ name }));
    writeFile(dir, ".cursor-plugin/plugin.json", JSON.stringify({ name }));
    writeFile(dir, "gemini-extension.json", JSON.stringify({ name }));
    writeFile(dir, "POWER.md", `---\nname: ${name}\n---\n`);

    const results = freshResult();
    validateNameConsistency(dir, name, results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("consistent"))).toBe(true);
  });

  it("fails when a manifest name mismatches", () => {
    const dir = makeTmpDir();
    writeFile(dir, ".claude-plugin/plugin.json", JSON.stringify({ name: "my-plugin" }));
    writeFile(dir, "gemini-extension.json", JSON.stringify({ name: "wrong-name" }));

    const results = freshResult();
    validateNameConsistency(dir, "my-plugin", results);

    expect(results.failed.some((msg) => msg.includes("Name mismatch"))).toBe(true);
  });

  it("fails when a manifest is missing the name field", () => {
    const dir = makeTmpDir();
    writeFile(dir, ".claude-plugin/plugin.json", JSON.stringify({ version: "1.0" }));

    const results = freshResult();
    validateNameConsistency(dir, "my-plugin", results);

    expect(results.failed.some((msg) => msg.includes("Missing 'name'"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateSkillFrontmatter
// ---------------------------------------------------------------------------

describe("validateSkillFrontmatter", () => {
  it("passes for valid agentskills.io frontmatter", () => {
    const dir = makeTmpDir();
    writeFile(
      dir,
      "skills/my-skill/SKILL.md",
      "---\nname: my-skill\ndescription: A valid skill description\n---\n# Skill\nBody content here.",
    );

    const results = freshResult();
    validateSkillFrontmatter(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("name") && msg.includes("valid"))).toBe(true);
    expect(results.passed.some((msg) => msg.includes("description"))).toBe(true);
  });

  it("fails for name exceeding 64 characters", () => {
    const dir = makeTmpDir();
    const longName = "a".repeat(65);
    writeFile(dir, `skills/${longName}/SKILL.md`, `---\nname: ${longName}\ndescription: Test\n---\n`);

    const results = freshResult();
    validateSkillFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("exceeds 64 characters"))).toBe(true);
  });

  it("fails for name with uppercase characters", () => {
    const dir = makeTmpDir();
    writeFile(dir, "skills/MySkill/SKILL.md", "---\nname: MySkill\ndescription: Test\n---\n");

    const results = freshResult();
    validateSkillFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("lowercase"))).toBe(true);
  });

  it("fails for name not matching parent directory", () => {
    const dir = makeTmpDir();
    writeFile(dir, "skills/actual-dir/SKILL.md", "---\nname: different-name\ndescription: Test\n---\n");

    const results = freshResult();
    validateSkillFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("does not match parent directory"))).toBe(true);
  });

  it("fails for missing description", () => {
    const dir = makeTmpDir();
    writeFile(dir, "skills/my-skill/SKILL.md", "---\nname: my-skill\n---\n");

    const results = freshResult();
    validateSkillFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("missing required 'description'"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateClaudeHooks
// ---------------------------------------------------------------------------

describe("validateClaudeHooks", () => {
  it("passes for valid hooks object with known event types", () => {
    const dir = makeTmpDir();
    writeFile(
      dir,
      "hooks/claude.json",
      JSON.stringify({ hooks: { PostToolUse: [], PreToolUse: [] } }),
    );

    const results = freshResult();
    validateClaudeHooks(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("valid hooks object"))).toBe(true);
  });

  it("fails for unknown event types", () => {
    const dir = makeTmpDir();
    writeFile(
      dir,
      "hooks/claude.json",
      JSON.stringify({ hooks: { PostToolUse: [], InvalidEvent: [] } }),
    );

    const results = freshResult();
    validateClaudeHooks(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("unknown event types") && msg.includes("InvalidEvent"))).toBe(
      true,
    );
  });

  it("fails for hooks as array instead of object", () => {
    const dir = makeTmpDir();
    writeFile(dir, "hooks/claude.json", JSON.stringify({ hooks: [{ event: "PostToolUse" }] }));

    const results = freshResult();
    validateClaudeHooks(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("must be an object"))).toBe(true);
  });

  it("fails for invalid JSON", () => {
    const dir = makeTmpDir();
    writeFile(dir, "hooks/claude.json", "{ not valid json");

    const results = freshResult();
    validateClaudeHooks(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("not valid JSON"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAgentFrontmatter
// ---------------------------------------------------------------------------

describe("validateAgentFrontmatter", () => {
  it("passes when name and description are present", () => {
    const dir = makeTmpDir();
    writeFile(dir, "agents/my-agent.md", "---\nname: my-agent\ndescription: Does things\n---\n# Agent");

    const results = freshResult();
    validateAgentFrontmatter(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("frontmatter valid"))).toBe(true);
  });

  it("fails when name is missing", () => {
    const dir = makeTmpDir();
    writeFile(dir, "agents/my-agent.md", "---\ndescription: Does things\n---\n");

    const results = freshResult();
    validateAgentFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("missing 'name'"))).toBe(true);
  });

  it("fails when description is missing", () => {
    const dir = makeTmpDir();
    writeFile(dir, "agents/my-agent.md", "---\nname: my-agent\n---\n");

    const results = freshResult();
    validateAgentFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("missing 'description'"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateManifestFileRefs
// ---------------------------------------------------------------------------

describe("validateManifestFileRefs", () => {
  it("passes when all referenced paths exist", () => {
    const dir = makeTmpDir();
    writeFile(dir, "skills/evaluate-skill/SKILL.md", "---\nname: evaluate-skill\n---\n");
    writeFile(dir, "agents/experimenter.md", "---\nname: experimenter\n---\n");
    writeFile(dir, "commands/evaluate.md", "# Command");
    writeFile(dir, "hooks/claude.json", "{}");
    writeFile(
      dir,
      ".claude-plugin/plugin.json",
      JSON.stringify({
        name: "test",
        skills: ["./skills/evaluate-skill"],
        agents: ["./agents/experimenter.md"],
        commands: ["./commands/evaluate.md"],
        hooks: "./hooks/claude.json",
      }),
    );

    const results = freshResult();
    validateManifestFileRefs(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("references are all valid"))).toBe(true);
  });

  it("fails when a referenced skill directory is missing", () => {
    const dir = makeTmpDir();
    writeFile(
      dir,
      ".claude-plugin/plugin.json",
      JSON.stringify({
        name: "test",
        skills: ["./skills/nonexistent"],
      }),
    );

    const results = freshResult();
    validateManifestFileRefs(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("non-existent path") && msg.includes("skills/nonexistent"))).toBe(
      true,
    );
  });

  it("fails when a referenced agent file is missing", () => {
    const dir = makeTmpDir();
    writeFile(
      dir,
      ".claude-plugin/plugin.json",
      JSON.stringify({
        name: "test",
        agents: ["./agents/missing.md"],
      }),
    );

    const results = freshResult();
    validateManifestFileRefs(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("non-existent path") && msg.includes("agents/missing.md"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// validatePowerMdFrontmatter
// ---------------------------------------------------------------------------

describe("validatePowerMdFrontmatter", () => {
  it("passes when all fields are present", () => {
    const dir = makeTmpDir();
    writeFile(dir, "POWER.md", "---\nname: my-plugin\ndescription: A plugin\nversion: 1.0.0\n---\n");

    const results = freshResult();
    validatePowerMdFrontmatter(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("POWER.md frontmatter valid"))).toBe(true);
  });

  it("fails when fields are missing", () => {
    const dir = makeTmpDir();
    writeFile(dir, "POWER.md", "---\nname: my-plugin\n---\n");

    const results = freshResult();
    validatePowerMdFrontmatter(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("description") && msg.includes("version"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateReadme
// ---------------------------------------------------------------------------

describe("validateReadme", () => {
  it("passes when README.md is present", () => {
    const dir = makeTmpDir();
    writeFile(dir, "README.md", "# Plugin");

    const results = freshResult();
    validateReadme(dir, "test-plugin", results);

    expect(results.failed).toEqual([]);
    expect(results.passed.some((msg) => msg.includes("README.md present"))).toBe(true);
  });

  it("fails when README.md is missing", () => {
    const dir = makeTmpDir();

    const results = freshResult();
    validateReadme(dir, "test-plugin", results);

    expect(results.failed.some((msg) => msg.includes("Missing README.md"))).toBe(true);
  });
});
