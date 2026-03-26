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

describe('tool_boundary_selection', () => {
  const TEST_PREFIX = 'Tool Selection Boundary: ';

  /**
   * Scenario A: "What is the latest React version?"
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use google_web_search for current info',
    prompt: 'What is the latest stable React version as of today?',
    assert: async (rig: TestRig, result: string) => {
      const wasToolCalled = await rig.waitForToolCall('google_web_search');

      expect(
        wasToolCalled,
        'Expected google_web_search to be called for a general knowledge query',
      ).toBe(true);

      assertModelHasOutput(result);

      checkModelOutputContent(result, {
        expectedContent: [/React/i, /\d+\.\d+\.\d+/],
        testName: `${TEST_PREFIX}React version search`,
      });
    },
  });

  /**
   * Scenario B: URL → must use web_fetch, NOT search
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use web_fetch for specific URLs, not search',
    prompt:
      'Summarize the content of this GitHub issue: https://github.com/google-gemini/gemini-cli/issues/17683',
    assert: async (rig: TestRig, result: string) => {
      // Wait for expected behavior
      const fetchCalled = await rig.waitForToolCall('web_fetch');

      expect(
        fetchCalled,
        'Expected web_fetch to be called for a specific URL',
      ).toBe(true);

      const toolLogs = rig.readToolLogs();

      const searchCalled = toolLogs.some(
        (log) => log.toolRequest.name === 'google_web_search',
      );

      expect(
        searchCalled,
        'Expected google_web_search NOT to be called when a specific URL is provided',
      ).toBe(false);

      assertModelHasOutput(result);

      checkModelOutputContent(result, {
        testName: `${TEST_PREFIX}Specific URL fetch`,
      });
    },
  });

  /**
   * Scenario C: Local file → must use local tools, NO web tools
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use local tools for local files, no web tools',
    files: {
      'README.md':
        '# Gemini CLI\n\nThis is a local test file for the agent to read.',
    },
    prompt: 'Summarize the local README.md file in this directory.',
    assert: async (rig: TestRig, result: string) => {
      // Wait for at least one valid local tool
      const readFileCalled = await rig.waitForToolCall('read_file');

      // NOTE: Some runs may use read_many_files instead, so we check both in trace
      const toolLogs = rig.readToolLogs();

      const readManyCalled = toolLogs.some(
        (log) => log.toolRequest.name === 'read_many_files',
      );

      expect(
        readFileCalled || readManyCalled,
        'Expected a local read tool to be called for a local file',
      ).toBe(true);

      const searchCalled = toolLogs.some(
        (log) => log.toolRequest.name === 'google_web_search',
      );

      const fetchCalled = toolLogs.some(
        (log) => log.toolRequest.name === 'web_fetch',
      );

      expect(
        searchCalled,
        'Expected google_web_search NOT to be called for a local file',
      ).toBe(false);

      expect(
        fetchCalled,
        'Expected web_fetch NOT to be called for a local file',
      ).toBe(false);

      assertModelHasOutput(result);

      checkModelOutputContent(result, {
        expectedContent: [/Gemini CLI/, /local test file/],
        testName: `${TEST_PREFIX}Local file read boundary`,
      });
    },
  });
});
