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
   * Expectation: Agent uses google_web_search for open-ended queries.
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
      // We check if the result mentions React and looks like a version number
      checkModelOutputContent(result, {
        expectedContent: [/React/i, /\d+\.\d+\.\d+/],
        testName: `${TEST_PREFIX}React version search`,
      });
    },
  });

  /**
   * Scenario B: "Summarize this [url]"
   * Expectation: Agent uses web_fetch, NOT google_web_search when a specific URL is provided.
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use web_fetch for specific URLs, not search',
    prompt:
      'Summarize the content of this GitHub issue: https://github.com/google/gemini-cli/issues/1',
    assert: async (rig: TestRig, result: string) => {
      const fetchCalled = await rig.waitForToolCall('web_fetch');
      // I understand the following line causes unnecessary latency, so a more efficient approach would be to allow the agent to execute normally and
      // then synchronously inspect the execution trace
      // and assert absence by checking that the undesired tool does not appear in the recorded calls
      const searchCalled = await rig.waitForToolCall('google_web_search', 5000); // Short wait to ensure it wasn't called

      expect(
        fetchCalled,
        'Expected web_fetch to be called for a specific URL',
      ).toBe(true);

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
   * Scenario C: "Summarize the local README.md"
   * Expectation: Agent uses read_file (or read_many_files), NEITHER web tool.
   */
  evalTest('USUALLY_PASSES', {
    name: 'should use local tools for local files, no web tools',
    files: {
      'README.md':
        '# Gemini CLI\n\nThis is a local test file for the agent to read.',
    },
    prompt: 'Summarize the local README.md file in this directory.',
    assert: async (rig: TestRig, result: string) => {
      const readFileCalled = await rig.waitForToolCall('read_file');
      const readManyCalled = await rig.waitForToolCall('read_many_files', 2000);
      const searchCalled = await rig.waitForToolCall('google_web_search', 2000);
      const fetchCalled = await rig.waitForToolCall('web_fetch', 2000);

      expect(
        readFileCalled || readManyCalled,
        'Expected local read tool to be called for a local file',
      ).toBe(true);

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
