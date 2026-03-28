# Semantic Assertions (LLM-as-a-judge)

## Problem

Right now, evals and integration tests rely entirely on programmatic assertions
using Vitest (expect). These include: checking tool calls (e.g. was replace
called?) verifying file contents on disk matching model output using Regex (via
helpers like checkModelOutputContent)

But programmatic assertions have 2 limitations: Too brittle Regex-based checks
fail on minor phrasing differences Slight variation in output and it will be a
false negative Too shallow A test may pass because a tool was called But the
actual output quality may still be poor

Tests involving refactoring, summarization, or commit message generation cannot
be evaluated with Regex.

## Solution

So the proposed solution is: LLM-as-a-judge where we evaluate if the agent
produced a high quality result instead of just how it behaved.

So the core idea is to pass the agent’s output to a judge model along with a
rubric.

However, this feature also comes with significant challenges:

1. Judge flakiness: This can be overcome by chain of thought (CoT) grading. The
   judge prompts will force the model to explain its reasoning before outputting
   the final Pass/Fail boolean.
2. Latency and cost: The solution is model tiering. The semantic judge will
   default to gemini-1.5-flash (or whatever the fastest/cheapest current model
   is), while the agent being tested might be running a heavier Pro model.
3. False positives in refactoring: The judge model might look at a block of
   generated code, say "Yes, this looks semantically correct," but the code
   actually contains a syntax error. Approach: Combine deterministic testing
   with semantic testing. The eval should first run a deterministic tsc
   (TypeScript compiler) or linter check on the generated file. Only if it
   compiles does it go to the LLM judge to check if the behavior is correct.

We can still keep the programmatic tests as they are fast, deterministic and
cheap so they are best for “Always Passes” tests. LLM as a judge test are better
for “Usually Passes” tests.

One major concern with this is developer experience. OSS contributors hate it
when they clone a repo, run npm test, and get 50 errors related to quota
exhaustion or API key configuration problems. So to make the lives of OSS
contributors easier, we enable graceful degradation of the tests:

- Graceful Degradation: If the GEMINI_API_KEY is missing, or the API returns a
  429 Too Many Requests, the assertSemantically function should catch the error
  and automatically fall back to a basic Regex/AST check (if provided in the
  test params), or mark the test as skipped rather than failed.
- The --offline Flag: Another solution is to add a Vitest environment variable
  or CLI flag (e.g., TEST_ENV=offline npm run test:evals) that intentionally
  bypasses all LLM-as-a-judge assertions so contributors can run the
  deterministic parts of the test suite locally without burning quota.

## LLM Judge Prompt Creator Sub-Agent

To make this scalable, I propose a small sub-agent that generates judge prompts
automatically.

1. Single Output Mode (CI use): Generates strict rubric, Returns structured
   Pass/Fail, Used in evals and CI pipelines
2. Pairwise Mode (Local only): Used for prompt engineering: gemini
   /compare-prompts promptA.txt promptB.txt, The judge compares which prompt
   produced better behavior and explains why, Not used in CI (too slow +
   expensive)

## Implementation overview:

Implementing an LLM-as-a-judge layer would allow the Gemini CLI team to
transition from testing "Did the model use the right tool?" to "Did the model
provide a high-quality solution?" which is the ultimate measure of the agent's
value.
