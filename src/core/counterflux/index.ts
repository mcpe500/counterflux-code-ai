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
 */

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
