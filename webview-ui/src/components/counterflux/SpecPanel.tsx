import React from 'react';

/**
 * Spec status type
 */
type SpecStatus = 'draft' | 'frozen' | 'locked';

interface SpecPanelProps {
    content: string | null;
    status: SpecStatus;
    onFreeze: () => void;
    onLock: () => void;
    isEditable: boolean;
}

/**
 * Status badge colors and labels
 */
const statusConfig: Record<SpecStatus, { color: string; label: string; icon: string }> = {
    draft: {
        color: 'var(--vscode-charts-yellow)',
        label: 'Draft',
        icon: '📝',
    },
    frozen: {
        color: 'var(--vscode-charts-blue)',
        label: 'Frozen',
        icon: '❄️',
    },
    locked: {
        color: 'var(--vscode-charts-green)',
        label: 'Locked',
        icon: '🔒',
    },
};

/**
 * SpecPanel - Displays the shared SPEC.md document with status controls
 */
export const SpecPanel: React.FC<SpecPanelProps> = ({
    content,
    status,
    onFreeze,
    onLock,
    isEditable,
}) => {
    const config = statusConfig[status];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--vscode-editor-background)',
                border: '1px solid var(--vscode-widget-border)',
                borderRadius: '8px',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '10px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid var(--vscode-widget-border)',
                    backgroundColor: 'var(--vscode-sideBar-background)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>📋</span>
                    <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
                        SPEC.md
                    </h3>
                    <span
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: `${config.color}20`,
                            color: config.color,
                            fontSize: '11px',
                            fontWeight: 500,
                        }}
                    >
                        <span>{config.icon}</span>
                        {config.label}
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    {status === 'draft' && isEditable && (
                        <button
                            onClick={onFreeze}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: 'var(--vscode-charts-blue)',
                                color: 'var(--vscode-button-foreground)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 500,
                            }}
                        >
                            ❄️ Freeze Spec
                        </button>
                    )}
                    {status === 'frozen' && isEditable && (
                        <button
                            onClick={onLock}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '4px',
                                border: 'none',
                                backgroundColor: 'var(--vscode-charts-green)',
                                color: 'var(--vscode-button-foreground)',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 500,
                            }}
                        >
                            🔒 Lock & Approve
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    padding: '12px 16px',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    fontSize: '12px',
                    lineHeight: 1.6,
                }}
            >
                {content ? (
                    <pre
                        style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'var(--vscode-editor-font-family)',
                            color: 'var(--vscode-editor-foreground)',
                        }}
                    >
                        {content}
                    </pre>
                ) : (
                    <div
                        style={{
                            color: 'var(--vscode-descriptionForeground)',
                            textAlign: 'center',
                            padding: '20px',
                        }}
                    >
                        <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>
                            📄
                        </span>
                        No specification yet.
                        <br />
                        <span style={{ fontSize: '11px' }}>
                            The QA Agent will generate SPEC.md
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpecPanel;
