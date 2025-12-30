/**
 * CounterfluxPromptInjector
 *
 * Dynamically injects context into prompts for QA and Dev modes to enforce best practices.
 * This ensures both agents follow the project's existing patterns and test frameworks.
 * 
 * Supports detection for:
 * - JavaScript/TypeScript: Jest, Vitest, Mocha, Jasmine, Playwright, Cypress
 * - Python: Pytest, Unittest, Nose
 * - PHP: PHPUnit, Pest, Laravel Dusk
 * - Ruby: RSpec, Minitest, Rails test
 * - Go: go test
 * - Rust: cargo test
 * - C/C++: Google Test, Catch2, doctest, CTest
 * - Java: JUnit, TestNG
 * - C#/.NET: xUnit, NUnit, MSTest
 * - Generic: Pattern-based detection for unknown frameworks
 */

import * as path from "path"
import * as fs from "fs/promises"

/**
 * Supported programming languages.
 */
export type Language =
    | "javascript" | "typescript"
    | "python"
    | "php"
    | "ruby"
    | "go"
    | "rust"
    | "cpp" | "c"
    | "java"
    | "csharp"
    | "unknown"

/**
 * Test type classification.
 */
export type TestType = "unit" | "integration" | "e2e" | "frontend" | "backend" | "unknown"

/**
 * Detected test framework information.
 */
export interface TestFrameworkInfo {
    name: string
    language: Language
    testType: TestType
    configFile?: string
    testCommand?: string
    testDirectory?: string
    testFilePatterns?: string[]
    helperFiles?: string[]
    runnerInstallCommand?: string
}

/**
 * Project context for prompt injection.
 */
export interface ProjectContext {
    primaryLanguage: Language
    testFrameworks: TestFrameworkInfo[]
    existingTestPatterns?: string[]
    discoveredByHeuristics: boolean
}

/**
 * Framework detection rules for each language.
 */
interface FrameworkRule {
    name: string
    language: Language
    testType: TestType
    indicators: {
        packageJson?: string[] // npm/yarn packages
        devDeps?: string[] // devDependencies
        files?: string[] // config files
        directories?: string[] // directory patterns
        fileContent?: { file: string; pattern: string }[] // content patterns
    }
    testCommand?: string
    testFilePatterns: string[]
    installCommand?: string
}

/**
 * All supported framework detection rules.
 */
