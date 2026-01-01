import React, { useState, useCallback, useEffect, useRef } from 'react';
import { vscode } from '../../utils/vscode';

/**
 * CSS Variables matching VS Code theme
 */
const cssVars = {
    bgRoot: 'var(--vscode-editor-background)',
    bgSidebar: 'var(--vscode-sideBar-background)',
    bgActivity: 'var(--vscode-activityBar-background)',
    bgInput: 'var(--vscode-input-background)',
    borderLight: 'var(--vscode-widget-border)',
    borderFocus: 'var(--vscode-focusBorder)',
    textMain: 'var(--vscode-foreground)',
    textHeader: 'var(--vscode-editor-foreground)',
    textDim: 'var(--vscode-descriptionForeground)',
    accentQa: '#b5cea8',   // Soft Green for QA
    accentDev: '#9cdcfe',  // Soft Blue for Dev
    glowQa: 'rgba(181, 206, 168, 0.3)',
    glowDev: 'rgba(156, 220, 254, 0.3)',
};

/**
 * Log entry type for agent output
 */
interface LogEntry {
    id: string;
    time: string;
    type: 'system' | 'info' | 'success' | 'warn' | 'error';
    message: string;
    code?: string;
}

/**
 * Agent status
 */
type AgentStatus = 'IDLE' | 'PROCESSING';

/**
 * AdversarialStudioView - Main split-pane layout for parallel QA and Dev agents
 * Based on example-design.html reference
 */
