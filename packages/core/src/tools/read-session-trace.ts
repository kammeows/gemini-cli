/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import fs from 'node:fs';
import type { MessageBus } from '../confirmation-bus/message-bus.js';
import type { ToolInvocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolErrorType } from './tool-error.js';
import type { Config } from '../config/config.js';
import {
  READ_SESSION_TRACE_TOOL_NAME,
  READ_SESSION_TRACE_DISPLAY_NAME,
} from './tool-names.js';
import { READ_SESSION_TRACE_DEFINITION } from './definitions/coreTools.js';
import { resolveToolDeclaration } from './definitions/resolver.js';
import { ChatRecordingService } from '../services/chatRecordingService.js';

/**
 * Parameters for the ReadSessionTrace tool
 */
export interface ReadSessionTraceToolParams {
  /**
   * The session ID to read
   */
  sessionId: string;
}

class ReadSessionTraceToolInvocation extends BaseToolInvocation<
  ReadSessionTraceToolParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: ReadSessionTraceToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ) {
    super(params, messageBus, _toolName, _toolDisplayName);
  }

  getDescription(): string {
    return `Session trace for ${this.params.sessionId}`;
  }

  async execute(): Promise<ToolResult> {
    const chatRecordingService = new ChatRecordingService(this.config);
    const sessionFilePath = chatRecordingService.findSessionFile(
      this.params.sessionId,
    );

    if (!sessionFilePath || !fs.existsSync(sessionFilePath)) {
      const errorMsg = `Session trace file for session ID '${this.params.sessionId}' not found.`;
      return {
        llmContent: errorMsg,
        returnDisplay: 'Session trace not found.',
        error: {
          message: errorMsg,
          type: ToolErrorType.FILE_NOT_FOUND,
        },
      };
    }

    try {
      const content = fs.readFileSync(sessionFilePath, 'utf8');
      return {
        llmContent: content,
        returnDisplay: `Read session trace for ${this.params.sessionId}`,
      };
    } catch (error) {
      let errorMsg = 'Unknown error while reading session trace file';

      if (error instanceof Error) {
        errorMsg = `Error reading session trace file: ${error.message}`;
      }

      return {
        llmContent: errorMsg,
        returnDisplay: 'Error reading session trace.',
        error: {
          message: errorMsg,
          type: ToolErrorType.UNHANDLED_EXCEPTION,
        },
      };
    }
  }
}

/**
 * Implementation of the ReadSessionTrace tool logic
 */
export class ReadSessionTraceTool extends BaseDeclarativeTool<
  ReadSessionTraceToolParams,
  ToolResult
> {
  static readonly Name = READ_SESSION_TRACE_TOOL_NAME;

  constructor(
    private config: Config,
    messageBus: MessageBus,
  ) {
    super(
      ReadSessionTraceTool.Name,
      READ_SESSION_TRACE_DISPLAY_NAME,
      READ_SESSION_TRACE_DEFINITION.base.description!,
      Kind.Read,
      READ_SESSION_TRACE_DEFINITION.base.parametersJsonSchema,
      messageBus,
      false,
      false,
    );
  }

  protected override validateToolParamValues(
    params: ReadSessionTraceToolParams,
  ): string | null {
    if (!params.sessionId || params.sessionId.trim() === '') {
      return "The 'sessionId' parameter must be non-empty.";
    }
    return null;
  }

  protected createInvocation(
    params: ReadSessionTraceToolParams,
    messageBus: MessageBus,
    _toolName?: string,
    _toolDisplayName?: string,
  ): ToolInvocation<ReadSessionTraceToolParams, ToolResult> {
    return new ReadSessionTraceToolInvocation(
      this.config,
      params,
      messageBus,
      _toolName,
      _toolDisplayName,
    );
  }

  override getSchema(modelId?: string) {
    return resolveToolDeclaration(READ_SESSION_TRACE_DEFINITION, modelId);
  }
}