const FRAMEWORK_RULES: FrameworkRule[] = [
    // ==================== JavaScript/TypeScript ====================
    {
        name: "vitest",
        language: "typescript",
        testType: "unit",
        indicators: {
            devDeps: ["vitest", "@vitest/ui"],
            files: ["vitest.config.ts", "vitest.config.js", "vitest.config.mts"],
        },
        testCommand: "vitest run",
        testFilePatterns: ["*.test.ts", "*.test.tsx", "*.spec.ts", "*.spec.tsx"],
        installCommand: "npm install -D vitest",
    },
    {
        name: "jest",
        language: "typescript",
        testType: "unit",
        indicators: {
            devDeps: ["jest", "@types/jest", "ts-jest"],
            files: ["jest.config.ts", "jest.config.js", "jest.config.json"],
        },
        testCommand: "jest",
        testFilePatterns: ["*.test.ts", "*.test.tsx", "*.test.js", "*.test.jsx"],
        installCommand: "npm install -D jest @types/jest",
    },
    {
        name: "mocha",
        language: "javascript",
        testType: "unit",
        indicators: {
            devDeps: ["mocha", "@types/mocha"],
            files: [".mocharc.js", ".mocharc.json", ".mocharc.yaml"],
        },
        testCommand: "mocha",
        testFilePatterns: ["*.test.js", "*.spec.js"],
        installCommand: "npm install -D mocha chai",
    },
    {
        name: "playwright",
        language: "typescript",
        testType: "e2e",
        indicators: {
            devDeps: ["@playwright/test", "playwright"],
            files: ["playwright.config.ts", "playwright.config.js"],
        },
        testCommand: "npx playwright test",
        testFilePatterns: ["*.spec.ts", "*.e2e.ts"],
        installCommand: "npm init playwright@latest",
    },
    {
        name: "cypress",
        language: "typescript",
        testType: "e2e",
        indicators: {
            devDeps: ["cypress"],
            files: ["cypress.config.ts", "cypress.config.js"],
            directories: ["cypress/e2e", "cypress/integration"],
        },
        testCommand: "npx cypress run",
        testFilePatterns: ["*.cy.ts", "*.cy.js", "*.spec.ts"],
        installCommand: "npm install -D cypress",
    },
    // ==================== Python ====================
    {
        name: "pytest",
        language: "python",
        testType: "unit",
        indicators: {
            files: ["pytest.ini", "pyproject.toml", "setup.cfg", "conftest.py"],
            fileContent: [
                { file: "requirements.txt", pattern: "pytest" },
                { file: "pyproject.toml", pattern: "[tool.pytest" },
            ],
        },
        testCommand: "pytest",
        testFilePatterns: ["test_*.py", "*_test.py"],
        installCommand: "pip install pytest",
    },
    {
        name: "unittest",
        language: "python",
        testType: "unit",
        indicators: {
            fileContent: [{ file: "*.py", pattern: "import unittest" }],
        },
        testCommand: "python -m unittest discover",
        testFilePatterns: ["test_*.py"],
    },
    // ==================== PHP ====================
    {
        name: "phpunit",
        language: "php",
        testType: "unit",
        indicators: {
            files: ["phpunit.xml", "phpunit.xml.dist"],
            fileContent: [{ file: "composer.json", pattern: "phpunit/phpunit" }],
        },
        testCommand: "vendor/bin/phpunit",
        testFilePatterns: ["*Test.php", "*_test.php"],
        installCommand: "composer require --dev phpunit/phpunit",
    },
    {
        name: "pest",
        language: "php",
        testType: "unit",
        indicators: {
            fileContent: [{ file: "composer.json", pattern: "pestphp/pest" }],
        },
        testCommand: "vendor/bin/pest",
        testFilePatterns: ["*Test.php", "*.pest.php"],
        installCommand: "composer require --dev pestphp/pest",
    },
    {
        name: "laravel-dusk",
        language: "php",
        testType: "e2e",
        indicators: {
            directories: ["tests/Browser"],
            fileContent: [{ file: "composer.json", pattern: "laravel/dusk" }],
        },
        testCommand: "php artisan dusk",
        testFilePatterns: ["*Test.php"],
        installCommand: "composer require --dev laravel/dusk",
    },
    // ==================== Ruby ====================
    {
        name: "rspec",
        language: "ruby",
        testType: "unit",
        indicators: {
            files: [".rspec", "spec/spec_helper.rb"],
            directories: ["spec"],
            fileContent: [{ file: "Gemfile", pattern: "rspec" }],
        },
        testCommand: "bundle exec rspec",
        testFilePatterns: ["*_spec.rb"],
        installCommand: "bundle add rspec --group development,test",
    },
    {
        name: "minitest",
        language: "ruby",
        testType: "unit",
        indicators: {
            directories: ["test"],
            fileContent: [{ file: "Gemfile", pattern: "minitest" }],
        },
        testCommand: "rake test",
        testFilePatterns: ["*_test.rb", "test_*.rb"],
    },
    {
        name: "rails-test",
        language: "ruby",
        testType: "integration",
        indicators: {
            files: ["config/application.rb"],
            directories: ["test/controllers", "test/models"],
        },
        testCommand: "rails test",
        testFilePatterns: ["*_test.rb"],
    },
    // ==================== Go ====================
    {
        name: "go-test",
        language: "go",
        testType: "unit",
        indicators: {
            files: ["go.mod"],
        },
        testCommand: "go test ./...",
        testFilePatterns: ["*_test.go"],
    },
    // ==================== Rust ====================
    {
        name: "cargo-test",
        language: "rust",
        testType: "unit",
        indicators: {
            files: ["Cargo.toml"],
        },
        testCommand: "cargo test",
        testFilePatterns: ["*.rs"], // Tests are inline in Rust
    },
    // ==================== C/C++ ====================
    {
        name: "googletest",
        language: "cpp",
        testType: "unit",
        indicators: {
            files: ["CMakeLists.txt"],
            fileContent: [
                { file: "CMakeLists.txt", pattern: "gtest" },
                { file: "CMakeLists.txt", pattern: "GoogleTest" },
            ],
        },
        testCommand: "ctest --output-on-failure",
        testFilePatterns: ["*_test.cpp", "*_test.cc", "test_*.cpp"],
    },
    {
        name: "catch2",
        language: "cpp",
        testType: "unit",
        indicators: {
            fileContent: [
                { file: "CMakeLists.txt", pattern: "Catch2" },
                { file: "*.cpp", pattern: "#include.*catch" },
            ],
        },
        testCommand: "ctest --output-on-failure",
        testFilePatterns: ["*_test.cpp", "test_*.cpp"],
    },
    // ==================== Java ====================
    {
        name: "junit",
        language: "java",
        testType: "unit",
        indicators: {
            files: ["pom.xml", "build.gradle", "build.gradle.kts"],
            directories: ["src/test/java"],
            fileContent: [{ file: "pom.xml", pattern: "junit" }],
        },
        testCommand: "mvn test",
        testFilePatterns: ["*Test.java", "*Tests.java"],
    },
    // ==================== C#/.NET ====================
    {
        name: "xunit",
        language: "csharp",
        testType: "unit",
        indicators: {
            files: ["*.csproj"],
            fileContent: [{ file: "*.csproj", pattern: "xunit" }],
        },
        testCommand: "dotnet test",
        testFilePatterns: ["*Tests.cs", "*Test.cs"],
    },
    {
        name: "nunit",
        language: "csharp",
        testType: "unit",
        indicators: {
            fileContent: [{ file: "*.csproj", pattern: "NUnit" }],
        },
        testCommand: "dotnet test",
        testFilePatterns: ["*Tests.cs", "*Test.cs"],
    },
]

