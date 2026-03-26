/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'vitest';
import { evalTest, TestRig } from './test-helper.js';
import {
  assertModelHasOutput,
  checkModelOutputContent,
} from './test-helper.js';

describe('frugal_behavior', () => {
  const TEST_PREFIX = 'Frugal Behavior: ';

  /**
   * Scenario: Tool Routing (Grep vs. ReadMany)
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use grep_search for discovery, not read_many_files',
    files: {
      'src/app.ts':
        'import { authMiddleware } from "./middleware/auth";\napp.use(authMiddleware);',
      'src/middleware/auth.ts':
        'export const authMiddleware = (req, res, next) => { /* logic */ };',
      'src/utils/logger.ts': 'export const log = (msg) => console.log(msg);',
      'src/routes/user.ts':
        'import { authMiddleware } from "../middleware/auth";',
    },
    prompt:
      'Find where the "authMiddleware" function is defined in the src/ directory.',
    assert: async (rig: TestRig, result: string) => {
      // Wait for expected tool
      const grepCalled = await rig.waitForToolCall('grep_search');
      expect(grepCalled).toBe(true);

      // ✅ Synchronous inspection (NO TIMEOUT)
      const toolLogs = rig.readToolLogs();

      const readManyCalled = toolLogs.some(
        (log) => log.toolRequest.name === 'read_many_files',
      );

      expect(
        readManyCalled,
        'Expected read_many_files NOT to be used for simple string discovery',
      ).toBe(false);

      assertModelHasOutput(result);
      checkModelOutputContent(result, {
        expectedContent: ['src/middleware/auth.ts'],
        testName: `${TEST_PREFIX}Tool routing discovery`,
      });
    },
  });

  /**
   * Scenario: Frugal Mutation (Edit vs. WriteFile)
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use replace (edit) for surgical changes, not write_file',
    files: {
      'styles.css': [
        'body {',
        '  margin: 0;',
        '  padding: 0;',
        '  font-family: sans-serif;',
        '  background-color: white;',
        '}',
        '.container {',
        '  display: flex;',
        '  flex-direction: column;',
        '}',
        '/* ... more styles ... */',
        ...Array.from(
          { length: 50 },
          (_, i) => `.style-${i} { color: black; }`,
        ),
      ].join('\n'),
    },
    prompt:
      'Update styles.css to change the body background-color from white to red.',
    assert: async (rig: TestRig, result: string) => {
      // Wait for expected tool
      const replaceCalled = await rig.waitForToolCall('replace');

      expect(
        replaceCalled,
        'Expected the surgical replace (edit) tool to be used for a 1-line change',
      ).toBe(true);

      const toolLogs = rig.readToolLogs();

      const writeFileCalled = toolLogs.some(
        (log) => log.toolRequest.name === 'write_file',
      );

      expect(
        writeFileCalled,
        'Expected write_file NOT to be used for a surgical edit in a pre-existing file',
      ).toBe(false);

      assertModelHasOutput(result);

      const content = rig.readFile('styles.css');
      expect(content).toContain('background-color: red;');
      expect(content).not.toContain('background-color: white;');
    },
  });

  /**
   * Scenario: Context Resiliency (Needle in a Haystack)
   */
  evalTest('USUALLY_PASSES', {
    name: 'should find a specific bug after reading multiple files (context resiliency)',
    files: {
      'src/auth.ts':
        'export const login = (user, pass) => { if (user === "admin" && pass === "1234") return true; return false; };',
      'src/db.ts': 'export const query = (sql) => { /* db logic */ };',
      'src/server.ts': 'import express from "express";\nconst app = express();',
      'src/vulnerable.ts':
        '// DANGER: This is an intentional security flaw\nexport const execute = (input) => { eval(input); };',
      'src/config.ts': 'export const PORT = 3000;',
    },
    prompt:
      'There is a severe security vulnerability in one of the files in the src directory. Use the tools to find it and tell me which file it is in and why.',
    assert: async (_rig: TestRig, result: string) => {
      assertModelHasOutput(result);

      checkModelOutputContent(result, {
        expectedContent: [/vulnerable\.ts/, /eval\(/, /security/i],
        testName: `${TEST_PREFIX}Context resiliency bug find`,
      });
    },
  });
});
