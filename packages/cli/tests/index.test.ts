import { describe, it, expect, vi } from 'vitest';

describe('cli', () => {
  it('should log package information', async () => {
    // Mock console.log to capture output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Import the module to trigger the console.log
    await import('../src/index.ts');

    // Verify the console.log calls
    expect(consoleSpy).toHaveBeenCalledWith('Package: @1tc/cli');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Description: Utility cli for 1tc-platform'
    );

    consoleSpy.mockRestore();
  });
});