/**
 * Detect the test frameworks used in the project.
 */
export async function detectTestFrameworks(workspacePath: string): Promise<TestFrameworkInfo[]> {
    const detectedFrameworks: TestFrameworkInfo[] = []

    // First, try to detect from package.json (JavaScript/TypeScript)
    const jsFrameworks = await detectJSFrameworks(workspacePath)
    detectedFrameworks.push(...jsFrameworks)

    // Check for each framework rule
    for (const rule of FRAMEWORK_RULES) {
        if (detectedFrameworks.some(f => f.name === rule.name)) {
            continue // Already detected
        }

        const detected = await checkFrameworkRule(workspacePath, rule)
        if (detected) {
            detectedFrameworks.push({
                name: rule.name,
                language: rule.language,
                testType: rule.testType,
                testCommand: rule.testCommand,
                testFilePatterns: rule.testFilePatterns,
                runnerInstallCommand: rule.installCommand,
                testDirectory: await findTestDirectory(workspacePath, rule.language),
            })
        }
    }

    return detectedFrameworks
}

/**
 * Generic/heuristic-based detection for unknown frameworks.
 */
export async function detectUnknownFramework(workspacePath: string): Promise<TestFrameworkInfo | undefined> {
    // Look for common test directory patterns
    const testDirs = ["tests", "test", "__tests__", "spec", "specs", "t", "unittest"]
    let foundTestDir: string | undefined

    for (const dir of testDirs) {
        const fullPath = path.join(workspacePath, dir)
        if (await directoryExists(fullPath)) {
            foundTestDir = dir
            break
        }
    }

    if (!foundTestDir) {
        return undefined
    }

    // Analyze files in test directory to guess language
    const testDirPath = path.join(workspacePath, foundTestDir)
    const files = await fs.readdir(testDirPath).catch(() => [])

    let language: Language = "unknown"
    const extensions: { [key: string]: Language } = {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".rb": "ruby",
        ".php": "php",
        ".go": "go",
        ".rs": "rust",
        ".cpp": "cpp",
        ".cc": "cpp",
        ".java": "java",
        ".cs": "csharp",
    }

    for (const file of files) {
        const ext = path.extname(file)
        if (extensions[ext]) {
            language = extensions[ext]
            break
        }
    }

    // Try to find test command from common scripts
    const testCommand = await findTestCommand(workspacePath, language)

    return {
        name: "unknown",
        language,
        testType: "unknown",
        testDirectory: foundTestDir,
        testCommand,
        testFilePatterns: files.length > 0 ? [path.extname(files[0]) + "*test*"] : undefined,
    }
}

