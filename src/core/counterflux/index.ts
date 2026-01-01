/**
 * Counterflux - Adversarial QA vs Developer Workflow
 *
 * This module provides the orchestration layer for the Counterflux workflow,
 * which coordinates between QA and Developer modes in a ping-pong fashion.
 *
 * Usage:
 * ```typescript
 * import { CounterfluxOrchestrator, CounterfluxState } from './core/counterflux'
 *
 * const orchestrator = new CounterfluxOrchestrator({
 *   switchMode: async (mode) => { ... },
 *   sendMessage: async (msg) => { ... },
 *   // ... other callbacks
 * })
 *
 * await orchestrator.start("Build a user authentication system", "/path/to/workspace")
 * ```
 *
 * For PARALLEL mode (Parralel):
 * ```typescript
 * import { ParralelOrchestrator, createParralelOrchestrator } from './core/counterflux'
 *
 * const parralelOrchestrator = createParralelOrchestrator(config, callbacks)
 * await parralelOrchestrator.startParralelMode("Build feature X")
 * ```
 */

// Sequential (turn-based) orchestration
export { CounterfluxOrchestrator, CounterfluxState, type CounterfluxEvent, type CounterfluxCallbacks } from "./CounterfluxOrchestrator"

export { type CounterfluxContext, type TestResult, type ReviewFeedback, createCounterfluxContext } from "./CounterfluxContext"

export {
    CounterfluxPromptInjector,
    detectTestFrameworks,
    detectProjectContext,
    detectUnknownFramework,
    generateQAContextInjection,
    generateDevContextInjection,
    generateSafetyValveInstructions,
    type TestFrameworkInfo,
    type ProjectContext,
    type Language,
    type TestType,
} from "./CounterfluxPromptInjector"

// Parallel (Parralel) mode orchestration
export {
    ParralelOrchestrator,
    createParralelOrchestrator,
    type ParralelOrchestratorConfig,
    type ParralelOrchestratorCallbacks,
    type ParralelOrchestratorStatus,
} from "./ParralelOrchestrator"

export {
    AgentSession,
    createAgentSession,
    type AgentRole,
    type AgentSessionStatus,
    type AgentSessionConfig,
    type AgentAction,
    type AgentActionType,
    type AgentMessage,
    type ToolResult,
} from "./AgentSession"

export {
    ParralelContextManager,
    createParralelContext,
    type ParralelContext,
    type ParralelTestResult,
    type SpecStatus,
    type ImplementationStatus,
} from "./ParralelContext"

