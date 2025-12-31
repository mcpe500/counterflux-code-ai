import React, { useState, useEffect } from 'react';

interface AgentService {
  sendMessage: (message: string) => void;
  onMessage: (callback: (message: string) => void) => () => void;
}

interface ParallelAgentUIProps {
  qaAgentService: AgentService;
  devAgentService: AgentService;
}

export const ParallelAgentUI: React.FC<ParallelAgentUIProps> = ({
  qaAgentService,
  devAgentService,
}) => {
  const [qaOutput, setQaOutput] = useState<string[]>([]);
  const [devOutput, setDevOutput] = useState<string[]>([]);
  const [qaInput, setQaInput] = useState('');
  const [devInput, setDevInput] = useState('');
  const [qaStatus, setQaStatus] = useState('Idle');
  const [devStatus, setDevStatus] = useState('Idle');

  useEffect(() => {
    const unsubscribeQa = qaAgentService.onMessage((message) => {
      setQaOutput((prev) => [...prev, message]);
      if (message.includes('Working on tests')) {
        setQaStatus('Active');
        setDevStatus('Idle');
      } else {
        setQaStatus('Idle');
      }
    });

    const unsubscribeDev = devAgentService.onMessage((message) => {
      setDevOutput((prev) => [...prev, message]);
      if (message.includes('Writing code') || message.includes('Implementing fix') || message.includes('Received new test')) {
        setDevStatus('Active');
        setQaStatus('Idle');
      } else {
        setDevStatus('Idle');
      }
    });

    return () => {
      unsubscribeQa();
      unsubscribeDev();
    };
  }, [qaAgentService, devAgentService]);

  const handleQaSend = () => {
    if (qaInput.trim()) {
      qaAgentService.sendMessage(qaInput);
      setQaInput('');
    }
  };

  const handleDevSend = () => {
    if (devInput.trim()) {
      devAgentService.sendMessage(devInput);
      setDevInput('');
    }
  };

  return (
    <div>
      <h1>Parallel Agent UI</h1>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* QA Agent Section */}
        <div style={{ flex: 1 }}>
          <h2>QA Agent</h2>
          <div data-testid="qa-agent-status">Status: {qaStatus}</div>
          <div data-testid="qa-agent-output" style={{ border: '1px solid gray', minHeight: '100px', padding: '10px' }}>
            {qaOutput.map((msg, index) => (
              <p key={index}>{msg}</p>
            ))}
          </div>
          <input
            data-testid="qa-agent-input"
            type="text"
            value={qaInput}
            onChange={(e) => setQaInput(e.target.value)}
            placeholder="Message QA Agent"
            style={{ width: '100%', marginTop: '10px' }}
          />
          <button data-testid="qa-send-button" onClick={handleQaSend} style={{ marginTop: '5px' }}>
            Send to QA
          </button>
        </div>

        {/* Developer Agent Section */}
        <div style={{ flex: 1 }}>
          <h2>Developer Agent</h2>
          <div data-testid="dev-agent-status">Status: {devStatus}</div>
          <div data-testid="dev-agent-output" style={{ border: '1px solid gray', minHeight: '100px', padding: '10px' }}>
            {devOutput.map((msg, index) => (
              <p key={index}>{msg}</p>
            ))}
          </div>
          <input
            data-testid="dev-agent-input"
            type="text"
            value={devInput}
            onChange={(e) => setDevInput(e.target.value)}
            placeholder="Message Developer Agent"
            style={{ width: '100%', marginTop: '10px' }}
          />
          <button data-testid="dev-send-button" onClick={handleDevSend} style={{ marginTop: '5px' }}>
            Send to Dev
          </button>
        </div>
      </div>
    </div>
  );
};