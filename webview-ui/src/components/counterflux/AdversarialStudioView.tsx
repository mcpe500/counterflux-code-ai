import React, { useState, useCallback, useEffect, useRef } from 'react';
import { vscode } from '../../utils/vscode';

/**
 * CSS Variables matching the new high-contrast dark theme
 */
const cssVars = {
    bgBody: '#121212',
    bgPanel: '#1e1e1e',
    bgHeader: '#252526',
    bgInput: '#2d2d2d',
    borderSubtle: '#333333',
    borderActive: '#444444',
    textMain: '#e0e0e0',
    textDim: '#888888',
    // Neon accent colors
    colorQa: '#00ff9d',   // Neon Green
    colorDev: '#00d2ff',  // Neon Cyan
    glowQa: 'rgba(0, 255, 157, 0.15)',
    glowDev: 'rgba(0, 210, 255, 0.15)',
};

/**
 * Log entry type for agent output
 */
interface LogEntry {
    id: string;
    time: string;
    type: 'system' | 'info' | 'success' | 'cmd' | 'error';
    message: string;
    code?: string;
}

/**
 * Agent status
 */
type AgentStatus = 'IDLE' | 'PROCESSING';

/**
 * AdversarialStudioView - High contrast responsive split-pane layout
 * Based on example-design.html v2.0
 */