/**
 * Detect all project context including frameworks and heuristics.
 */
export async function detectProjectContext(workspacePath: string): Promise<ProjectContext> {
    const frameworks = await detectTestFrameworks(workspacePath)
    let discoveredByHeuristics = false

    // If no frameworks found, try heuristic detection
    if (frameworks.length === 0) {
        const unknownFramework = await detectUnknownFramework(workspacePath)
        if (unknownFramework) {
            frameworks.push(unknownFramework)
            discoveredByHeuristics = true
        }
    }

    // Determine primary language
    const primaryLanguage = frameworks.length > 0
        ? frameworks[0].language
        : await detectPrimaryLanguage(workspacePath)

    // Find test helpers
    for (const framework of frameworks) {
        if (framework.testDirectory) {
            framework.helperFiles = await findTestHelpers(workspacePath, framework.testDirectory)
        }
    }

    return {
        primaryLanguage,
        testFrameworks: frameworks,
        discoveredByHeuristics,
    }
}

/**
 * Generate context injection for QA mode.
 */
export function generateQAContextInjection(context: ProjectContext): string {
    const lines: string[] = []

    lines.push("\n\n## Counterflux QA Context\n")

    if (context.testFrameworks.length > 0) {
        lines.push("**Detected Test Frameworks:**")
        for (const framework of context.testFrameworks) {
            lines.push(`- **${framework.name}** (${framework.language}, ${framework.testType})`)
            if (framework.testCommand) {
                lines.push(`  - Test command: \`${framework.testCommand}\``)
            }
            if (framework.testDirectory) {
                lines.push(`  - Test directory: \`${framework.testDirectory}\``)
            }
            if (framework.testFilePatterns && framework.testFilePatterns.length > 0) {
                lines.push(`  - File patterns: ${framework.testFilePatterns.map(p => `\`${p}\``).join(", ")}`)
            }
        }
    } else {
        lines.push("**No test framework detected.** You should:")
        lines.push("1. Check if there's a `test/` or `tests/` directory")
        lines.push("2. Look at existing test files to understand the pattern")
        lines.push("3. Ask the user what test framework to use")
    }

    if (context.discoveredByHeuristics) {
        lines.push("\n> **Note:** Framework was detected heuristically. Verify with the codebase.")
    }

    lines.push(`
**Best Practices:**
1. **BEFORE** writing ANY test, analyze existing tests in the codebase to match style.
2. Do NOT invent new test frameworks - use what the project already uses.
3. If no framework exists, ASK the user which one to use.
4. Use existing test helpers, fixtures, and utilities.
5. Match the existing test file naming conventions exactly.
6. Write tests that are specific and WILL FAIL without the implementation.
`)

    return lines.join("\n")
}

/**
 * Generate context injection for Dev mode.
 */
export function generateDevContextInjection(
    context: ProjectContext,
    specFile?: string,
    testFiles?: string[]
): string {
    const lines: string[] = []

    lines.push("\n\n## Counterflux Dev Context\n")

    if (specFile) {
        lines.push(`**Specification:** You must satisfy the requirements in \`${specFile}\`.`)
    }

    if (testFiles && testFiles.length > 0) {
        lines.push(`**Tests to Pass:**`)
        for (const testFile of testFiles) {
            lines.push(`  - \`${testFile}\``)
        }
        lines.push(`\n**⚠️ CRITICAL:** Do NOT modify the test files. If you believe a test is broken, explain why and ask for approval.`)
    }

    if (context.testFrameworks.length > 0) {
        const framework = context.testFrameworks[0]
        lines.push(`\n**Run Tests:** \`${framework.testCommand || "Check package.json or project docs"}\``)
    }

    lines.push(`
**Best Practices:**
1. Read and understand the failing tests BEFORE implementing.
2. Follow existing code patterns and conventions in the codebase.
3. Import from existing modules rather than creating duplicate code.
4. Implement the MINIMUM code necessary to pass the tests.
5. Run the test suite after each significant change.
6. If a test seems wrong, explain why - do NOT silently "fix" it.
`)

    return lines.join("\n")
}

/**
 * Generate safety valve instructions for the orchestrator.
 */
