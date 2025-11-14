import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Conversation, ConversationContent } from './Conversation';
import React from 'react';

describe('Conversation components', () => {
  it('renders conversation container', () => {
    const { container } = render(
      <Conversation>
        <ConversationContent>
          <div>Message 1</div>
          <div>Message 2</div>
        </ConversationContent>
      </Conversation>
    );
    
    expect(container.querySelector('.flex')).toBeTruthy();
    expect(screen.getByText('Message 1')).toBeTruthy();
    expect(screen.getByText('Message 2')).toBeTruthy();
  });

  it('renders messages in correct order', () => {
    render(
      <Conversation>
        <ConversationContent>
          <div data-testid="msg-1">First message</div>
          <div data-testid="msg-2">Second message</div>
          <div data-testid="msg-3">Third message</div>
        </ConversationContent>
      </Conversation>
    );
    
    const messages = screen.getAllByTestId(/msg-/);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toHaveTextContent('First message');
    expect(messages[1]).toHaveTextContent('Second message');
    expect(messages[2]).toHaveTextContent('Third message');
  });

  it('applies custom className', () => {
    const { container } = render(
      <Conversation className="custom-class">
        <ConversationContent>Test</ConversationContent>
      </Conversation>
    );
    
    expect(container.querySelector('.custom-class')).toBeTruthy();
  });
});


