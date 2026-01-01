/**
 * ParralelContext
 *
 * Shared state between parallel QA and Dev agent sessions.
 * This context is synchronized between both agents to enable
 * coordinated adversarial development.
 */

import { EventEmitter } from "events"

/**
 * Test result from running the test suite.
 */
export interface ParralelTestResult {
    passed: boolean
    totalTests: number
    passedTests: number
    failedTests: number
    output: string
    timestamp: number
    triggeredBy: "qa" | "dev"
}

/**
 * Status of the SPEC document.
 */
export type SpecStatus = "draft" | "frozen" | "locked"

/**
 * Implementation progress tracking.
 */
export interface ImplementationStatus {
    filesCreated: string[]
    filesModified: string[]
    testsCreated: string[]
    lastActivity: "qa" | "dev" | null
    lastActivityTimestamp: number
}

/**
 * Shared state between parallel agents.
 */
export interface ParralelContext {
    /** Original user prompt */
    originalPrompt: string

    /** Workspace root path */
    workspacePath: string

    /** SPEC document content */
    specContent: string | null

    /** SPEC document path */
    specPath: string | null

    /** SPEC status: draft, frozen, or locked */
    specStatus: SpecStatus

    /** All test results from the workflow */
    testResults: ParralelTestResult[]

    /** Implementation progress */
    implementationStatus: ImplementationStatus

    /** Whether the parallel workflow is active */
    isWorkflowActive: boolean

    /** Current iteration of the ping-pong loop */
    iteration: number

    /** Maximum iterations before requiring user input */
    maxIterations: number

    /** Timestamp when workflow started */
    startTime: number
}

/**
 * Events emitted by ParralelContext for state changes.
 */
export interface ParralelContextEvents {
    "spec:updated": (content: string, status: SpecStatus) => void
    "spec:frozen": () => void
    "test:completed": (result: ParralelTestResult) => void
    "implementation:updated": (status: ImplementationStatus) => void
    "workflow:paused": (reason: string) => void
    "workflow:completed": () => void
    "state:changed": (context: ParralelContext) => void
}

/**
 * ParralelContextManager - Manages and synchronizes shared state.
 */
export class ParralelContextManager extends EventEmitter {
    private context: ParralelContext

    constructor(originalPrompt: string, workspacePath: string, maxIterations: number = 10) {
        super()
        this.context = createParralelContext(originalPrompt, workspacePath, maxIterations)
    }

    /**
     * Get the current context snapshot.
     */
    getContext(): Readonly<ParralelContext> {
        return { ...this.context }
    }

    /**
     * Update the SPEC document.
     */
    updateSpec(content: string, status?: SpecStatus): void {
        this.context.specContent = content
        if (status) {
            this.context.specStatus = status
        }
        this.emit("spec:updated", content, this.context.specStatus)
        this.emit("state:changed", this.getContext())
    }

    /**
     * Set SPEC path.
     */
    setSpecPath(path: string): void {
        this.context.specPath = path
        this.emit("state:changed", this.getContext())
    }

    /**
     * Freeze the SPEC (no more modifications).
     */
    freezeSpec(): void {
        this.context.specStatus = "frozen"
        this.emit("spec:frozen")
        this.emit("state:changed", this.getContext())
    }

    /**
     * Lock the SPEC (user approved).
     */
    lockSpec(): void {
        this.context.specStatus = "locked"
        this.emit("state:changed", this.getContext())
    }

    /**
     * Add a test result.
     */
    addTestResult(result: ParralelTestResult): void {
        this.context.testResults.push(result)
        this.emit("test:completed", result)
        this.emit("state:changed", this.getContext())
    }

    /**
     * Get the most recent test result.
     */
    getLastTestResult(): ParralelTestResult | null {
        return this.context.testResults.length > 0
            ? this.context.testResults[this.context.testResults.length - 1]
            : null
    }

    /**
     * Update implementation status.
     */
    updateImplementation(updates: Partial<ImplementationStatus>, triggeredBy: "qa" | "dev"): void {
        this.context.implementationStatus = {
            ...this.context.implementationStatus,
            ...updates,
            lastActivity: triggeredBy,
            lastActivityTimestamp: Date.now(),
        }
        this.emit("implementation:updated", this.context.implementationStatus)
        this.emit("state:changed", this.getContext())
    }

    /**
     * Add a created file to tracking.
     */
    addCreatedFile(filePath: string): void {
        if (!this.context.implementationStatus.filesCreated.includes(filePath)) {
            this.context.implementationStatus.filesCreated.push(filePath)
            this.emit("state:changed", this.getContext())
        }
    }

    /**
     * Add a test file to tracking.
     */
    addTestFile(filePath: string): void {
        if (!this.context.implementationStatus.testsCreated.includes(filePath)) {
            this.context.implementationStatus.testsCreated.push(filePath)
            this.emit("state:changed", this.getContext())
        }
    }

    /**
     * Increment the iteration counter.
     */
    incrementIteration(): number {
        this.context.iteration++
        if (this.context.iteration >= this.context.maxIterations) {
            this.emit("workflow:paused", "Max iterations reached")
        }
        this.emit("state:changed", this.getContext())
        return this.context.iteration
    }

    /**
     * Check if max iterations reached.
     */
    isMaxIterationsReached(): boolean {
        return this.context.iteration >= this.context.maxIterations
    }

    /**
     * Start the workflow.
     */
    startWorkflow(): void {
        this.context.isWorkflowActive = true
        this.context.startTime = Date.now()
        this.emit("state:changed", this.getContext())
    }

    /**
     * Pause the workflow.
     */
    pauseWorkflow(reason: string): void {
        this.context.isWorkflowActive = false
        this.emit("workflow:paused", reason)
        this.emit("state:changed", this.getContext())
    }

    /**
     * Resume the workflow.
     */
    resumeWorkflow(): void {
        this.context.isWorkflowActive = true
        this.emit("state:changed", this.getContext())
    }

    /**
     * Complete the workflow.
     */
    completeWorkflow(): void {
        this.context.isWorkflowActive = false
        this.emit("workflow:completed")
        this.emit("state:changed", this.getContext())
    }

    /**
     * Reset the context to initial state.
     */
    reset(): void {
        this.context = createParralelContext(
            this.context.originalPrompt,
            this.context.workspacePath,
            this.context.maxIterations
        )
        this.emit("state:changed", this.getContext())
    }
}

/**
 * Create a new ParralelContext with default values.
 */
export function createParralelContext(
    originalPrompt: string,
    workspacePath: string,
    maxIterations: number = 10
): ParralelContext {
    return {
        originalPrompt,
        workspacePath,
        specContent: null,
        specPath: null,
        specStatus: "draft",
        testResults: [],
        implementationStatus: {
            filesCreated: [],
            filesModified: [],
            testsCreated: [],
            lastActivity: null,
            lastActivityTimestamp: 0,
        },
        isWorkflowActive: false,
        iteration: 0,
        maxIterations,
        startTime: 0,
    }
}