export function generateSafetyValveInstructions(iteration: number, maxIterations: number): string {
    if (iteration >= maxIterations) {
        return `
## ⚠️ Safety Valve Triggered

The QA and Dev agents have been in a loop for **${iteration} iterations** without all tests passing.

**Action Required:** PAUSE and ask the user:

"The agents are stuck in a loop. Please review:
- **Failing tests:** [list current failures]
- **Dev's approach:** [summarize last attempt]
- **QA's concerns:** [summarize issues]

**What would you like to do?**
1. Continue with Dev's current approach
2. Simplify the requirements  
3. Provide additional guidance
4. Abort and rethink the task"
`
    }

    return ""
}

// ==================== Helper Functions ====================

async function detectJSFrameworks(workspacePath: string): Promise<TestFrameworkInfo[]> {
    const frameworks: TestFrameworkInfo[] = []

    try {
        const packageJsonPath = path.join(workspacePath, "package.json")
        const content = await fs.readFile(packageJsonPath, "utf-8")
        const packageJson = JSON.parse(content)
        const devDeps = packageJson.devDependencies || {}
        const scripts = packageJson.scripts || {}

        for (const rule of FRAMEWORK_RULES) {
            if (rule.language !== "javascript" && rule.language !== "typescript") continue
            if (!rule.indicators.devDeps) continue

            const hasPackage = rule.indicators.devDeps.some(pkg => devDeps[pkg])
            if (hasPackage) {
                frameworks.push({
                    name: rule.name,
                    language: rule.language,
                    testType: rule.testType,
                    testCommand: scripts.test || rule.testCommand,
                    testFilePatterns: rule.testFilePatterns,
                    testDirectory: await findTestDirectory(workspacePath, rule.language),
                    runnerInstallCommand: rule.installCommand,
                })
            }
        }
    } catch {
        // No package.json or parse error
    }

    return frameworks
}

async function checkFrameworkRule(workspacePath: string, rule: FrameworkRule): Promise<boolean> {
    const indicators = rule.indicators

    // Check for config files
    if (indicators.files) {
        for (const file of indicators.files) {
            if (await fileExists(path.join(workspacePath, file))) {
                return true
            }
        }
    }

    // Check for directories
    if (indicators.directories) {
        for (const dir of indicators.directories) {
            if (await directoryExists(path.join(workspacePath, dir))) {
                return true
            }
        }
    }

    // Check file content patterns
    if (indicators.fileContent) {
        for (const check of indicators.fileContent) {
            const filePath = path.join(workspacePath, check.file)
            try {
                const content = await fs.readFile(filePath, "utf-8")
                if (content.includes(check.pattern)) {
                    return true
                }
            } catch {
                // File doesn't exist
            }
        }
    }

    return false
}

async function findTestDirectory(workspacePath: string, language: Language): Promise<string | undefined> {
    const languageDirs: { [key: string]: string[] } = {
        typescript: ["__tests__", "tests", "test", "src/__tests__", "spec"],
        javascript: ["__tests__", "tests", "test", "spec"],
        python: ["tests", "test", "pytest"],
        php: ["tests", "Tests"],
        ruby: ["spec", "test"],
        go: ["."], // Go tests are alongside code
        rust: ["tests", "src"], // Rust uses inline tests
        cpp: ["tests", "test", "unittest"],
        java: ["src/test/java"],
        csharp: ["Tests", "tests"],
        unknown: ["tests", "test", "__tests__", "spec"],
    }

    const candidates = languageDirs[language] || languageDirs.unknown
    for (const candidate of candidates) {
        if (await directoryExists(path.join(workspacePath, candidate))) {
            return candidate
        }
    }
    return undefined
}

async function findTestHelpers(workspacePath: string, testDir: string): Promise<string[]> {
    const helpers: string[] = []
    const fullPath = path.join(workspacePath, testDir)

    try {
        const files = await fs.readdir(fullPath)
        for (const file of files) {
            const lower = file.toLowerCase()
            if (
                lower.includes("helper") ||
                lower.includes("utils") ||
                lower.includes("fixture") ||
                lower.includes("setup") ||
                lower.includes("conftest") ||
                lower.includes("spec_helper") ||
                lower.includes("test_helper") ||
                lower.startsWith("_")
            ) {
                helpers.push(path.join(testDir, file))
            }
        }
    } catch {
        // Directory doesn't exist
    }

    return helpers
}

