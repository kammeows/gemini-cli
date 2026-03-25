/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect } from 'vitest';
import { evalTest } from './test-helper.js';
import { EDIT_TOOL_NAMES } from '@google/gemini-cli-core';
import { generateWorkspace } from './workspace-scaffolder.js';

describe('Dynamic workspace eval', () => {
  evalTest('USUALLY_PASSES', {
    name: 'agent should fix bug in dynamically generated workspace',
    prompt: 'Fix the bug in compute function so it correctly adds numbers',
    files: generateWorkspace({
      core: {
        files: 2,
        crossLinked: true,
        hasBug: true,
      },
      noise: {
        files: 0,
        irrelevant: true,
      },
      signals: {
        hasTests: true,
        hasComments: true,
      },
    }),
    timeout: 300000,
    assert: async (rig) => {
      const toolLogs = rig.readToolLogs();
      console.log(JSON.stringify(toolLogs, null, 2));

      // Ensure edit tool was used
      const editCalls = toolLogs.filter(
        (log) =>
          EDIT_TOOL_NAMES.has(log.toolRequest.name) && log.toolRequest.success,
      );

      expect(editCalls.length).toBeGreaterThanOrEqual(1);

      // Verify bug is fixed in at least one core file
      const possibleFiles = [
        'src/module0.ts',
        'src/module1.ts',
        'src/module2.ts',
        'src/module3.ts',
      ];

      const contents = possibleFiles.map((f) => {
        try {
          return rig.readFile(f);
        } catch {
          return '';
        }
      });

      const combined = contents.join('\n');

      expect(combined).toContain('a + b');
    },
  });
});
