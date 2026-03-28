/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { TestRig } from '@google/gemini-cli-test-utils';
import { expect } from 'vitest';

export interface JudgeResult {
  reasoning: string;
  verdict: 'PASS' | 'FAIL';
  score: number;
}

/**
 * Performs a hybrid assertion: Deterministic checks + LLM-as-a-judge.
 */
export async function assertSemantically(
  rig: TestRig,
  result: string,
  options: {
    rubric: string;
    deterministicChecks?: (rig: TestRig) => void | Promise<void>;
  },
) {
  // Perform Deterministic Checks (Fast & Cheap)
  if (options.deterministicChecks) {
    await options.deterministicChecks(rig);
  }

  // Graceful Degradation
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    console.warn('Skipping LLM Judge: GEMINI_API_KEY not found.');
    return;
  }

  // Prepare Context for the Judge
  // so we use the activity log to judge the PROCESS not just the OUTPUT.
  const toolLogs = rig.readToolLogs();
  const activityLog = JSON.stringify(toolLogs, null, 2);

  const systemInstruction = `You are an impartial Judge evaluating a Gemini CLI Agent's performance.
    Evaluate the agent based on the provided rubric, activity log, and final output.
    
    You MUST output EXACTLY a JSON object with this structure:
    {
      "reasoning": "...",
      "verdict": "PASS" | "FAIL",
      "score": 1-10
    }`;

  const userPrompt = `
    ### EVALUATION RUBRIC
    ${options.rubric}

    ### AGENT ACTIVITY LOG (Tool Calls & Thoughts)
    ${activityLog}

    ### FINAL AGENT OUTPUT
    ${result}
  `;

  try {
    const response = await callGemini(apiKey, systemInstruction, userPrompt);
    const evaluation = parseJudgeResponse(response);

    console.log(`[Judge Reasoning]: ${evaluation.reasoning}`);
    console.log(`[Judge Score]: ${evaluation.score}/10`);

    expect(
      evaluation.verdict,
      `LLM Judge failed the agent. Reasoning: ${evaluation.reasoning}`,
    ).toBe('PASS');
    expect(
      evaluation.score,
      `Score ${evaluation.score} is below threshold.`,
    ).toBeGreaterThanOrEqual(7);
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      console.warn(
        'LLM Judge Rate Limited or Quota Exhausted - Falling back to deterministic results only.',
      );
      return;
    }
    console.error('LLM Judge failed with error:', error);
    throw error;
  }
}

/**
 * Simple fetch based call to Gemini API
 */
async function callGemini(
  apiKey: string,
  systemInstruction: string,
  prompt: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: { text: systemInstruction },
    },
    contents: {
      parts: { text: prompt },
    },
    generationConfig: {
      response_mime_type: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Gemini API error: ${response.status} ${JSON.stringify(errorData)}`,
    );
  }

  const data = (await response.json()) as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseJudgeResponse(response: string): JudgeResult {
  try {
    const cleanJson = response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson) as JudgeResult;
  } catch (e) {
    throw new Error(`Failed to parse judge response as JSON: ${response}`);
  }
}
