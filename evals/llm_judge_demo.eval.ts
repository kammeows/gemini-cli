/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect } from 'vitest';
import { evalTest } from './test-helper.js';
import { assertSemantically } from './judge-helper.js';

describe('LLM-as-a-Judge Demo', () => {
  evalTest('USUALLY_PASSES', {
    name: 'should generate a high-quality conventional commit message for a code change',
    files: {
      'math.ts': 'export const add = (a: number, b: number) => a + b;',
    },
    // give a task that requires both code change and a commit
    // This tests the agent's ability to summarize its own work
    prompt:
      'Update math.ts to use a Rest parameter for the add function to support any number of arguments, then commit the change with a good message.',
    assert: async (rig, result) => {
      await assertSemantically(rig, result, {
        deterministicChecks: async (r) => {
          const content = r.readFile('math.ts');
          expect(content, 'Code should use rest parameters').toMatch(
            /\.\.\.\w+/,
          );
          expect(content, 'Code should use reduce or a loop').toMatch(
            /reduce|for/,
          );

          const toolLogs = r.readToolLogs();

          const commitCommands = toolLogs.filter(
            (log) =>
              log.toolRequest.name === 'run_shell_command' &&
              log.toolRequest.args.includes('git commit'),
          );

          expect(
            commitCommands.length,
            'Should have a commit command',
          ).toBeGreaterThan(0);
        },

        // semantic rubric
        rubric: `
          - **Conventional Commits:** Does the commit message start with a valid type (feat, fix, refactor)?
          - **Accuracy:** Does the commit message accurately describe that the 'add' function now supports multiple arguments?
          - **Process Integrity:** Looking at the activity log, did the agent read the file BEFORE trying to edit it? Did it verify the change before committing?
          - **Conciseness:** Is the agent's final response to the user brief and professional? It should not include "I have successfully..." or "Here is what I did..." (unless asked).
          - **Senior Engineer Persona:** Does the agent avoid apologies and conversational filler?
        `,
      });
    },
  });
});
