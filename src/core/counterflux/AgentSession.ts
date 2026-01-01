/**
 * AgentSession
 *
 * Lightweight wrapper around a conceptual agent instance for parallel execution.
 * Each session represents either the QA or Dev agent and manages its own
 * message stream, state, and action decisions.
 */

import { EventEmitter } from "events"
import * as vscode from "vscode"

import { ParralelContextManager, ParralelContext } from "./ParralelContext"

/**
 * Agent role type.
 */
export type AgentRole = "qa" | "dev"

/**
 * Status of an agent session.
 */
export type AgentSessionStatus = "idle" | "thinking" | "executing" | "waiting" | "completed" | "error"

/**
 * Agent action types.
 */
export type AgentActionType =
    | "write_spec"
    | "write_test"
    | "run_test"
    | "write_code"
    | "review_code"
    | "request_info"
    | "complete"

/**
 * An action decided by an agent.
 */
export interface AgentAction {
    type: AgentActionType
    description: string
    targetFile?: string
    content?: string
    command?: string
}

/**
 * Result of executing a tool/action.
 */
export interface ToolResult {
    success: boolean
    output: string
    error?: string
    affectedFiles?: string[]
}

/**
 * Configuration for creating an agent session.
 */
export interface AgentSessionConfig {
    role: AgentRole
    contextManager: ParralelContextManager
    workspacePath: string
    extensionContext: vscode.ExtensionContext
}

/**
 * Message in the agent's conversation.
 */
export interface AgentMessage {
    role: "user" | "assistant" | "system"
    content: string
    timestamp: number
    isStreaming?: boolean
}

/**
 * Events emitted by AgentSession.
 */
export interface AgentSessionEvents {
    "status:changed": (status: AgentSessionStatus) => void
    "message:added": (message: AgentMessage) => void
    "message:streaming": (content: string, isComplete: boolean) => void
    "action:started": (action: AgentAction) => void
    "action:completed": (action: AgentAction, result: ToolResult) => void
    "error": (error: Error) => void
}

/**
 * AgentSession - Manages an individual agent's execution context.
 */
export class AgentSession extends EventEmitter {
    public readonly role: AgentRole
    private status: AgentSessionStatus = "idle"
    private messages: AgentMessage[] = []
    private contextManager: ParralelContextManager
    private workspacePath: string
    private extensionContext: vscode.ExtensionContext
    private currentStreamContent: string = ""
    private isAborted: boolean = false

    constructor(config: AgentSessionConfig) {
        super()
        this.role = config.role
        this.contextManager = config.contextManager
        this.workspacePath = config.workspacePath
        this.extensionContext = config.extensionContext

        // Add initial system message based on role
        this.addSystemMessage()
    }

    /**
     * Get the current status.
     */
    getStatus(): AgentSessionStatus {
        return this.status
    }

    /**
     * Get all messages.
     */
    getMessages(): readonly AgentMessage[] {
        return this.messages
    }

    /**
     * Set the session status.
     */
    private setStatus(status: AgentSessionStatus): void {
        this.status = status
        this.emit("status:changed", status)
    }

    /**
     * Add the initial system message based on role.
     */
    private addSystemMessage(): void {
        const systemContent =
            this.role === "qa"
                ? this.getQASystemPrompt()
                : this.getDevSystemPrompt()

        this.messages.push({
            role: "system",
            content: systemContent,
            timestamp: Date.now(),
        })
    }

    /**
     * Get system prompt for QA agent.
     */
    private getQASystemPrompt(): string {
        return `You are the QA Agent in a parallel adversarial development workflow.
Your responsibilities:
1. Generate clear, testable specifications (SPEC.md)
2. Write comprehensive test cases BEFORE implementation
3. Run tests and report results
4. Review implementations for quality and correctness
5. Challenge the Developer agent to maintain high standards

You work in parallel with the Developer agent. Focus on quality assurance,
testing, and ensuring specifications are met.`
    }

    /**
     * Get system prompt for Dev agent.
     */
    private getDevSystemPrompt(): string {
        return `You are the Developer Agent in a parallel adversarial development workflow.
Your responsibilities:
1. Implement features according to the frozen SPEC.md
2. Write clean, maintainable code
3. Make tests pass (written by QA)
4. Refactor and improve code quality
5. Respond to QA feedback and code review comments

You work in parallel with the QA agent. Focus on implementation,
code quality, and making all tests pass.`
    }

    /**
     * Send a user message to the agent.
     */
    async sendMessage(message: string): Promise<void> {
        if (this.isAborted) {
            throw new Error("Session has been aborted")
        }

        // Add user message
        const userMessage: AgentMessage = {
            role: "user",
            content: message,
            timestamp: Date.now(),
        }
        this.messages.push(userMessage)
        this.emit("message:added", userMessage)

        // Set status to thinking
        this.setStatus("thinking")

        // In a real implementation, this would call the LLM API
        // For now, we simulate the response
        await this.simulateResponse(message)
    }

