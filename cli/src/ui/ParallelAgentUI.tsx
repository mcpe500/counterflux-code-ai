import React, { useState, useEffect } from 'react';

interface AgentService {
  sendMessage: (message: string) => void;
  onMessage: (callback: (message: string) => void) => void;
}

interface ParallelAgentUIProps {
  qaAgentService: AgentService;
  devAgentService: AgentService;
}

export const ParallelAgentUI: React.FC<ParallelAgentUIProps> = ({
  qaAgentService,
  devAgentService,
}) => {
  const [qaOutput, setQaOutput] = useState<string>('');
  const [devOutput, setDevOutput] = useState<string>('');
  const [qaInput, setQaInput] = useState<string>('');
  const [devInput, setDevInput] = useState<string>('');
  const [qaStatus, setQaStatus] = useState<'Idle' | 'Active'>('Idle');
  const [devStatus, setDevStatus] = useState<'Idle' | 'Active'>('Idle');

  useEffect(() => {
    qaAgentService.onMessage((message) => {
      setQaOutput((prev) => prev + message + '\n');
      setQaStatus('Active');
      // Simulate status change back to Idle after a short delay
      setTimeout(() => setQaStatus('Idle'), 1000);
    });

    devAgentService.onMessage((message) => {
      setDevOutput((prev) => prev + message + '\n');
      setDevStatus('Active');
      // Simulate status change back to Idle after a short delay
      setTimeout(() => setDevStatus('Idle'), 1000);
    });
  }, [qaAgentService, devAgentService]);

  const handleQaSend = () => {
    qaAgentService.sendMessage(qaInput);
    setQaInput('');
  };

  const handleDevSend = () => {
    devAgentService.sendMessage(devInput);
    setDevInput('');
  };

  return (
    <div className="parallel-agent-ui">
      <div className="agent-section">
        <h2>QA Agent</h2>
        <div data-testid="qa-agent-output" className="output-area">{qaOutput}</div>
        <div data-testid="qa-agent-status">Status: {qaStatus}</div>
        <input
          data-testid="qa-agent-input"
          type="text"
          value={qaInput}
          onChange={(e) => setQaInput(e.target.value)}
        />
        <button data-testid="qa-send-button" onClick={handleQaSend}>Send to QA</button>
      </div>

      <div className="agent-section">
        <h2>Developer Agent</h2>
        <div data-testid="dev-agent-output" className="output-area">{devOutput}</div>
        <div data-testid="dev-agent-status">Status: {devStatus}</div>
        <input
          data-testid="dev-agent-input"
          type="text"
          value={devInput}
          onChange={(e) => setDevInput(e.target.value)}
        />
        <button data-testid="dev-send-button" onClick={handleDevSend}>Send to Dev</button>
      </div>
    </div>
  );
};