export const AdversarialStudioView: React.FC<{ isHidden: boolean }> = ({ isHidden }) => {
    // Agent states
    const [qaStatus, setQaStatus] = useState<AgentStatus>('IDLE');
    const [devStatus, setDevStatus] = useState<AgentStatus>('IDLE');
    const [qaLogs, setQaLogs] = useState<LogEntry[]>([
        { id: '1', time: formatTime(), type: 'system', message: 'Waiting for instructions...' }
    ]);
    const [devLogs, setDevLogs] = useState<LogEntry[]>([
        { id: '1', time: formatTime(), type: 'system', message: 'Ready to implement features.' }
    ]);

    // Input state
    const [promptInput, setPromptInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    // Refs for auto-scroll
    const qaLogsRef = useRef<HTMLDivElement>(null);
    const devLogsRef = useRef<HTMLDivElement>(null);

    // Detect @mentions
    const hasQaMention = promptInput.toLowerCase().includes('@qa');
    const hasDevMention = promptInput.toLowerCase().includes('@dev');

    // Listen for messages from the extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            switch (message.type) {
                case 'parralel:qa:log':
                    addLog('qa', message.logType || 'info', message.message, message.code);
                    break;
                case 'parralel:dev:log':
                    addLog('dev', message.logType || 'info', message.message, message.code);
                    break;
                case 'parralel:qa:status':
                    setQaStatus(message.status === 'thinking' || message.status === 'executing' ? 'PROCESSING' : 'IDLE');
                    break;
                case 'parralel:dev:status':
                    setDevStatus(message.status === 'thinking' || message.status === 'executing' ? 'PROCESSING' : 'IDLE');
                    break;
                case 'parralel:orchestrator:status':
                    setIsRunning(message.status === 'running');
                    if (message.status === 'idle') {
                        setQaStatus('IDLE');
                        setDevStatus('IDLE');
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        qaLogsRef.current?.scrollTo({ top: qaLogsRef.current.scrollHeight, behavior: 'smooth' });
    }, [qaLogs]);

    useEffect(() => {
        devLogsRef.current?.scrollTo({ top: devLogsRef.current.scrollHeight, behavior: 'smooth' });
    }, [devLogs]);

    // Add log entry
    const addLog = useCallback((agent: 'qa' | 'dev', type: LogEntry['type'], message: string, code?: string) => {
        const entry: LogEntry = {
            id: `${Date.now()}-${Math.random()}`,
            time: formatTime(),
            type,
            message,
            code,
        };

        if (agent === 'qa') {
            setQaLogs(prev => [...prev, entry]);
        } else {
            setDevLogs(prev => [...prev, entry]);
        }
    }, []);

    // Handle send
    const handleSend = useCallback(() => {
        const text = promptInput.trim();
        if (!text || isRunning) return;

        // Determine target(s)
        const runQa = hasQaMention || (!hasQaMention && !hasDevMention);
        const runDev = hasDevMention || (!hasQaMention && !hasDevMention);

        // Clean prompt (remove @mentions)
        const cleanPrompt = text.replace(/@qa/gi, '').replace(/@dev/gi, '').trim();

        // Add user message to logs
        if (runQa) {
            addLog('qa', 'info', `User: ${cleanPrompt}`);
            setQaStatus('PROCESSING');
        }
        if (runDev) {
            addLog('dev', 'info', `User: ${cleanPrompt}`);
            setDevStatus('PROCESSING');
        }

        // Send to extension
        vscode.postMessage({
            type: 'parralel:unified:send',
            prompt: cleanPrompt,
            targetQa: runQa,
            targetDev: runDev,
        });

        setPromptInput('');
        setIsRunning(true);
    }, [promptInput, isRunning, hasQaMention, hasDevMention, addLog]);

    // Handle mention chip click
    const toggleMention = useCallback((type: 'qa' | 'dev') => {
        const mention = type === 'qa' ? '@qa' : '@dev';
        if (promptInput.toLowerCase().includes(mention)) {
            setPromptInput(prev => prev.replace(new RegExp(mention, 'gi'), '').trim());
        } else {
            setPromptInput(prev => (prev ? `${prev} ${mention} ` : `${mention} `));
        }
    }, [promptInput]);

    // Handle back button
    const handleBack = useCallback(() => {
        vscode.postMessage({ type: 'switchTab', tab: 'chat' });
    }, []);

    if (isHidden) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: cssVars.bgRoot,
            color: cssVars.textMain,
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: '13px',
        }}>
            {/* Header */}
            <div style={{
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                borderBottom: `1px solid ${cssVars.borderLight}`,
                backgroundColor: cssVars.bgSidebar,
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={handleBack}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: cssVars.textDim,
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        title="Back to Chat"
                    >
                        <span className="codicon codicon-arrow-left" style={{ fontSize: '14px' }} />
                    </button>
                    <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: isRunning ? '#4ec9b0' : cssVars.textDim,
                        boxShadow: isRunning ? '0 0 8px #4ec9b0' : 'none',
                    }} />
                    <span style={{ color: cssVars.textHeader }}>COUNTERFLUX: ADVERSARIAL STUDIO</span>
                </div>
                <span style={{ color: cssVars.textDim }}>v1.0.0</span>
            </div>

            {/* Split View: The Agents */}
            <div style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
            }}>
                {/* QA Agent Pane */}
                <AgentPane
                    role="qa"
                    title="QA Agent"
                    status={qaStatus}
                    logs={qaLogs}
                    logsRef={qaLogsRef}
                    isActive={hasQaMention}
                    accentColor={cssVars.accentQa}
                    glowColor={cssVars.glowQa}
                />

                {/* Dev Agent Pane */}
                <AgentPane
                    role="dev"
                    title="Developer Agent"
                    status={devStatus}
                    logs={devLogs}
                    logsRef={devLogsRef}
                    isActive={hasDevMention}
                    accentColor={cssVars.accentDev}
                    glowColor={cssVars.glowDev}
                    isLast
                />
            </div>

            {/* Input Area */}
            <div style={{
                minHeight: '120px',
                borderTop: `1px solid ${cssVars.borderLight}`,
                backgroundColor: cssVars.bgSidebar,
                display: 'flex',
                flexDirection: 'column',
                padding: '10px',
            }}>
                <div style={{
                    flex: 1,
                    backgroundColor: cssVars.bgInput,
                    border: `1px solid ${cssVars.borderLight}`,
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* Mentions Bar */}
                    <div style={{
                        height: '24px',
                        background: 'rgba(0,0,0,0.2)',
                        borderBottom: `1px solid ${cssVars.borderLight}`,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        gap: '10px',
                        fontSize: '11px',
                    }}>
                        <span style={{ color: cssVars.textDim }}>Direct to:</span>
                        <MentionChip
                            label="@qa"
                            isActive={hasQaMention}
                            accentColor={cssVars.accentQa}
                            glowColor={cssVars.glowQa}
                            onClick={() => toggleMention('qa')}
                        />
                        <MentionChip
                            label="@dev"
                            isActive={hasDevMention}
                            accentColor={cssVars.accentDev}
                            glowColor={cssVars.glowDev}
                            onClick={() => toggleMention('dev')}
                        />
                    </div>

                    {/* Prompt Input */}
                    <textarea
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type instructions. Use '@qa' for testing or '@dev' for coding..."
                        spellCheck={false}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: cssVars.textMain,
                            padding: '8px 12px',
                            fontFamily: 'inherit',
                            fontSize: '13px',
                            resize: 'none',
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Action Bar */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingTop: '8px',
                }}>
                    <button
                        onClick={handleSend}
                        disabled={!promptInput.trim() || (qaStatus === 'PROCESSING' && devStatus === 'PROCESSING')}
                        style={{
                            background: promptInput.trim() ? cssVars.borderFocus : cssVars.bgActivity,
                            color: promptInput.trim() ? 'white' : cssVars.textDim,
                            border: 'none',
                            padding: '6px 16px',
                            fontSize: '12px',
                            borderRadius: '2px',
                            cursor: promptInput.trim() ? 'pointer' : 'not-allowed',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        <span className="codicon codicon-send" style={{ fontSize: '12px' }} />
                        Run Loop
                    </button>
                </div>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

/**
 * Agent Pane Component
 */
interface AgentPaneProps {
    role: 'qa' | 'dev';
    title: string;
    status: AgentStatus;
    logs: LogEntry[];
    logsRef: React.RefObject<HTMLDivElement>;
    isActive: boolean;
    accentColor: string;
    glowColor: string;
    isLast?: boolean;
}

const AgentPane: React.FC<AgentPaneProps> = ({
    role,
    title,
    status,
    logs,
    logsRef,
    isActive,
    accentColor,
    glowColor,
    isLast,
}) => {
    const isQa = role === 'qa';

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: isLast ? 'none' : `1px solid ${cssVars.borderLight}`,
            backgroundColor: isActive ? `${glowColor}10` : cssVars.bgRoot,
            boxShadow: isActive ? `inset ${isQa ? '2px' : '-2px'} 0 0 ${accentColor}` : 'none',
            transition: 'background-color 0.3s ease',
        }}>
            {/* Pane Header */}
            <div style={{
                padding: '8px 16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: cssVars.bgSidebar,
                borderBottom: `1px solid ${cssVars.borderLight}`,
                color: accentColor,
            }}>
                {isQa ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                    </svg>
                )}
                {title}
                <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    background: status === 'PROCESSING' ? cssVars.borderFocus : cssVars.bgActivity,
                    color: status === 'PROCESSING' ? 'white' : cssVars.textDim,
                    fontWeight: 'normal',
                }}>
                    {status}
                </span>
            </div>

            {/* Pane Content (Logs) */}
            <div
                ref={logsRef}
                style={{
                    flex: 1,
                    padding: '16px',
                    overflowY: 'auto',
                    fontFamily: "'Consolas', 'Courier New', monospace",
                    fontSize: '12px',
                    lineHeight: 1.6,
                }}
            >
                {logs.map((log) => (
                    <LogEntryRow key={log.id} log={log} />
                ))}
            </div>
        </div>
    );
};

