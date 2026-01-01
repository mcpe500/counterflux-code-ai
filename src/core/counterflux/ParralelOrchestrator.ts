/**
 * ParralelOrchestrator
 *
 * The main coordinator for truly parallel QA vs Developer agent execution.
 * Unlike the sequential CounterfluxOrchestrator, this manages two concurrent
 * agent sessions that can operate simultaneously.
 *
 * Architecture:
 * - Two AgentSession instances (QA and Dev)
 * - Shared ParralelContextManager for state synchronization
 * - Event-driven UI updates for both panels
 * - Parallel execution loop with coordination points
 */

import { EventEmitter } from "events"
import * as vscode from "vscode"

import {
    ParralelContextManager,
    ParralelContext,
    SpecStatus,
    ParralelTestResult,
} from "./ParralelContext"

import {
    AgentSession,
    AgentRole,
    AgentSessionStatus,
    AgentAction,
    ToolResult,
    AgentMessage,
    createAgentSession,
} from "./AgentSession"

/**
 * Orchestrator status.
 */
export type ParralelOrchestratorStatus =
    | "idle"
    | "initializing"
    | "running"
    | "paused"
    | "completed"
    | "error"

/**
 * Configuration for the ParralelOrchestrator.
 */
export interface ParralelOrchestratorConfig {
    extensionContext: vscode.ExtensionContext
    workspacePath: string
    maxIterations?: number
    loopIntervalMs?: number
}

/**
 * Callbacks for UI updates.
 */
export interface ParralelOrchestratorCallbacks {
    onQAMessage: (message: AgentMessage) => void
    onDevMessage: (message: AgentMessage) => void
    onQAStreaming: (content: string, isComplete: boolean) => void
    onDevStreaming: (content: string, isComplete: boolean) => void
    onQAStatusChange: (status: AgentSessionStatus) => void
    onDevStatusChange: (status: AgentSessionStatus) => void
    onContextUpdate: (context: ParralelContext) => void
    onSpecUpdate: (content: string, status: SpecStatus) => void
    onTestResult: (result: ParralelTestResult) => void
    onOrchestratorStatusChange: (status: ParralelOrchestratorStatus) => void
    onError: (error: Error, source: "qa" | "dev" | "orchestrator") => void
    askApproval: (message: string) => Promise<boolean>
    notifyUser: (message: string, type: "info" | "warning" | "error") => void
}

/**
 * ParralelOrchestrator - Manages parallel QA and Dev agent execution.
 */
export class ParralelOrchestrator extends EventEmitter {
    private status: ParralelOrchestratorStatus = "idle"
    private qaSession: AgentSession | null = null
    private devSession: AgentSession | null = null
    private contextManager: ParralelContextManager | null = null
    private callbacks: ParralelOrchestratorCallbacks
    private config: ParralelOrchestratorConfig
    private loopInterval: NodeJS.Timeout | null = null
    private isLoopRunning: boolean = false

    constructor(config: ParralelOrchestratorConfig, callbacks: ParralelOrchestratorCallbacks) {
        super()
        this.config = {
            ...config,
            maxIterations: config.maxIterations ?? 10,
            loopIntervalMs: config.loopIntervalMs ?? 200,
        }
        this.callbacks = callbacks
    }

    /**
     * Get the current orchestrator status.
     */
    getStatus(): ParralelOrchestratorStatus {
        return this.status
    }

    /**
     * Get the QA session.
     */
    getQASession(): AgentSession | null {
        return this.qaSession
    }

    /**
     * Get the Dev session.
     */
    getDevSession(): AgentSession | null {
        return this.devSession
    }

    /**
     * Get the shared context.
     */
    getContext(): ParralelContext | null {
        return this.contextManager?.getContext() ?? null
    }

    /**
     * Start the Parralel mode workflow.
     */
    async startParralelMode(prompt: string): Promise<void> {
        if (this.status !== "idle") {
            throw new Error(`Cannot start: orchestrator is in ${this.status} state`)
        }

        try {
            this.setStatus("initializing")

            // Create shared context manager
            this.contextManager = new ParralelContextManager(
                prompt,
                this.config.workspacePath,
                this.config.maxIterations
            )

            // Set up context event listeners
            this.setupContextListeners()

            // Create QA session
            this.qaSession = createAgentSession({
                role: "qa",
                contextManager: this.contextManager,
                workspacePath: this.config.workspacePath,
                extensionContext: this.config.extensionContext,
            })
            this.setupSessionListeners(this.qaSession, "qa")

            // Create Dev session
            this.devSession = createAgentSession({
                role: "dev",
                contextManager: this.contextManager,
                workspacePath: this.config.workspacePath,
                extensionContext: this.config.extensionContext,
            })
            this.setupSessionListeners(this.devSession, "dev")

            // Start workflow
            this.contextManager.startWorkflow()
            this.setStatus("running")

            // Send initial prompt to QA (QA leads spec creation)
            await this.qaSession.sendMessage(
                `User Request: ${prompt}\n\nAnalyze this request and create a detailed SPEC.md document with clear acceptance criteria and test scenarios.`
            )

            // Notify dev that it should wait
            await this.devSession.sendMessage(
                `A new task has been started: "${prompt}"\n\nWait for the QA Agent to create and freeze the SPEC.md document before beginning implementation.`
            )

            // Start the parallel execution loop
            this.startParallelLoop()

            this.callbacks.notifyUser("Parralel mode started - QA and Dev agents are now active", "info")
        } catch (error) {
            this.setStatus("error")
            this.callbacks.onError(error as Error, "orchestrator")
            throw error
        }
    }

