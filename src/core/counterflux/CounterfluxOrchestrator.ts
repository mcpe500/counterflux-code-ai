/**
 * CounterfluxOrchestrator
 *
 * The main coordinator for the adversarial QA vs Developer workflow.
 * This orchestrator manages the ping-pong workflow between QA and Dev modes,
 * ensuring that:
 * 1. QA writes the spec first (SPEC.md)
 * 2. QA writes failing tests
 * 3. Dev implements code to pass tests
 * 4. Tests are run to verify
 * 5. QA reviews the implementation
 * 6. Loop continues until all tests pass and review is approved
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"

import { CounterfluxContext, createCounterfluxContext, TestResult, ReviewFeedback } from "./CounterfluxContext"

/**
 * States in the Counterflux workflow state machine.
 */
export enum CounterfluxState {
    /** Waiting for user input to start */
    IDLE = "IDLE",

    /** QA Mode: Creating the SPEC.md document */
    SPEC_CREATION = "SPEC_CREATION",

    /** Spec has been created, waiting for user approval to freeze */
    SPEC_FROZEN = "SPEC_FROZEN",

    /** QA Mode: Writing failing tests based on the spec */
    TEST_WRITING = "TEST_WRITING",

    /** Dev Mode: Implementing code to pass the tests */
    IMPLEMENTING = "IMPLEMENTING",

    /** Running the test suite */
    RUNNING_TESTS = "RUNNING_TESTS",

    /** QA Mode: Reviewing the implementation */
    CODE_REVIEW = "CODE_REVIEW",

    /** Workflow completed successfully */
    COMPLETED = "COMPLETED",

    /** Workflow paused, waiting for user input */
    PAUSED = "PAUSED",

    /** Error state */
    ERROR = "ERROR",
}

/**
 * Events that trigger state transitions.
 */
export type CounterfluxEvent =
    | { type: "START"; prompt: string }
    | { type: "SPEC_CREATED"; specPath: string }
    | { type: "SPEC_APPROVED" }
    | { type: "TESTS_WRITTEN"; testFiles: string[] }
    | { type: "IMPLEMENTATION_DONE" }
    | { type: "TESTS_PASSED"; result: TestResult }
    | { type: "TESTS_FAILED"; result: TestResult }
    | { type: "REVIEW_APPROVED"; feedback: ReviewFeedback }
    | { type: "REVIEW_REJECTED"; feedback: ReviewFeedback }
    | { type: "MAX_ITERATIONS_REACHED" }
    | { type: "USER_CONTINUE" }
    | { type: "USER_ABORT" }
    | { type: "ERROR"; message: string }

/**
 * Callbacks for the orchestrator to interact with the extension.
 */
export interface CounterfluxCallbacks {
    /** Switch to a different mode */
    switchMode: (modeSlug: string) => Promise<void>

    /** Send a message/instruction to the current task */
    sendMessage: (message: string) => Promise<void>

    /** Execute a command in the terminal */
    executeCommand: (command: string) => Promise<{ exitCode: number; output: string }>

    /** Check if a file exists */
    fileExists: (filePath: string) => Promise<boolean>

    /** Read file content */
    readFile: (filePath: string) => Promise<string>

    /** Show user notification */
    notifyUser: (message: string, type: "info" | "warning" | "error") => void

    /** Ask user for approval */
    askApproval: (message: string) => Promise<boolean>

    /** Log message for debugging */
    log: (message: string) => void
}

/**
 * The Counterflux Orchestrator manages the adversarial workflow.
 */
export class CounterfluxOrchestrator {
    private state: CounterfluxState = CounterfluxState.IDLE
    private context: CounterfluxContext | null = null
    private callbacks: CounterfluxCallbacks

    constructor(callbacks: CounterfluxCallbacks) {
        this.callbacks = callbacks
    }

    /**
     * Get the current state of the orchestrator.
     */
    getState(): CounterfluxState {
        return this.state
    }

    /**
     * Get the current context.
     */
    getContext(): CounterfluxContext | null {
        return this.context
    }

    /**
     * Start the Counterflux workflow with a user prompt.
     */
    async start(prompt: string, workspacePath: string): Promise<void> {
        this.callbacks.log(`[Counterflux] Starting workflow with prompt: ${prompt.substring(0, 100)}...`)

        this.context = createCounterfluxContext(prompt, workspacePath)
        await this.handleEvent({ type: "START", prompt })
    }

