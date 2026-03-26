# Tool Selection Boundary Evals

## Problem

When tools have semantic overlap (like "searching for information" vs. "fetching
a specific document"), LLMs often default to the most frequent pattern (usually
search) even when a more specific tool is available.

For example, the CLI gives the agent access to tools that have overlapping
purposes, like google_web_search (for open-ended queries) and web_fetch (for
reading a specific provided URL).

## Solution Example

The file, evals/tool_boundary_selection.eval.ts, utilizes the existing TestRig
and evalTest framework to verify the agent's decision-making process across
three scenarios:

1.  Scenario A (General Knowledge): Verifies that the agent correctly selects
    google_web_search for queries about current events (e.g., "latest React
    version") where it lacks local data.
2.  Scenario B (Direct URL): Asserts that the agent uses web_fetch when provided
    with a specific URL.
3.  Scenario C (Local Context): Confirms the agent's "local-first" priority. It
    asserts that when asked about a file in the current directory (like
    README.md), the agent uses read_file and avoids hitting external web APIs
    entirely.