    /**
     * Set up listeners for context events.
     */
    private setupContextListeners(): void {
        if (!this.contextManager) return

        this.contextManager.on("state:changed", (context) => {
            this.callbacks.onContextUpdate(context)
        })

        this.contextManager.on("spec:updated", (content, status) => {
            this.callbacks.onSpecUpdate(content, status)
        })

        this.contextManager.on("test:completed", (result) => {
            this.callbacks.onTestResult(result)
        })

        this.contextManager.on("workflow:paused", (reason) => {
            this.pauseWorkflow(reason)
        })

        this.contextManager.on("workflow:completed", () => {
            this.completeWorkflow()
        })
    }

    /**
     * Set up listeners for a session.
     */
    private setupSessionListeners(session: AgentSession, role: AgentRole): void {
        const isQA = role === "qa"

        session.on("status:changed", (status) => {
            if (isQA) {
                this.callbacks.onQAStatusChange(status)
            } else {
                this.callbacks.onDevStatusChange(status)
            }
        })

        session.on("message:added", (message) => {
            if (isQA) {
                this.callbacks.onQAMessage(message)
            } else {
                this.callbacks.onDevMessage(message)
            }
        })

        session.on("message:streaming", (content, isComplete) => {
            if (isQA) {
                this.callbacks.onQAStreaming(content, isComplete)
            } else {
                this.callbacks.onDevStreaming(content, isComplete)
            }
        })

        session.on("error", (error) => {
            this.callbacks.onError(error, role)
        })
    }

    /**
     * Start the parallel execution loop.
     */
    private startParallelLoop(): void {
        if (this.isLoopRunning) return

        this.isLoopRunning = true

        this.loopInterval = setInterval(async () => {
            if (this.status !== "running") {
                return
            }

            try {
                await this.executeLoopIteration()
            } catch (error) {
                this.callbacks.onError(error as Error, "orchestrator")
            }
        }, this.config.loopIntervalMs)
    }

    /**
     * Execute one iteration of the parallel loop.
     */
    private async executeLoopIteration(): Promise<void> {
        if (!this.qaSession || !this.devSession || !this.contextManager) {
            return
        }

        const context = this.contextManager.getContext()

        // Check if both agents are idle (ready for next action)
        const qaStatus = this.qaSession.getStatus()
        const devStatus = this.devSession.getStatus()

        // Only proceed if at least one agent is idle
        if (qaStatus !== "idle" && devStatus !== "idle") {
            return
        }

        // Parallel action decision
        const [qaAction, devAction] = await Promise.all([
            qaStatus === "idle" ? this.qaSession.decideNextAction(context) : null,
            devStatus === "idle" ? this.devSession.decideNextAction(context) : null,
        ])

        // Execute actions in parallel
        const actionPromises: Promise<ToolResult | null>[] = []

        if (qaAction && qaStatus === "idle") {
            actionPromises.push(this.executeAgentAction(this.qaSession, qaAction, "qa"))
        }

        if (devAction && devStatus === "idle") {
            actionPromises.push(this.executeAgentAction(this.devSession, devAction, "dev"))
        }

        // Wait for all actions to complete
        await Promise.all(actionPromises)

        // Check for completion or iteration limit
        if (this.shouldCheckCompleteness()) {
            await this.checkWorkflowCompleteness()
        }
    }

    /**
     * Execute an agent action.
     */
    private async executeAgentAction(
        session: AgentSession,
        action: AgentAction,
        role: AgentRole
    ): Promise<ToolResult | null> {
        try {
            const result = await session.executeTool(action)

            // Update context based on action type
            this.updateContextFromAction(action, result, role)

            return result
        } catch (error) {
            this.callbacks.onError(error as Error, role)
            return null
        }
    }

