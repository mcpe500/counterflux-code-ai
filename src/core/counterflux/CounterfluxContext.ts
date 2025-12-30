/**
 * CounterfluxContext
 *
 * Context object that holds state across the adversarial QA vs Developer workflow.
 * This is passed between states and contains all necessary information for each phase.
 */

/**
 * Test result summary from running the test suite.
 */
export interface TestResult {
    passed: boolean
    totalTests: number
    passedTests: number
    failedTests: number
    output: string
    timestamp: number
}

/**
 * Code review feedback from QA.
 */
export interface ReviewFeedback {
    approved: boolean
    issues: string[]
    suggestions: string[]
    timestamp: number
}

/**
 * Context object for the Counterflux orchestrator workflow.
 */
export interface CounterfluxContext {
    /** Original user prompt/task description */
    originalPrompt: string

    /** Path to the generated SPEC.md file */
    specPath?: string

    /** Content of the spec document */
    specContent?: string

    /** Whether the spec has been frozen (approved by user) */
    specFrozen: boolean

    /** Current iteration of the ping-pong loop */
    iteration: number

    /** Maximum iterations before asking user to continue */
    maxIterations: number

    /** List of test files created by QA */
    testFiles: string[]

    /** Most recent test result */
    lastTestResult?: TestResult

    /** Most recent review feedback */
    lastReviewFeedback?: ReviewFeedback

    /** Workspace root path */
    workspacePath: string

    /** Timestamp when workflow started */
    startTime: number

    /** Current phase description for user feedback */
    currentPhaseDescription: string
}

/**
 * Create a new CounterfluxContext with default values.
 */
export function createCounterfluxContext(
    originalPrompt: string,
    workspacePath: string,
    maxIterations: number = 10,
): CounterfluxContext {
    return {
        originalPrompt,
        specFrozen: false,
        iteration: 0,
        maxIterations,
        testFiles: [],
        workspacePath,
        startTime: Date.now(),
        currentPhaseDescription: "Initializing Counterflux workflow",
    }
}