    /**
     * Handle an event and transition to the appropriate state.
     */
    async handleEvent(event: CounterfluxEvent): Promise<void> {
        this.callbacks.log(`[Counterflux] Handling event: ${event.type} in state: ${this.state}`)

        try {
            switch (this.state) {
                case CounterfluxState.IDLE:
                    await this.handleIdleState(event)
                    break

                case CounterfluxState.SPEC_CREATION:
                    await this.handleSpecCreationState(event)
                    break

                case CounterfluxState.SPEC_FROZEN:
                    await this.handleSpecFrozenState(event)
                    break

                case CounterfluxState.TEST_WRITING:
                    await this.handleTestWritingState(event)
                    break

                case CounterfluxState.IMPLEMENTING:
                    await this.handleImplementingState(event)
                    break

                case CounterfluxState.RUNNING_TESTS:
                    await this.handleRunningTestsState(event)
                    break

                case CounterfluxState.CODE_REVIEW:
                    await this.handleCodeReviewState(event)
                    break

                case CounterfluxState.PAUSED:
                    await this.handlePausedState(event)
                    break

                case CounterfluxState.COMPLETED:
                case CounterfluxState.ERROR:
                    // Terminal states - no transitions
                    break
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.callbacks.log(`[Counterflux] Error in state ${this.state}: ${errorMessage}`)
            await this.transitionTo(CounterfluxState.ERROR, `Error: ${errorMessage}`)
        }
    }

    /**
     * Transition to a new state.
     */
    private async transitionTo(newState: CounterfluxState, description?: string): Promise<void> {
        const oldState = this.state
        this.state = newState

        if (this.context && description) {
            this.context.currentPhaseDescription = description
        }

        this.callbacks.log(`[Counterflux] Transition: ${oldState} -> ${newState}`)

        // Execute entry actions for the new state
        await this.executeStateEntry(newState)
    }

    /**
     * Execute entry actions when entering a state.
     */
    private async executeStateEntry(state: CounterfluxState): Promise<void> {
        if (!this.context) return

        switch (state) {
            case CounterfluxState.SPEC_CREATION:
                await this.enterSpecCreation()
                break

            case CounterfluxState.TEST_WRITING:
                await this.enterTestWriting()
                break

            case CounterfluxState.IMPLEMENTING:
                await this.enterImplementing()
                break

            case CounterfluxState.RUNNING_TESTS:
                await this.enterRunningTests()
                break

            case CounterfluxState.CODE_REVIEW:
                await this.enterCodeReview()
                break

            case CounterfluxState.COMPLETED:
                this.callbacks.notifyUser("Counterflux workflow completed successfully!", "info")
                break

            case CounterfluxState.ERROR:
                this.callbacks.notifyUser(`Counterflux workflow error: ${this.context.currentPhaseDescription}`, "error")
                break
        }
    }

    // ==================== State Handlers ====================

    private async handleIdleState(event: CounterfluxEvent): Promise<void> {
        if (event.type === "START") {
            await this.transitionTo(CounterfluxState.SPEC_CREATION, "Creating specification document...")
        }
    }

    private async handleSpecCreationState(event: CounterfluxEvent): Promise<void> {
        if (event.type === "SPEC_CREATED" && this.context) {
            this.context.specPath = event.specPath
            const approved = await this.callbacks.askApproval(
                `Spec document created at ${event.specPath}. Do you want to freeze the spec and proceed to test writing?`,
            )
            if (approved) {
                this.context.specFrozen = true
                await this.transitionTo(CounterfluxState.SPEC_FROZEN, "Spec frozen, ready for test writing")
                // Automatically proceed to test writing
                await this.handleEvent({ type: "SPEC_APPROVED" })
            }
        } else if (event.type === "USER_ABORT") {
            await this.transitionTo(CounterfluxState.IDLE, "Workflow aborted by user")
        }
    }

    private async handleSpecFrozenState(event: CounterfluxEvent): Promise<void> {
        if (event.type === "SPEC_APPROVED") {
            await this.transitionTo(CounterfluxState.TEST_WRITING, "Writing failing tests...")
        }
    }

    private async handleTestWritingState(event: CounterfluxEvent): Promise<void> {
        if (event.type === "TESTS_WRITTEN" && this.context) {
            this.context.testFiles = [...this.context.testFiles, ...event.testFiles]
            await this.transitionTo(CounterfluxState.IMPLEMENTING, "Implementing code to pass tests...")
        }
    }

    private async handleImplementingState(event: CounterfluxEvent): Promise<void> {
        if (event.type === "IMPLEMENTATION_DONE") {
            await this.transitionTo(CounterfluxState.RUNNING_TESTS, "Running test suite...")
        }
    }

    private async handleRunningTestsState(event: CounterfluxEvent): Promise<void> {
        if (!this.context) return

        if (event.type === "TESTS_PASSED") {
            this.context.lastTestResult = event.result
            await this.transitionTo(CounterfluxState.CODE_REVIEW, "All tests passed! Reviewing implementation...")
        } else if (event.type === "TESTS_FAILED") {
            this.context.lastTestResult = event.result
            this.context.iteration++

            if (this.context.iteration >= this.context.maxIterations) {
                await this.handleEvent({ type: "MAX_ITERATIONS_REACHED" })
            } else {
                // Go back to implementing
                await this.transitionTo(
                    CounterfluxState.IMPLEMENTING,
                    `Tests failed (iteration ${this.context.iteration}). Implementing fixes...`,
                )
            }
        } else if (event.type === "MAX_ITERATIONS_REACHED") {
            await this.transitionTo(CounterfluxState.PAUSED, "Maximum iterations reached. Waiting for user approval to continue.")
        }
    }

    private async handleCodeReviewState(event: CounterfluxEvent): Promise<void> {
        if (!this.context) return

        if (event.type === "REVIEW_APPROVED") {
            this.context.lastReviewFeedback = event.feedback
            await this.transitionTo(CounterfluxState.COMPLETED, "Code review passed!")
        } else if (event.type === "REVIEW_REJECTED") {
            this.context.lastReviewFeedback = event.feedback
            // QA found issues, go back to test writing to add more tests
            await this.transitionTo(CounterfluxState.TEST_WRITING, "Code review found issues. Writing additional tests...")
        }
    }

    private async handlePausedState(event: CounterfluxEvent): Promise<void> {
        if (event.type === "USER_CONTINUE" && this.context) {
            // Reset iteration count and continue
            this.context.iteration = 0
            await this.transitionTo(CounterfluxState.IMPLEMENTING, "Continuing implementation...")
        } else if (event.type === "USER_ABORT") {
            await this.transitionTo(CounterfluxState.IDLE, "Workflow aborted by user")
        }
    }

    // ==================== State Entry Actions ====================

    private async enterSpecCreation(): Promise<void> {
        if (!this.context) return

        // Switch to QA mode
        await this.callbacks.switchMode("counterflux-qa")

        // Send instruction to create spec
        const instruction = `
## Task: Create Specification Document

You are the QA Agent. Your task is to create a comprehensive specification document for the following user request:

**User Request:**
${this.context.originalPrompt}

**Instructions:**
1. Analyze the request carefully
2. Ask clarifying questions if needed
3. Create a file called \`SPEC.md\` in the workspace root
4. The spec should include:
   - Overview of the feature/task
   - Detailed requirements (functional and non-functional)
   - Edge cases to consider
   - Acceptance criteria
   - Any assumptions made

**IMPORTANT:** Do NOT write any code or tests yet. Focus only on the specification.

When you have created the SPEC.md file, respond with: "SPEC_CREATED: <path to SPEC.md>"
`
        await this.callbacks.sendMessage(instruction)
    }

    private async enterTestWriting(): Promise<void> {
        if (!this.context) return

        // Ensure we're in QA mode
        await this.callbacks.switchMode("counterflux-qa")

        // Read the spec if available
        let specContent = ""
        if (this.context.specPath) {
            try {
                specContent = await this.callbacks.readFile(this.context.specPath)
                this.context.specContent = specContent
            } catch {
                this.callbacks.log(`[Counterflux] Could not read spec file: ${this.context.specPath}`)
            }
        }

        const instruction = `
## Task: Write Failing Tests

You are the QA Agent. Your task is to write comprehensive failing tests based on the specification.

**Specification:**
${specContent || "No spec file found. Base tests on the original request."}

**Original Request:**
${this.context.originalPrompt}

**Instructions:**
1. Create test files in the appropriate test directory (\`__tests__/\`, \`tests/\`, or \`*.spec.ts\`)
2. Write tests that:
   - Cover all requirements in the spec
   - Include edge cases
   - Test error handling
   - Are failing (since implementation doesn't exist yet)
3. Use the existing test framework patterns in the codebase

**IMPORTANT:** Do NOT write implementation code. Only write tests.

When you have written the tests, respond with: "TESTS_WRITTEN: <comma-separated list of test file paths>"
`
        await this.callbacks.sendMessage(instruction)
    }

    private async enterImplementing(): Promise<void> {
        if (!this.context) return

        // Switch to Dev mode
        await this.callbacks.switchMode("counterflux-dev")

        // Get test result info if available
        let testInfo = ""
        if (this.context.lastTestResult) {
            testInfo = `
**Last Test Result:**
- Passed: ${this.context.lastTestResult.passedTests}/${this.context.lastTestResult.totalTests}
- Output: ${this.context.lastTestResult.output.substring(0, 500)}...
`
        }

        const instruction = `
## Task: Implement Code to Pass Tests

You are the Developer. Your task is to implement the code to make the failing tests pass.

**Specification:**
${this.context.specContent || "No spec file found. Base implementation on the test expectations."}

**Test Files:**
${this.context.testFiles.join("\n") || "Check the test directories for failing tests."}

${testInfo}

**Instructions:**
1. Read and understand the failing tests
2. Implement the minimum code necessary to make tests pass
3. Follow existing code patterns and conventions in the codebase
4. Do NOT modify the test files

**IMPORTANT:** You cannot modify test files. If you believe a test is broken, explain why.

When implementation is complete, respond with: "IMPLEMENTATION_DONE"
`
        await this.callbacks.sendMessage(instruction)
    }

    private async enterRunningTests(): Promise<void> {
        if (!this.context) return

        this.callbacks.log("[Counterflux] Running test suite...")

        try {
            // Try common test commands
            const testCommands = ["npm test", "pnpm test", "yarn test", "vitest run", "jest"]

            let result: { exitCode: number; output: string } | null = null

            for (const cmd of testCommands) {
                try {
                    result = await this.callbacks.executeCommand(cmd)
                    break
                } catch {
                    // Try next command
                }
            }

            if (result) {
                const testResult: TestResult = {
                    passed: result.exitCode === 0,
                    totalTests: 0, // Would need to parse output
                    passedTests: 0,
                    failedTests: 0,
                    output: result.output,
                    timestamp: Date.now(),
                }

                if (result.exitCode === 0) {
                    await this.handleEvent({ type: "TESTS_PASSED", result: testResult })
                } else {
                    await this.handleEvent({ type: "TESTS_FAILED", result: testResult })
                }
            } else {
                await this.handleEvent({ type: "ERROR", message: "Could not run tests - no test command found" })
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            await this.handleEvent({ type: "ERROR", message: `Test execution failed: ${errorMessage}` })
        }
    }

    private async enterCodeReview(): Promise<void> {
        if (!this.context) return

        // Switch to QA mode for review
        await this.callbacks.switchMode("counterflux-qa")

        const instruction = `
## Task: Review Implementation

You are the QA Agent. Your task is to review the implementation and ensure it meets the specification.

**Specification:**
${this.context.specContent || "No spec file found."}

**Test Results:**
All tests are passing!

**Instructions:**
1. Review the implementation code
2. Check if it correctly implements the specification
3. Look for:
   - Missing edge case handling
   - Potential bugs
   - Code quality issues
   - Missing tests for important scenarios

**If the implementation is satisfactory:**
Respond with: "REVIEW_APPROVED"

**If you find issues:**
Respond with: "REVIEW_REJECTED: <list of issues found>"
`
        await this.callbacks.sendMessage(instruction)
    }

    /**
     * Run the main ping-pong loop. This is an alternative to event-driven workflow.
     */
    async runPingPongLoop(): Promise<void> {
        if (!this.context) {
            throw new Error("Context not initialized. Call start() first.")
        }

        this.callbacks.log("[Counterflux] Starting ping-pong loop")

        while (this.state !== CounterfluxState.COMPLETED && this.state !== CounterfluxState.ERROR) {
            // Wait for state to stabilize (would integrate with actual message handling)
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // Check for user abort
            if (this.state === CounterfluxState.PAUSED) {
                const shouldContinue = await this.callbacks.askApproval(
                    "Maximum iterations reached. Do you want to continue?",
                )
                if (shouldContinue) {
                    await this.handleEvent({ type: "USER_CONTINUE" })
                } else {
                    await this.handleEvent({ type: "USER_ABORT" })
                    break
                }
            }
        }

        this.callbacks.log(`[Counterflux] Loop ended in state: ${this.state}`)
    }

    /**
     * Abort the current workflow.
     */
    async abort(): Promise<void> {
        await this.handleEvent({ type: "USER_ABORT" })
    }

    /**
     * Reset the orchestrator to initial state.
     */
    reset(): void {
        this.state = CounterfluxState.IDLE
        this.context = null
    }
}