/**
 * Log Entry Row Component
 */
const LogEntryRow: React.FC<{ log: LogEntry }> = ({ log }) => {
    const typeColors: Record<LogEntry['type'], string> = {
        system: cssVars.textDim,
        info: '#9cdcfe',
        success: '#b5cea8',
        warn: '#dcdcaa',
        error: '#f14c4c',
    };

    return (
        <div style={{
            marginBottom: '12px',
            display: 'flex',
            gap: '10px',
            animation: 'fadeIn 0.3s forwards',
        }}>
            <span style={{ color: cssVars.textDim, userSelect: 'none' }}>[{log.time}]</span>
            <div style={{ flex: 1 }}>
                <span style={{ color: typeColors[log.type], whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {log.message}
                </span>
                {log.code && (
                    <code style={{
                        display: 'block',
                        marginTop: '4px',
                        padding: '8px',
                        background: '#101010',
                        border: '1px solid #333',
                        borderRadius: '3px',
                        color: '#d4d4d4',
                        fontSize: '11px',
                        whiteSpace: 'pre-wrap',
                    }}>
                        {log.code}
                    </code>
                )}
            </div>
        </div>
    );
};

/**
 * Mention Chip Component
 */
interface MentionChipProps {
    label: string;
    isActive: boolean;
    accentColor: string;
    glowColor: string;
    onClick: () => void;
}

const MentionChip: React.FC<MentionChipProps> = ({ label, isActive, accentColor, glowColor, onClick }) => (
    <div
        onClick={onClick}
        style={{
            padding: '2px 6px',
            borderRadius: '3px',
            cursor: 'pointer',
            opacity: isActive ? 1 : 0.5,
            transition: 'all 0.2s',
            background: isActive ? glowColor : 'transparent',
            color: isActive ? accentColor : cssVars.textDim,
            border: isActive ? `1px solid ${accentColor}` : '1px solid transparent',
            fontWeight: isActive ? 'bold' : 'normal',
        }}
    >
        {label}
    </div>
);

/**
 * Format current time as HH:MM:SS
 */
function formatTime(): string {
    return new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export default AdversarialStudioView;
