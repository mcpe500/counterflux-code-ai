import React from 'react';

interface ParralelModeToggleProps {
    isParralelMode: boolean;
    onToggle: (isParralel: boolean) => void;
    disabled?: boolean;
}

/**
 * ParralelModeToggle - Switch between Single Mode and Parralel Mode
 */
export const ParralelModeToggle: React.FC<ParralelModeToggleProps> = ({
    isParralelMode,
    onToggle,
    disabled = false,
}) => {
    return (
        <div
            style={{
                display: 'inline-flex',
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid var(--vscode-widget-border)',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <button
                onClick={() => onToggle(false)}
                disabled={disabled}
                style={{
                    padding: '6px 14px',
                    border: 'none',
                    backgroundColor: !isParralelMode
                        ? 'var(--vscode-button-background)'
                        : 'var(--vscode-button-secondaryBackground)',
                    color: !isParralelMode
                        ? 'var(--vscode-button-foreground)'
                        : 'var(--vscode-button-secondaryForeground)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                }}
            >
                <span style={{ fontSize: '14px' }}>⬜</span>
                Single
            </button>
            <button
                onClick={() => onToggle(true)}
                disabled={disabled}
                style={{
                    padding: '6px 14px',
                    border: 'none',
                    borderLeft: '1px solid var(--vscode-widget-border)',
                    backgroundColor: isParralelMode
                        ? 'var(--vscode-charts-purple)'
                        : 'var(--vscode-button-secondaryBackground)',
                    color: isParralelMode
                        ? 'var(--vscode-button-foreground)'
                        : 'var(--vscode-button-secondaryForeground)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                }}
            >
                <span style={{ fontSize: '14px' }}>⬜⬜</span>
                Parralel
            </button>
        </div>
    );
};

export default ParralelModeToggle;
