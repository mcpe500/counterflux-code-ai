import React, { useRef, useEffect, useState } from 'react';

/**
 * Agent message from streaming
 */
interface AgentMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}

/**
 * Agent status type
 */
type AgentSessionStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'error';

interface AgentPanelProps {
    role: 'qa' | 'dev';
    isActive: boolean;
    status: AgentSessionStatus;
    messages: AgentMessage[];
    streamingContent: string;
    isStreaming: boolean;
    onSendMessage: (message: string) => void;
    onActivate: () => void;
}

/**
 * Status indicator colors
 */
const statusColors: Record<AgentSessionStatus, string> = {
    idle: 'var(--vscode-charts-gray)',
    thinking: 'var(--vscode-charts-yellow)',
    executing: 'var(--vscode-charts-blue)',
    waiting: 'var(--vscode-charts-orange)',
    completed: 'var(--vscode-charts-green)',
    error: 'var(--vscode-charts-red)',
};

/**
 * Status labels
 */
const statusLabels: Record<AgentSessionStatus, string> = {
    idle: 'Idle',
    thinking: 'Thinking...',
    executing: 'Executing...',
    waiting: 'Waiting',
    completed: 'Done',
    error: 'Error',
};

/**
 * AgentPanel - Reusable panel for QA or Dev agent display
 */
export const AgentPanel: React.FC<AgentPanelProps> = ({
    role,
    isActive,
    status,
    messages,
    streamingContent,
    isStreaming,
    onSendMessage,
    onActivate,
}) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const isQA = role === 'qa';
    const accentColor = isQA ? 'var(--vscode-charts-blue)' : 'var(--vscode-charts-green)';
    const title = isQA ? 'QA Agent' : 'Developer Agent';
    const subtitle = isQA ? 'Specs & Tests' : 'Implementation';

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Focus input when activated
    useEffect(() => {
        if (isActive) {
            inputRef.current?.focus();
        }
    }, [isActive]);

    const handleSend = () => {
        const trimmed = inputValue.trim();
        if (trimmed && isActive) {
            onSendMessage(trimmed);
            setInputValue('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                border: `2px solid ${isActive ? accentColor : 'var(--vscode-widget-border)'}`,
                borderRadius: '8px',
                overflow: 'hidden',
                opacity: isActive ? 1 : 0.7,
                transition: 'all 0.3s ease',
                backgroundColor: 'var(--vscode-editor-background)',
            }}
            onClick={() => !isActive && onActivate()}
        >
            {/* Header */}
            <div
                style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--vscode-widget-border)',
                    backgroundColor: isActive ? `${accentColor}15` : 'transparent',
                }}
            >
                <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{title}</h3>
                    <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                        {subtitle}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                        style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: statusColors[status],
                            animation: status === 'thinking' || status === 'executing' ? 'pulse 1.5s infinite' : 'none',
                        }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--vscode-descriptionForeground)' }}>
                        {statusLabels[status]}
                    </span>
                </div>
            </div>

            {/* Messages Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}
            >
                {messages.filter(m => m.role !== 'system').map((msg, index) => (
                    <div
                        key={index}
                        style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: msg.role === 'user'
                                ? 'var(--vscode-input-background)'
                                : 'var(--vscode-editor-inactiveSelectionBackground)',
                            borderLeft: `3px solid ${msg.role === 'user' ? 'var(--vscode-charts-purple)' : accentColor}`,
                        }}
                    >
                        <div style={{
                            fontSize: '10px',
                            color: 'var(--vscode-descriptionForeground)',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}>
                            {msg.role === 'user' ? 'You' : title}
                        </div>
                        <div style={{
                            fontSize: '13px',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                        }}>
                            {msg.content}
                        </div>
                    </div>
                ))}

                {/* Streaming content */}
                {isStreaming && streamingContent && (
                    <div
                        style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--vscode-editor-inactiveSelectionBackground)',
                            borderLeft: `3px solid ${accentColor}`,
                            opacity: 0.9,
                        }}
                    >
                        <div style={{
                            fontSize: '10px',
                            color: 'var(--vscode-descriptionForeground)',
                            marginBottom: '4px',
                        }}>
                            {title} (typing...)
                        </div>
                        <div style={{
                            fontSize: '13px',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                        }}>
                            {streamingContent}
                            <span style={{ animation: 'blink 1s infinite' }}>▊</span>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {messages.length <= 1 && !isStreaming && (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--vscode-descriptionForeground)',
                        fontSize: '12px',
                        textAlign: 'center',
                        padding: '20px',
                    }}>
                        {isActive
                            ? `Send a message to the ${title}`
                            : 'Click to activate this panel'}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div
                style={{
                    padding: '12px',
                    borderTop: '1px solid var(--vscode-widget-border)',
                    backgroundColor: 'var(--vscode-sideBar-background)',
                }}
            >
                <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isActive ? `Message ${title}...` : 'Click to activate'}
                        disabled={!isActive}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '6px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            fontSize: '13px',
                            resize: 'none',
                            minHeight: '36px',
                            maxHeight: '100px',
                            fontFamily: 'inherit',
                        }}
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!isActive || !inputValue.trim()}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: isActive && inputValue.trim()
                                ? accentColor
                                : 'var(--vscode-button-secondaryBackground)',
                            color: isActive && inputValue.trim()
                                ? 'var(--vscode-button-foreground)'
                                : 'var(--vscode-button-secondaryForeground)',
                            cursor: isActive && inputValue.trim() ? 'pointer' : 'not-allowed',
                            fontSize: '13px',
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* CSS Animations */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default AgentPanel;
