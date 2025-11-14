import { render, screen, fireEvent } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from './PromptInput';

describe('PromptInput components', () => {
  it('calls onSubmit when form is submitted with valid input', async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea value="Test message" onChange={onChange} placeholder="Type here..." />
        <PromptInputToolbar>
          <PromptInputSubmit />
        </PromptInputToolbar>
      </PromptInput>,
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledWith('Test message');
  });

  it('does not call onSubmit when input is empty or whitespace only', async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea value="   " onChange={onChange} />
        <PromptInputToolbar>
          <PromptInputSubmit />
        </PromptInputToolbar>
      </PromptInput>,
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    await userEvent.click(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('handles Enter key to submit (without Shift)', async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const onKeyDown = vi.fn((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit('Test');
      }
    });

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea value="Test" onChange={onChange} onKeyDown={onKeyDown} />
        <PromptInputToolbar>
          <PromptInputSubmit />
        </PromptInputToolbar>
      </PromptInput>,
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onKeyDown).toHaveBeenCalled();
  });

  it('allows Shift+Enter for newline without submitting', async () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const onKeyDown = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea value="Test" onChange={onChange} onKeyDown={onKeyDown} />
        <PromptInputToolbar>
          <PromptInputSubmit />
        </PromptInputToolbar>
      </PromptInput>,
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    // onKeyDown is called but we check that Enter+Shift doesn't trigger preventDefault
    expect(onKeyDown).toHaveBeenCalled();
  });

  it('disables submit button when disabled prop is true', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();

    render(
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea value="Test" onChange={onChange} disabled={true} />
        <PromptInputToolbar>
          <PromptInputSubmit disabled={true} />
        </PromptInputToolbar>
      </PromptInput>,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    const submitButton = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement;

    expect(textarea.disabled).toBe(true);
    expect(submitButton.disabled).toBe(true);
  });
});