export const AdversarialStudioView: React.FC<{ isHidden: boolean }> = ({ isHidden }) => {
    // Agent states
    const [qaStatus, setQaStatus] = useState<AgentStatus>('IDLE');
    const [devStatus, setDevStatus] = useState<AgentStatus>('IDLE');
    const [qaLogs, setQaLogs] = useState<LogEntry[]>([
        { id: '1', time: formatTime(), type: 'system', message: 'System ready. Waiting for test specs.' }
    ]);
    const [devLogs, setDevLogs] = useState<LogEntry[]>([
        { id: '1', time: formatTime(), type: 'system', message: 'Environment loaded. Ready to code.' }
    ]);

    // Panel collapse states
    const [qaCollapsed, setQaCollapsed] = useState(false);
    const [devCollapsed, setDevCollapsed] = useState(false);

    // Input state
    const [promptInput, setPromptInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

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
                    setIsProcessing(message.status === 'running');
                    if (message.status === 'idle') {
                        setQaStatus('IDLE');
                        setDevStatus('IDLE');
                    }
                    break;

                // Also listen for regular clineMessage updates to show AI progress here!
                case 'clineMessage':
                    if (message.clineMessage) {
                        const msg = message.clineMessage;
                        // Show assistant messages in both panels as they come in
                        if (msg.type === 'say' && msg.say === 'text') {
                            const text = msg.text || '';
                            const preview = text.length > 200 ? text.substring(0, 200) + '...' : text;
                            addLog('qa', 'info', `AI: ${preview}`);
                            addLog('dev', 'info', `AI: ${preview}`);
                            setQaStatus('PROCESSING');
                            setDevStatus('PROCESSING');
                        } else if (msg.type === 'say' && msg.say === 'tool') {
                            addLog('dev', 'cmd', `> Tool: ${msg.text?.substring(0, 100) || 'executing...'}`);
                            setDevStatus('PROCESSING');
                        } else if (msg.type === 'say' && msg.say === 'completion_result') {
                            addLog('qa', 'success', 'Task completed!');
                            addLog('dev', 'success', 'Task completed!');
                            setQaStatus('IDLE');
                            setDevStatus('IDLE');
                            setIsProcessing(false);
                        }
                    }
                    break;

                // Also listen for streaming partial updates
                case 'partialMessage':
                    if (message.partialMessage) {
                        // Show that AI is actively working
                        setQaStatus('PROCESSING');
                        setDevStatus('PROCESSING');
                        setIsProcessing(true);
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
            if (qaCollapsed) setQaCollapsed(false);
        } else {
            setDevLogs(prev => [...prev, entry]);
            if (devCollapsed) setDevCollapsed(false);
        }
    }, [qaCollapsed, devCollapsed]);

    // Handle send
    const handleSend = useCallback(() => {
        const text = promptInput.trim();
        if (!text || isProcessing) return;

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
        setIsProcessing(true);

        // Reset processing state after a brief delay so user can send more commands
        setTimeout(() => setIsProcessing(false), 1000);
    }, [promptInput, isProcessing, hasQaMention, hasDevMention, addLog]);

    // Handle mention chip click
    const toggleMention = useCallback((type: 'qa' | 'dev') => {
        const mention = `@${type}`;
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

    // Toggle panel collapse
    const togglePanel = useCallback((panel: 'qa' | 'dev') => {
        if (panel === 'qa') {
            setQaCollapsed(prev => !prev);
        } else {
            setDevCollapsed(prev => !prev);
        }
    }, []);

    if (isHidden) return null;

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            backgroundColor: cssVars.bgBody,
            color: cssVars.textMain,
            fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}>
            {/* Top Bar */}
            <div style={{
                height: '40px',
                background: cssVars.bgHeader,
                borderBottom: `1px solid ${cssVars.borderSubtle}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                flexShrink: 0,
            }}>
                <div style={{
                    fontWeight: 700,
                    letterSpacing: '1px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
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
                        backgroundColor: isProcessing ? '#fff' : cssVars.textDim,
                        boxShadow: isProcessing ? '0 0 8px #fff' : 'none',
                    }} />
                    <span>COUNTERFLUX</span>
                    <span style={{ color: cssVars.textDim, fontWeight: 400 }}>// ADVERSARIAL STUDIO</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={handleBack}
                        style={{
                            background: '#333',
                            border: 'none',
                            color: cssVars.textMain,
                            cursor: 'pointer',
                            padding: '4px 10px',
                            fontSize: '10px',
                            fontWeight: 600,
                            borderRadius: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                        title="View AI progress in Chat"
                    >
                        <span className="codicon codicon-comment-discussion" style={{ fontSize: '12px' }} />
                        View Chat
                    </button>
                    <span style={{ fontSize: '10px', color: cssVars.textDim }}>v2.0</span>
                </div>
            </div>

            {/* Main Grid */}
            <div style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1px',
                backgroundColor: cssVars.borderSubtle,
                overflow: 'hidden',
                minHeight: 0,
            }}>
                {/* QA Agent Panel */}
                <AgentPanel
                    role="qa"
                    title="QA Agent"
                    status={qaStatus}
                    logs={qaLogs}
                    logsRef={qaLogsRef}
                    isActive={hasQaMention}
                    isCollapsed={qaCollapsed}
                    onToggleCollapse={() => togglePanel('qa')}
                />

                {/* Dev Agent Panel */}
                <AgentPanel
                    role="dev"
                    title="Developer Agent"
                    status={devStatus}
                    logs={devLogs}
                    logsRef={devLogsRef}
                    isActive={hasDevMention}
                    isCollapsed={devCollapsed}
                    onToggleCollapse={() => togglePanel('dev')}
                />
            </div>

            {/* Command Zone */}
            <div style={{
                background: cssVars.bgHeader,
                borderTop: `1px solid ${cssVars.borderSubtle}`,
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 10,
            }}>
                <div style={{
                    background: cssVars.bgInput,
                    border: `1px solid ${cssVars.borderSubtle}`,
                    borderRadius: '4px',
                    transition: 'border-color 0.2s',
                }}>
                    {/* Pills */}
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        padding: '6px 12px 0 12px',
                    }}>
                        <Pill
                            label="@qa"
                            isActive={hasQaMention}
                            color={cssVars.colorQa}
                            glowColor={cssVars.glowQa}
                            onClick={() => toggleMention('qa')}
                        />
                        <Pill
                            label="@dev"
                            isActive={hasDevMention}
                            color={cssVars.colorDev}
                            glowColor={cssVars.glowDev}
                            onClick={() => toggleMention('dev')}
                        />
                    </div>

                    {/* Textarea */}
                    <textarea
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type instructions. Use '@qa' to toggle testing, '@dev' for coding..."
                        spellCheck={false}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            fontFamily: "'Segoe UI', system-ui, sans-serif",
                            fontSize: '13px',
                            padding: '8px 12px 12px 12px',
                            resize: 'none',
                            minHeight: '60px',
                            outline: 'none',
                        }}
                    />
                </div>

                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!promptInput.trim() || isProcessing}
                    style={{
                        alignSelf: 'flex-end',
                        background: isProcessing ? '#555' : '#333',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '2px',
                        cursor: !promptInput.trim() || isProcessing ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s',
                        textTransform: 'uppercase',
                        opacity: !promptInput.trim() || isProcessing ? 0.5 : 1,
                    }}
                >
                    {isProcessing ? 'Running...' : 'Execute Command'}
                </button>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

/**
 * Agent Panel Component
 */
interface AgentPanelProps {
    role: 'qa' | 'dev';
    title: string;
    status: AgentStatus;
    logs: LogEntry[];
    logsRef: React.RefObject<HTMLDivElement>;
    isActive: boolean;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

const AgentPanel: React.FC<AgentPanelProps> = ({
    role,
    title,
    status,
    logs,
    logsRef,
    isActive,
    isCollapsed,
    onToggleCollapse,
}) => {
    const isQa = role === 'qa';
    const accentColor = isQa ? cssVars.colorQa : cssVars.colorDev;

    return (
        <div style={{
            backgroundColor: cssVars.bgPanel,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            overflow: 'hidden',
            minHeight: isCollapsed ? '40px' : '100px',
            flex: isCollapsed ? '0 0 40px' : 1,
            opacity: isCollapsed ? 0.6 : 1,
            borderTop: isActive ? `2px solid ${accentColor}` : 'none',
        }}>
            {/* Panel Header */}
            <div
                onClick={onToggleCollapse}
                style={{
                    height: '40px',
                    background: cssVars.bgHeader,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    flexShrink: 0,
                }}
            >
                <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: accentColor,
                }}>
                    {isQa ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                        </svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                        </svg>
                    )}
                    {title}
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{
                        fontSize: '10px',
                        color: status === 'PROCESSING' ? '#000' : cssVars.textDim,
                        background: status === 'PROCESSING' ? accentColor : 'transparent',
                        padding: status === 'PROCESSING' ? '1px 6px' : 0,
                        borderRadius: '2px',
                    }}>
                        {status}
                    </span>
                    <div style={{
                        fontSize: '10px',
                        color: cssVars.textDim,
                        transition: 'transform 0.3s',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)',
                    }}>
                        ▼
                    </div>
                </div>
            </div>

            {/* Panel Body (Logs) */}
            {!isCollapsed && (
                <div
                    ref={logsRef}
                    style={{
                        flex: 1,
                        padding: '12px',
                        overflowY: 'auto',
                        fontFamily: "'Fira Code', 'Consolas', monospace",
                        fontSize: '12px',
                        lineHeight: 1.5,
                    }}
                >
                    {logs.map((log) => (
                        <LogLine key={log.id} log={log} isQa={isQa} />
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * Log Line Component
 */
const LogLine: React.FC<{ log: LogEntry; isQa: boolean }> = ({ log, isQa }) => {
    const typeColors: Record<LogEntry['type'], string> = {
        system: cssVars.textDim,
        info: cssVars.textMain,
        success: isQa ? cssVars.colorQa : cssVars.colorDev,
        cmd: isQa ? cssVars.colorQa : cssVars.colorDev,
        error: '#ff6b6b',
    };

    return (
        <div style={{
            marginBottom: '8px',
            animation: 'slideIn 0.2s ease-out',
            wordWrap: 'break-word',
        }}>
            <span style={{ color: cssVars.textDim, marginRight: '8px' }}>[{log.time}]</span>
            <span style={{ color: typeColors[log.type] }}>{log.message}</span>
            {log.code && (
                <code style={{
                    display: 'block',
                    marginTop: '4px',
                    padding: '8px',
                    background: '#111',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    color: '#dcdcdc',
                    fontSize: '11px',
                    whiteSpace: 'pre-wrap',
                }}>
                    {log.code}
                </code>
            )}
        </div>
    );
};

/**
 * Pill Component - @mention chips
 */
interface PillProps {
    label: string;
    isActive: boolean;
    color: string;
    glowColor: string;
    onClick: () => void;
}

const Pill: React.FC<PillProps> = ({ label, isActive, color, glowColor, onClick }) => (
    <div
        onClick={onClick}
        style={{
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '10px',
            background: isActive ? glowColor : '#333',
            color: isActive ? color : '#888',
            cursor: 'pointer',
            transition: 'all 0.2s',
            border: isActive ? `1px solid ${color}` : '1px solid transparent',
            boxShadow: isActive ? `0 0 8px ${glowColor}` : 'none',
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
