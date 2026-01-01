import React, { useState, useCallback, useEffect } from 'react';
import { vscode } from '../../utils/vscode';
import { useExtensionState } from '../../context/ExtensionStateContext';
import AgentPanel from './AgentPanel';
import SpecPanel from './SpecPanel';
import ParralelModeToggle from './ParralelModeToggle';

/**
 * Types for the Parralel View state
 */
type SpecStatus = 'draft' | 'frozen' | 'locked';
type AgentSessionStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'error';
type OrchestratorStatus = 'idle' | 'initializing' | 'running' | 'paused' | 'completed' | 'error';

interface AgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface ParralelViewProps {
    isHidden: boolean;
}

/**
 * ParralelView - Main split-pane layout for parallel QA and Dev agents
 *
 * Layout:
 * +-----------------------------------+
 * |  Header (Title + Mode Toggle)    |
 * +-----------------------------------+
 * |        Shared Spec Panel          |
 * +---------------+-------------------+
 * |  QA Agent     |   Dev Agent       |
 * |  Panel        |   Panel           |
 * +---------------+-------------------+
 */
export const ParralelView: React.FC<ParralelViewProps> = ({ isHidden }) => {
    const { mode } = useExtensionState();

    // Orchestrator state
    const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatus>('idle');
    const [isParralelMode, setIsParralelMode] = useState(true);

    // Spec state
    const [specContent, setSpecContent] = useState<string | null>(null);
    const [specStatus, setSpecStatus] = useState<SpecStatus>('draft');

    // QA Agent state
    const [qaMessages, setQaMessages] = useState<AgentMessage[]>([]);
    const [qaStatus, setQaStatus] = useState<AgentSessionStatus>('idle');
    const [qaStreaming, setQaStreaming] = useState('');
    const [qaIsStreaming, setQaIsStreaming] = useState(false);

    // Dev Agent state
    const [devMessages, setDevMessages] = useState<AgentMessage[]>([]);
    const [devStatus, setDevStatus] = useState<AgentSessionStatus>('idle');
    const [devStreaming, setDevStreaming] = useState('');
    const [devIsStreaming, setDevIsStreaming] = useState(false);

    // Active panel (for input focus)
    const [activePanel, setActivePanel] = useState<'qa' | 'dev'>('qa');

    // Prompt input for starting
    const [promptInput, setPromptInput] = useState('');

    // Listen for messages from the extension
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            switch (message.type) {
                case 'parralel:qa:message':
                    setQaMessages(prev => [...prev, message.message]);
                    break;
                case 'parralel:dev:message':
                    setDevMessages(prev => [...prev, message.message]);
                    break;
                case 'parralel:qa:streaming':
                    setQaStreaming(message.content);
                    setQaIsStreaming(!message.isComplete);
                    if (message.isComplete) {
                        setQaStreaming('');
                    }
                    break;
                case 'parralel:dev:streaming':
                    setDevStreaming(message.content);
                    setDevIsStreaming(!message.isComplete);
                    if (message.isComplete) {
                        setDevStreaming('');
                    }
                    break;
                case 'parralel:qa:status':
                    setQaStatus(message.status);
                    break;
                case 'parralel:dev:status':
                    setDevStatus(message.status);
                    break;
                case 'parralel:spec:updated':
                    setSpecContent(message.content);
                    setSpecStatus(message.status);
                    break;
                case 'parralel:orchestrator:status':
                    setOrchestratorStatus(message.status);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Start Parralel Mode
    const handleStart = useCallback(() => {
        if (!promptInput.trim()) return;

        vscode.postMessage({
            type: 'parralel:start',
            prompt: promptInput.trim(),
        });
        setPromptInput('');
    }, [promptInput]);

    // Send message to QA agent
    const handleSendToQA = useCallback((message: string) => {
        const userMessage: AgentMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now(),
        };
        setQaMessages(prev => [...prev, userMessage]);

        vscode.postMessage({
            type: 'parralel:qa:send',
            message,
        });
    }, []);

    // Send message to Dev agent
    const handleSendToDev = useCallback((message: string) => {
        const userMessage: AgentMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now(),
        };
        setDevMessages(prev => [...prev, userMessage]);

        vscode.postMessage({
            type: 'parralel:dev:send',
            message,
        });
    }, []);

    // Freeze spec
    const handleFreezeSpec = useCallback(() => {
        vscode.postMessage({ type: 'parralel:spec:freeze' });
    }, []);

    // Lock spec
    const handleLockSpec = useCallback(() => {
        vscode.postMessage({ type: 'parralel:spec:lock' });
    }, []);

    // Mode toggle
    const handleModeToggle = useCallback((isParralel: boolean) => {
        setIsParralelMode(isParralel);
        vscode.postMessage({
            type: 'parralel:mode:toggle',
            isParralel,
        });
    }, []);

    if (isHidden) return null;

    const isRunning = orchestratorStatus === 'running' || orchestratorStatus === 'paused';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: 'var(--vscode-sideBar-background)',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--vscode-widget-border)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                        ⚡ Counterflux
                    </h2>
                    <span
                        style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: isRunning
                                ? 'var(--vscode-charts-green)20'
                                : 'var(--vscode-charts-gray)20',
                            color: isRunning
                                ? 'var(--vscode-charts-green)'
                                : 'var(--vscode-descriptionForeground)',
                            fontSize: '11px',
                            fontWeight: 500,
                        }}
                    >
                        {orchestratorStatus.toUpperCase()}
                    </span>
                </div>
                <ParralelModeToggle
                    isParralelMode={isParralelMode}
                    onToggle={handleModeToggle}
                    disabled={isRunning}
                />
            </div>

            {/* Start Prompt (shown when idle) */}
            {orchestratorStatus === 'idle' && (
                <div
                    style={{
                        padding: '20px 16px',
                        borderBottom: '1px solid var(--vscode-widget-border)',
                    }}
                >
                    <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 500 }}>
                        What would you like to build?
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <textarea
                            value={promptInput}
                            onChange={(e) => setPromptInput(e.target.value)}
                            placeholder="Describe your feature or task..."
                            style={{
                                flex: 1,
                                padding: '10px 12px',
                                border: '1px solid var(--vscode-input-border)',
                                borderRadius: '6px',
                                backgroundColor: 'var(--vscode-input-background)',
                                color: 'var(--vscode-input-foreground)',
                                fontSize: '13px',
                                resize: 'none',
                                minHeight: '60px',
                                fontFamily: 'inherit',
                            }}
                        />
                        <button
                            onClick={handleStart}
                            disabled={!promptInput.trim()}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: promptInput.trim()
                                    ? 'var(--vscode-button-background)'
                                    : 'var(--vscode-button-secondaryBackground)',
                                color: promptInput.trim()
                                    ? 'var(--vscode-button-foreground)'
                                    : 'var(--vscode-button-secondaryForeground)',
                                cursor: promptInput.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '13px',
                                fontWeight: 500,
                                alignSelf: 'flex-start',
                            }}
                        >
                            🚀 Start
                        </button>
                    </div>
                </div>
            )}

            {/* Spec Panel */}
            <div style={{ padding: '12px 16px' }}>
                <SpecPanel
                    content={specContent}
                    status={specStatus}
                    onFreeze={handleFreezeSpec}
                    onLock={handleLockSpec}
                    isEditable={isRunning}
                />
            </div>

            {/* Agent Panels - Split View */}
            <div
                style={{
                    flex: 1,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    padding: '0 16px 16px 16px',
                    minHeight: 0,
                }}
            >
                <AgentPanel
                    role="qa"
                    isActive={activePanel === 'qa'}
                    status={qaStatus}
                    messages={qaMessages}
                    streamingContent={qaStreaming}
                    isStreaming={qaIsStreaming}
                    onSendMessage={handleSendToQA}
                    onActivate={() => setActivePanel('qa')}
                />
                <AgentPanel
                    role="dev"
                    isActive={activePanel === 'dev'}
                    status={devStatus}
                    messages={devMessages}
                    streamingContent={devStreaming}
                    isStreaming={devIsStreaming}
                    onSendMessage={handleSendToDev}
                    onActivate={() => setActivePanel('dev')}
                />
            </div>

            {/* Footer Controls */}
            {isRunning && (
                <div
                    style={{
                        padding: '12px 16px',
                        borderTop: '1px solid var(--vscode-widget-border)',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '12px',
                    }}
                >
                    {orchestratorStatus === 'running' && (
                        <button
                            onClick={() => vscode.postMessage({ type: 'parralel:pause' })}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: 'var(--vscode-charts-yellow)',
                                color: '#000',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                            }}
                        >
                            ⏸ Pause
                        </button>
                    )}
                    {orchestratorStatus === 'paused' && (
                        <button
                            onClick={() => vscode.postMessage({ type: 'parralel:resume' })}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: 'var(--vscode-charts-green)',
                                color: 'var(--vscode-button-foreground)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 500,
                            }}
                        >
                            ▶️ Resume
                        </button>
                    )}
                    <button
                        onClick={() => vscode.postMessage({ type: 'parralel:abort' })}
                        style={{
                            padding: '6px 16px',
                            borderRadius: '4px',
                            border: 'none',
                            backgroundColor: 'var(--vscode-charts-red)',
                            color: 'var(--vscode-button-foreground)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 500,
                        }}
                    >
                        ⏹ Stop
                    </button>
                </div>
            )}
        </div>
    );
};

export default ParralelView;