    /**
     * Update shared context based on action results.
     */
    private updateContextFromAction(action: AgentAction, result: ToolResult, role: AgentRole): void {
        if (!this.contextManager) return

        switch (action.type) {
            case "write_spec":
                if (result.success && action.content) {
                    this.contextManager.updateSpec(action.content, "draft")
                    if (action.targetFile) {
                        this.contextManager.setSpecPath(action.targetFile)
                    }
                }
                break

            case "write_test":
                if (result.success && result.affectedFiles) {
                    result.affectedFiles.forEach((file) => {
                        this.contextManager!.addTestFile(file)
                    })
                }
                break

            case "run_test":
                if (result.success) {
                    // Parse test output and add result
                    const testResult: ParralelTestResult = {
                        passed: result.output.includes("passed"),
                        totalTests: 1, // Would parse from output
                        passedTests: result.output.includes("passed") ? 1 : 0,
                        failedTests: result.output.includes("passed") ? 0 : 1,
                        output: result.output,
                        timestamp: Date.now(),
                        triggeredBy: role,
                    }
                    this.contextManager.addTestResult(testResult)
                }
                break

            case "write_code":
                if (result.success && result.affectedFiles) {
                    result.affectedFiles.forEach((file) => {
                        this.contextManager!.addCreatedFile(file)
                    })
                }
                break
        }
    }

    /**
     * Check if we should evaluate workflow completeness.
     */
    private shouldCheckCompleteness(): boolean {
        if (!this.contextManager) return false
        const context = this.contextManager.getContext()

        // Check every few iterations or when tests start passing
        return context.iteration > 0 && context.iteration % 3 === 0
    }

    /**
     * Check if the workflow is complete.
     */
    private async checkWorkflowCompleteness(): Promise<void> {
        if (!this.contextManager) return

        const context = this.contextManager.getContext()
        const lastTest = context.testResults[context.testResults.length - 1]

        // If all tests pass, ask for review
        if (lastTest?.passed && context.specStatus === "locked") {
            const shouldComplete = await this.callbacks.askApproval(
                "All tests are passing. Do you want to mark this task as complete?"
            )

            if (shouldComplete) {
                this.completeWorkflow()
            }
        }

        // Increment iteration
        this.contextManager.incrementIteration()
    }

    /**
     * Send a message to a specific agent.
     */
    async sendMessageToAgent(role: AgentRole, message: string): Promise<void> {
        const session = role === "qa" ? this.qaSession : this.devSession

        if (!session) {
            throw new Error(`${role} session not initialized`)
        }

        await session.sendMessage(message)
    }

    /**
     * Freeze the SPEC document.
     */
    async freezeSpec(): Promise<void> {
        if (!this.contextManager) return

        this.contextManager.freezeSpec()

        // Notify both agents
        if (this.qaSession) {
            await this.qaSession.sendMessage(
                "The SPEC has been frozen. You can now write test cases based on the specification."
            )
        }

        if (this.devSession) {
            await this.devSession.sendMessage(
                "The SPEC has been frozen. You can now begin implementation. Make sure all tests pass."
            )
        }
    }

    /**
     * Lock the SPEC (user approved).
     */
    lockSpec(): void {
        this.contextManager?.lockSpec()
    }

    /**
     * Pause the workflow.
     */
    pauseWorkflow(reason: string): void {
        if (this.loopInterval) {
            clearInterval(this.loopInterval)
            this.loopInterval = null
        }
        this.isLoopRunning = false
        this.setStatus("paused")
        this.callbacks.notifyUser(`Workflow paused: ${reason}`, "warning")
    }

    /**
     * Resume the workflow.
     */
    resumeWorkflow(): void {
        if (this.status !== "paused") return

        this.contextManager?.resumeWorkflow()
        this.setStatus("running")
        this.startParallelLoop()
        this.callbacks.notifyUser("Workflow resumed", "info")
    }

    /**
     * Complete the workflow.
     */
    completeWorkflow(): void {
        if (this.loopInterval) {
            clearInterval(this.loopInterval)
            this.loopInterval = null
        }
        this.isLoopRunning = false
        this.contextManager?.completeWorkflow()
        this.setStatus("completed")
        this.callbacks.notifyUser("Workflow completed successfully!", "info")
    }

    /**
     * Abort the workflow.
     */
    abort(): void {
        if (this.loopInterval) {
            clearInterval(this.loopInterval)
            this.loopInterval = null
        }
        this.isLoopRunning = false

        this.qaSession?.abort()
        this.devSession?.abort()

        this.setStatus("idle")
        this.callbacks.notifyUser("Workflow aborted", "warning")
    }

    /**
     * Reset the orchestrator.
     */
    reset(): void {
        this.abort()

        this.qaSession?.reset()
        this.devSession?.reset()
        this.contextManager?.reset()

        this.qaSession = null
        this.devSession = null
        this.contextManager = null

        this.setStatus("idle")
    }

    /**
     * Set the orchestrator status.
     */
    private setStatus(status: ParralelOrchestratorStatus): void {
        this.status = status
        this.emit("status:changed", status)
        this.callbacks.onOrchestratorStatusChange(status)
    }

    /**
     * Dispose resources.
     */
    dispose(): void {
        this.abort()
        this.removeAllListeners()
    }
}

/**
 * Create a new ParralelOrchestrator.
 */
export function createParralelOrchestrator(
    config: ParralelOrchestratorConfig,
    callbacks: ParralelOrchestratorCallbacks
): ParralelOrchestrator {
    return new ParralelOrchestrator(config, callbacks)
}
