import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Message, MessageAvatar, MessageContent } from './Message';

describe('Message components', () => {
  it('renders user message with correct styling', () => {
    const { container } = render(
      <Message role="user">
        <MessageAvatar role="user" />
        <MessageContent role="user">Hello</MessageContent>
      </Message>,
    );

    expect(container.querySelector('.flex-row-reverse')).toBeTruthy();
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('renders assistant message with correct styling', () => {
    const { container } = render(
      <Message role="assistant">
        <MessageAvatar role="assistant" />
        <MessageContent role="assistant">Hi there</MessageContent>
      </Message>,
    );

    expect(container.querySelector('.flex-row')).toBeTruthy();
    expect(screen.getByText('Hi there')).toBeTruthy();
  });

  it('renders MessageAvatar with correct role indicators', () => {
    const { rerender } = render(<MessageAvatar role="user" />);
    expect(screen.getByText('U')).toBeTruthy();

    rerender(<MessageAvatar role="assistant" />);
    expect(screen.getByText('AI')).toBeTruthy();
  });

  it('renders MessageContent with proper text wrapping', () => {
    render(
      <Message role="user">
        <MessageContent role="user">
          This is a long message that should wrap properly
        </MessageContent>
      </Message>,
    );

    expect(screen.getByText(/This is a long message/)).toBeTruthy();
  });
});