    /**
     * Simulate a streaming response (placeholder for real LLM integration).
     */
    private async simulateResponse(userMessage: string): Promise<void> {
        this.currentStreamContent = ""

        // Simulate streaming with chunks
        const context = this.contextManager.getContext()
        const response = this.generateSimulatedResponse(userMessage, context)

        // Stream response in chunks
        const chunks = this.splitIntoChunks(response, 20)
        for (const chunk of chunks) {
            if (this.isAborted) break

            this.currentStreamContent += chunk
            this.emit("message:streaming", this.currentStreamContent, false)
            await this.delay(50) // Simulate network delay
        }

        if (!this.isAborted) {
            // Add complete assistant message
            const assistantMessage: AgentMessage = {
                role: "assistant",
                content: this.currentStreamContent,
                timestamp: Date.now(),
            }
            this.messages.push(assistantMessage)
            this.emit("message:streaming", this.currentStreamContent, true)
            this.emit("message:added", assistantMessage)
            this.setStatus("idle")
        }
    }

    /**
     * Generate a simulated response based on role and context.
     */
    private generateSimulatedResponse(userMessage: string, context: ParralelContext): string {
        if (this.role === "qa") {
            if (!context.specContent) {
                return `## Analyzing Requirements

Based on the task: "${context.originalPrompt}"

I'll create a SPEC.md document with:
1. Clear acceptance criteria
2. Test scenarios
3. Edge cases to consider

Let me generate the specification...`
            } else if (context.specStatus === "frozen") {
                return `## Writing Tests

The SPEC is frozen. I'm now writing test cases based on the requirements.
These tests will verify the Developer's implementation.`
            }
            return `## QA Review

Reviewing the current implementation status and test results...`
        } else {
            // Dev role
            if (!context.specContent || context.specStatus === "draft") {
                return `## Waiting for SPEC

I'm waiting for the QA agent to finalize the SPEC.md document.
Once the spec is frozen, I'll begin implementation.`
            }
            return `## Implementation

Based on the frozen SPEC, I'm implementing the required features.
I'll ensure all QA tests pass.`
        }
    }

    /**
     * Decide the next action based on shared state.
     */
    async decideNextAction(context: ParralelContext): Promise<AgentAction | null> {
        if (this.isAborted || this.status === "executing") {
            return null
        }

        if (this.role === "qa") {
            return this.decideQAAction(context)
        } else {
            return this.decideDevAction(context)
        }
    }

    /**
     * Decide QA-specific action.
     */
    private decideQAAction(context: ParralelContext): AgentAction | null {
        // QA workflow: Spec -> Tests -> Run -> Review
        if (!context.specContent) {
            return {
                type: "write_spec",
                description: "Generate SPEC.md document",
                targetFile: `${context.workspacePath}/specs/SPEC.md`,
            }
        }

        if (context.specStatus === "frozen" && context.implementationStatus.testsCreated.length === 0) {
            return {
                type: "write_test",
                description: "Write test cases based on SPEC",
            }
        }

        if (context.implementationStatus.filesCreated.length > 0) {
            return {
                type: "run_test",
                description: "Run test suite",
                command: "npm test",
            }
        }

        return null
    }

    /**
     * Decide Dev-specific action.
     */
    private decideDevAction(context: ParralelContext): AgentAction | null {
        // Dev workflow: Wait for spec -> Implement -> Fix tests
        if (!context.specContent || context.specStatus === "draft") {
            return null // Wait for spec
        }

        if (context.specStatus === "frozen" || context.specStatus === "locked") {
            const lastTest = context.testResults[context.testResults.length - 1]
            if (!lastTest || !lastTest.passed) {
                return {
                    type: "write_code",
                    description: "Implement features to pass tests",
                }
            }
        }

        return null
    }

    /**
     * Execute a tool/action.
     */
    async executeTool(action: AgentAction): Promise<ToolResult> {
        if (this.isAborted) {
            return { success: false, output: "", error: "Session aborted" }
        }

        this.setStatus("executing")
        this.emit("action:started", action)

        // Simulate tool execution
        await this.delay(500)

        const result: ToolResult = {
            success: true,
            output: `Executed: ${action.description}`,
            affectedFiles: action.targetFile ? [action.targetFile] : [],
        }

        this.emit("action:completed", action, result)
        this.setStatus("idle")

        return result
    }

    /**
     * Abort the session.
     */
    abort(): void {
        this.isAborted = true
        this.setStatus("idle")
    }

    /**
     * Reset the session.
     */
    reset(): void {
        this.isAborted = false
        this.status = "idle"
        this.messages = []
        this.currentStreamContent = ""
        this.addSystemMessage()
    }

    /**
     * Helper: Split text into chunks.
     */
    private splitIntoChunks(text: string, chunkSize: number): string[] {
        const chunks: string[] = []
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.slice(i, i + chunkSize))
        }
        return chunks
    }

    /**
     * Helper: Delay for async simulation.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

/**
 * Create a new AgentSession.
 */
export function createAgentSession(config: AgentSessionConfig): AgentSession {
    return new AgentSession(config)
}