async function findTestCommand(workspacePath: string, language: Language): Promise<string | undefined> {
    // Try to find test command from various sources
    const commands: { [key: string]: { file: string; pattern: RegExp; extract: (m: RegExpMatchArray) => string }[] } = {
        javascript: [
            { file: "package.json", pattern: /"test":\s*"([^"]+)"/, extract: (m) => m[1] },
        ],
        python: [
            { file: "pyproject.toml", pattern: /test\s*=\s*"([^"]+)"/, extract: (m) => m[1] },
        ],
        php: [
            { file: "composer.json", pattern: /"test":\s*"([^"]+)"/, extract: (m) => m[1] },
        ],
        ruby: [
            { file: "Rakefile", pattern: /task\s+:test/, extract: () => "rake test" },
        ],
    }

    const checks = commands[language] || []
    for (const check of checks) {
        try {
            const content = await fs.readFile(path.join(workspacePath, check.file), "utf-8")
            const match = content.match(check.pattern)
            if (match) {
                return check.extract(match)
            }
        } catch {
            // File doesn't exist
        }
    }

    return undefined
}

async function detectPrimaryLanguage(workspacePath: string): Promise<Language> {
    const indicators: { file: string; language: Language }[] = [
        { file: "package.json", language: "typescript" },
        { file: "tsconfig.json", language: "typescript" },
        { file: "requirements.txt", language: "python" },
        { file: "pyproject.toml", language: "python" },
        { file: "composer.json", language: "php" },
        { file: "Gemfile", language: "ruby" },
        { file: "go.mod", language: "go" },
        { file: "Cargo.toml", language: "rust" },
        { file: "CMakeLists.txt", language: "cpp" },
        { file: "pom.xml", language: "java" },
        { file: "build.gradle", language: "java" },
    ]

    for (const { file, language } of indicators) {
        if (await fileExists(path.join(workspacePath, file))) {
            return language
        }
    }

    return "unknown"
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(filePath)
        return stat.isFile()
    } catch {
        return false
    }
}

async function directoryExists(dirPath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(dirPath)
        return stat.isDirectory()
    } catch {
        return false
    }
}

/**
 * Main class for injecting prompts based on mode and context.
 */
export class CounterfluxPromptInjector {
    private workspacePath: string
    private projectContext?: ProjectContext
    private initialized: boolean = false

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath
    }

    /**
     * Initialize the injector by analyzing the project.
     */
    async initialize(): Promise<void> {
        this.projectContext = await detectProjectContext(this.workspacePath)
        this.initialized = true
    }

    /**
     * Get context injection for the specified mode.
     */
    getContextInjection(mode: "counterflux-qa" | "counterflux-dev", options?: {
        specFile?: string
        testFiles?: string[]
        iteration?: number
        maxIterations?: number
    }): string {
        if (!this.initialized || !this.projectContext) {
            return ""
        }

        let injection = ""

        if (mode === "counterflux-qa") {
            injection = generateQAContextInjection(this.projectContext)
        } else if (mode === "counterflux-dev") {
            injection = generateDevContextInjection(
                this.projectContext,
                options?.specFile,
                options?.testFiles,
            )
        }

        // Add safety valve if iterations are high
        if (options?.iteration && options?.maxIterations) {
            injection += generateSafetyValveInstructions(options.iteration, options.maxIterations)
        }

        return injection
    }

    /**
     * Get the detected project context.
     */
    getProjectContext(): ProjectContext | undefined {
        return this.projectContext
    }

    /**
     * Get summary of detected frameworks for logging.
     */
    getDetectionSummary(): string {
        if (!this.projectContext) {
            return "Not initialized"
        }

        if (this.projectContext.testFrameworks.length === 0) {
            return "No test frameworks detected"
        }

        const frameworks = this.projectContext.testFrameworks
            .map(f => `${f.name} (${f.language})`)
            .join(", ")

        return `Detected: ${frameworks}${this.projectContext.discoveredByHeuristics ? " (heuristic)" : ""}`
    }
}
