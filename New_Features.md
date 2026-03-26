## Dynamic Workspace Scaffolding

### Problem:

Currently, eval workspaces are statically defined:

FILES (constant object) -> Written as-is to disk -> Agent runs

Limitations: No variation across runs Limited realism (small, trivial setups)
Poor coverage of real-world complexity Hard to scale scenarios systematically

I propose a config-driven workspace scaffolding system:

Input config / scenario -> Generator function (logic) -> FILES object (produced
dynamically) -> Written to disk (existing pipeline unchanged)

### Architecture:

The core design is a 3-layer architecture:

1. Core Scenario Layer (Task-Critical Code): Contains the actual problem the
   agent must solve & Includes: buggy logic, incomplete implementation or
   missing feature
2. Context Layer (Realistic Dependencies): Adds interconnected structure a.
   Includes: imports across modules, service layers, config files (package.json,
   tsconfig.json) b. Purpose: Forces multi-file reasoning, Mimics real-world
   codebases
3. Noise Layer (Controlled Irrelevance): Adds non-essential files a. Purpose:
   Tests agent’s ability to filter signal vs noise

The system will be for a Multi-step Evaluation Scenario where the agent must:
Locate relevant code Fix the bug Run tests Debug failing tests Iterate until
success

I implemented a prototype of the dynamic workspace scaffolder in my fork with
the following capabilities:

- Config-driven workspace generation
- Multi-file dependency chains
- Noise injection
- Test file generation
- Integration with existing evalTest pipeline

Running: npx vitest evals/scaffold-demo.test.ts, the output shows:

- Agent performs semantic search (grep_search)
- Identifies and fixes the bug via replace
- Executes npm test
- Detects test failures (missing imports)
- Fixes test file
- Re-runs tests and passes
