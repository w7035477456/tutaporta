import { afterEach, describe, expect, it, vi } from 'vitest';
import { offerRecordVaultBackupBeforeExit, registerRecordVaultExitBackupPrompt } from './recordVaultExitBackupGate';

describe('offerRecordVaultBackupBeforeExit', () => {
  let unregister = () => {};

  afterEach(() => {
    unregister();
    unregister = () => {};
  });

  it('allows the exit when no TutaNotes pane is registered', async () => {
    expect(await offerRecordVaultBackupBeforeExit()).toBe(true);
  });

  it('allows the exit when the prompt resolves true or nothing', async () => {
    unregister = registerRecordVaultExitBackupPrompt(async () => true);
    expect(await offerRecordVaultBackupBeforeExit()).toBe(true);
    unregister();
    unregister = registerRecordVaultExitBackupPrompt(async () => undefined);
    expect(await offerRecordVaultBackupBeforeExit()).toBe(true);
  });

  it('cancels the exit when the dialog closed without a backup', async () => {
    unregister = registerRecordVaultExitBackupPrompt(async () => false);
    expect(await offerRecordVaultBackupBeforeExit()).toBe(false);
  });

  it('asks again on every exit attempt until the prompt allows it', async () => {
    const prompt = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    unregister = registerRecordVaultExitBackupPrompt(prompt);
    expect(await offerRecordVaultBackupBeforeExit()).toBe(false);
    expect(await offerRecordVaultBackupBeforeExit()).toBe(false);
    expect(await offerRecordVaultBackupBeforeExit()).toBe(true);
    expect(prompt).toHaveBeenCalledTimes(3);
  });

  it('never blocks the exit when the prompt throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    unregister = registerRecordVaultExitBackupPrompt(async () => {
      throw new Error('network down');
    });
    expect(await offerRecordVaultBackupBeforeExit()).toBe(true);
    warn.mockRestore();
  });

  it('stops prompting after the pane unregisters', async () => {
    const off = registerRecordVaultExitBackupPrompt(async () => false);
    off();
    expect(await offerRecordVaultBackupBeforeExit()).toBe(true);
  });
});
