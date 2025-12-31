import React, { useState, useEffect, useMemo } from 'react';
import { VSCodeButton, VSCodeTextArea, VSCodeTag } from '@vscode/webview-ui-toolkit/react';
import { useExtensionState } from '../../context/ExtensionStateContext';
import { vscode } from '../../utils/vscode';
import ChatRow from '../chat/ChatRow';

interface CounterfluxSplitViewProps {
    isHidden: boolean;
}

export const CounterfluxSplitView: React.FC<CounterfluxSplitViewProps> = ({ isHidden }) => {
    const {
        clineMessages: messages,
        mode,
        setMode
    } = useExtensionState();

    const [qaInput, setQaInput] = useState('');
    const [devInput, setDevInput] = useState('');

    // Heuristic: Filter messages based on mode switches if we could track them.
    // Since we can't reliably know the mode of past messages without metadata,
    // we will show the full history in the active column for now, 
    // or simplisticly putting all 'ask' user messages in the active side?
    // For the MVP of this UI, we'll render the chat in a unified way but visually split the controls.

    const isQaActive = mode === 'counterflux-qa';
    const isDevActive = mode === 'counterflux-dev';

    const handleModeSwitch = (newMode: string) => {
        setMode(newMode);
        vscode.postMessage({ type: "mode", text: newMode });
    };

    const handleSend = (text: string) => {
        if (text.trim()) {
            vscode.postMessage({ type: "askResponse", askResponse: "messageResponse", text, images: [] });
            setQaInput('');
            setDevInput('');
        }
    };

    if (isHidden) return null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '10px', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Counterflux Adversarial Loop</h2>
                <VSCodeTag>{mode}</VSCodeTag>
            </div>

            <div style={{ display: 'flex', flex: 1, gap: '15px', overflow: 'hidden' }}>

                {/* QA Agent Column */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        border: `2px solid ${isQaActive ? 'var(--vscode-charts-blue)' : 'var(--vscode-widget-border)'}`,
                        borderRadius: '6px',
                        opacity: isQaActive ? 1 : 0.6,
                        transition: 'all 0.3s ease'
                    }}
                    onClick={() => !isQaActive && handleModeSwitch('counterflux-qa')}
                >
                    <div style={{ padding: '10px', background: 'var(--vscode-editor-background)', borderBottom: '1px solid var(--vscode-widget-border)' }}>
                        <h3 style={{ margin: 0 }}>QA Agent</h3>
                        <span style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>Generates Specs & Tests</span>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        {/* In a real implementation we would filter messages here. 
                 For now we show the chat if active. */}
                        {isQaActive && messages.map((msg, i) => (
                            <div key={i} style={{ marginBottom: '10px' }}>
                                {/* Simplified render for now */}
                                <strong>{msg.type}:</strong> {msg.say || msg.text}
                            </div>
                        ))}
                        {!isQaActive && <div style={{ padding: 20, textAlign: 'center' }}>Click to Activate</div>}
                    </div>

                    <div style={{ padding: '10px', borderTop: '1px solid var(--vscode-widget-border)' }}>
                        <VSCodeTextArea
                            value={qaInput}
                            onChange={(e: any) => setQaInput(e.target.value)}
                            placeholder="Instruct QA Agent..."
                            style={{ width: '100%' }}
                            disabled={!isQaActive}
                        />
                        <VSCodeButton
                            style={{ marginTop: '10px', width: '100%' }}
                            onClick={() => handleSend(qaInput)}
                            disabled={!isQaActive}
                        >Send to QA</VSCodeButton>
                    </div>
                </div>

                {/* Developer Agent Column */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        border: `2px solid ${isDevActive ? 'var(--vscode-charts-green)' : 'var(--vscode-widget-border)'}`,
                        borderRadius: '6px',
                        opacity: isDevActive ? 1 : 0.6,
                        transition: 'all 0.3s ease'
                    }}
                    onClick={() => !isDevActive && handleModeSwitch('counterflux-dev')}
                >
                    <div style={{ padding: '10px', background: 'var(--vscode-editor-background)', borderBottom: '1px solid var(--vscode-widget-border)' }}>
                        <h3 style={{ margin: 0 }}>Developer Agent</h3>
                        <span style={{ fontSize: '0.8em', color: 'var(--vscode-descriptionForeground)' }}>Implements Features</span>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                        {isDevActive && messages.map((msg, i) => (
                            <div key={i} style={{ marginBottom: '10px' }}>
                                <strong>{msg.type}:</strong> {msg.say || msg.text}
                            </div>
                        ))}
                        {!isDevActive && <div style={{ padding: 20, textAlign: 'center' }}>Click to Activate</div>}
                    </div>

                    <div style={{ padding: '10px', borderTop: '1px solid var(--vscode-widget-border)' }}>
                        <VSCodeTextArea
                            value={devInput}
                            onChange={(e: any) => setDevInput(e.target.value)}
                            placeholder="Instruct Developer..."
                            style={{ width: '100%' }}
                            disabled={!isDevActive}
                        />
                        <VSCodeButton
                            style={{ marginTop: '10px', width: '100%' }}
                            onClick={() => handleSend(devInput)}
                            disabled={!isDevActive}
                        >Send to Dev</VSCodeButton>
                    </div>
                </div>

            </div>
        </div>
    );
};
