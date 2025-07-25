import { describe, test, expect } from 'vitest';
import { Netmask } from '../src/netmask.js';

describe('Netmask', () => {
  describe('can build a block', () => {
    const block = new Netmask('10.1.2.0/24');

    test('should contain a sub-block', () => {
      const block1 = new Netmask('10.1.2.10/29');
      expect(block.contains(block1)).toBe(true);
    });

    test('should contain another sub-block', () => {
      const block2 = new Netmask('10.1.2.10/31');
      expect(block.contains(block2)).toBe(true);
    });

    test('should contain a third sub-block', () => {
      const block3 = new Netmask('10.1.2.20/32');
      expect(block.contains(block3)).toBe(true);
    });
  });

  describe('can describe a block', () => {
    const block = new Netmask('10.1.2.0/24');

    test('should have a specific size', () => {
      expect(block.size).toBe(256);
    });

    test('should have a specific base', () => {
      expect(block.base).toBe('10.1.2.0');
    });

    test('should have a specific mask', () => {
      expect(block.mask).toBe('255.255.255.0');
    });

    test('should have a specific host mask', () => {
      expect(block.hostmask).toBe('0.0.0.255');
    });

    test('should have a specific first ip', () => {
      expect(block.first).toBe('10.1.2.1');
    });

    test('should have a specific last ip', () => {
      expect(block.last).toBe('10.1.2.254');
    });

    test('should have a specific broadcast', () => {
      expect(block.broadcast).toBe('10.1.2.255');
    });
  });

  describe('when presented with an octet which is not a number', () => {
    const block = new Netmask('192.168.0.0/29');

    test('should throw on invalid octet in contains()', () => {
      expect(() => block.contains('192.168.~.4')).toThrow(Error);
    });
  });

  // RFC compliance tests - non-standard formats should be rejected per RFC 3986 Section 7.4
  describe('RFC compliance - rejects non-standard IPv4 formats', () => {
    const block = new Netmask('192.168.1.0/24');

    describe('octal format rejection (security)', () => {
      test('should reject IPv4 with leading zeros (octal-like)', () => {
        expect(() => block.contains('031.0.5.5')).toThrow('leading zeros');
      });
      test('should reject multi-digit octets with leading zeros', () => {
        expect(() => block.contains('0177.0.0.2')).toThrow('Invalid IP format');
      });
      test('should reject any octet with leading zero', () => {
        expect(() => block.contains('01.02.03.04')).toThrow('leading zeros');
      });
    });

    describe('hexadecimal format rejection (security)', () => {
      test('should reject hexadecimal IPv4 format', () => {
        expect(() => block.contains('0x31.0.5.5')).toThrow('Invalid IP format');
      });
      test('should reject mixed hex format', () => {
        expect(() => block.contains('0x7f.0.0.0x2')).toThrow(
          'Invalid IP format'
        );
      });
      test('should reject all-hex format', () => {
        expect(() => block.contains('0x1.0x2.0x3.0x4')).toThrow(
          'Invalid IP format'
        );
      });
    });

    describe('valid decimal format acceptance', () => {
      test('should accept standard decimal IPv4', () => {
        expect(block.contains('192.168.1.100')).toBe(true);
      });
      test('should accept edge case decimal values', () => {
        expect(block.contains('0.0.0.0')).toBe(false); // Not in this subnet but valid format
        expect(block.contains('255.255.255.255')).toBe(false); // Not in this subnet but valid format
      });
      test('should work with single digit octets', () => {
        expect(block.contains('1.2.3.4')).toBe(false); // Not in this subnet but valid format
      });
    });
  });

  // Additional RFC compliance tests for subnet mask validation
  describe('RFC 950 subnet mask validation', () => {
    test('should accept valid contiguous subnet masks', () => {
      expect(() => new Netmask('192.168.1.0/24')).not.toThrow();
      expect(() => new Netmask('10.0.0.0/8')).not.toThrow();
      expect(() => new Netmask('172.16.0.0/12')).not.toThrow();
      expect(() => new Netmask('192.168.1.0/255.255.255.0')).not.toThrow();
    });

    test('should reject non-contiguous subnet masks', () => {
      expect(() => new Netmask('192.168.1.0/255.255.0.255')).toThrow(
        'contiguous'
      );
      expect(() => new Netmask('192.168.1.0/255.254.255.0')).toThrow(
        'contiguous'
      );
      // Note: 255.255.255.254 is actually a valid /31 mask (contiguous)
    });

    test('should accept various subnet configurations', () => {
      // The library should automatically calculate network addresses from any IP in the subnet
      expect(() => new Netmask('192.168.1.1/24')).not.toThrow(); // Should calculate 192.168.1.0/24
      expect(() => new Netmask('10.0.0.5/8')).not.toThrow(); // Should calculate 10.0.0.0/8
      expect(() => new Netmask('172.16.1.0/12')).not.toThrow(); // Should calculate 172.16.0.0/12
    });

    test('should accept properly aligned subnet addresses', () => {
      expect(() => new Netmask('192.168.1.0/24')).not.toThrow();
      expect(() => new Netmask('10.0.0.0/8')).not.toThrow();
      expect(() => new Netmask('172.16.0.0/12')).not.toThrow();
    });

    test('should validate CIDR prefix lengths', () => {
      expect(() => new Netmask('192.168.1.0/33')).toThrow(
        'Invalid CIDR notation'
      );
      expect(() => new Netmask('192.168.1.0/-1')).toThrow(
        'Invalid CIDR notation'
      );
      expect(() => new Netmask('192.168.1.0/0')).not.toThrow(); // Valid edge case
      expect(() => new Netmask('192.168.1.0/32')).not.toThrow(); // Valid edge case
    });

    test('should provide descriptive error messages', () => {
      try {
        new Netmask('256.1.1.1/24');
      } catch (error: any) {
        expect(error.message).toContain('must be between 0 and 255');
      }

      try {
        new Netmask('192.168.1.0/255.255.0.255');
      } catch (error: any) {
        expect(error.message).toContain('contiguous');
      }
    });
  });

  // Additional coverage tests for uncovered lines
  describe('Edge cases and error conditions', () => {
    test('should handle invalid input types for constructor', () => {
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => new Netmask(123)).toThrow("Missing 'net' parameter");
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => new Netmask(null)).toThrow("Missing 'net' parameter");
    });

    test('should handle invalid IP input types in ip2long', () => {
      const block = new Netmask('192.168.1.0/24');
      // @ts-expect-error Testing runtime behavior with invalid input
      expect(() => block.contains(123)).toThrow(
        'Invalid IP: must be a non-empty string'
      );
      expect(() => block.contains('')).toThrow(
        'Invalid IP: must be a non-empty string'
      );
    });

    test('should default to /32 when no mask provided', () => {
      const block = new Netmask('192.168.1.100');
      expect(block.bitmask).toBe(32);
      expect(block.size).toBe(1);
    });

    test('should handle CIDR notation in contains method', () => {
      const block = new Netmask('192.168.1.0/24');
      expect(block.contains('192.168.1.0/29')).toBe(true);
      expect(block.contains('10.0.0.0/8')).toBe(false);
    });

    test('should handle invalid IP formats with wrong number of octets', () => {
      const block = new Netmask('192.168.1.0/24');
      expect(() => block.contains('192.168.1')).toThrow('Invalid IP format');
      expect(() => block.contains('192.168.1.1.1')).toThrow(
        'Invalid IP format'
      );
    });

    test('should handle edge case in /31 and /32 networks', () => {
      const net31 = new Netmask('192.168.1.0/31');
      expect(net31.first).toBe('192.168.1.0');
      expect(net31.last).toBe('192.168.1.1');
      expect(net31.broadcast).toBeUndefined();

      const net32 = new Netmask('192.168.1.1/32');
      expect(net32.first).toBe('192.168.1.1');
      expect(net32.last).toBe('192.168.1.1');
      expect(net32.broadcast).toBeUndefined();
    });

    // These tests target specific defensive code paths that are technically unreachable
    // but exist for extra safety in case of runtime manipulation or edge cases
    test('should handle extreme edge cases (defensive programming)', () => {
      // Test the contains method with Netmask objects containing broadcast
      const net = new Netmask('192.168.1.0/24');
      const subnet = new Netmask('192.168.1.128/25');
      expect(net.contains(subnet)).toBe(true);

      // Test /0 network (edge case)
      const globalNet = new Netmask('0.0.0.0/0');
      expect(globalNet.contains('192.168.1.1')).toBe(true);
      expect(globalNet.contains('8.8.8.8')).toBe(true);
    });
  });

  // Test utility methods
  describe('Utility methods', () => {
    const block = new Netmask('192.168.1.0/28'); // Network with 16 IPs

    test('next() should return the next network block', () => {
      const nextBlock = block.next();
      expect(nextBlock.base).toBe('192.168.1.16');
      expect(nextBlock.bitmask).toBe(28);

      const nextBlock2 = block.next(2);
      expect(nextBlock2.base).toBe('192.168.1.32');
    });

    test('forEach() should iterate over all IPs in the network', () => {
      const ips: string[] = [];
      const longs: number[] = [];
      const indices: number[] = [];

      block.forEach((ip, long, index) => {
        ips.push(ip);
        longs.push(long);
        indices.push(index);
      });

      expect(ips.length).toBe(14); // /28 has 14 usable IPs (16 - 2)
      expect(ips[0]).toBe('192.168.1.1'); // First usable IP
      expect(ips[ips.length - 1]).toBe('192.168.1.14'); // Last usable IP
      expect(indices).toEqual(Array.from({ length: 14 }, (_, i) => i));
    });

    test('toString() should return CIDR notation', () => {
      expect(block.toString()).toBe('192.168.1.0/28');

      const singleHost = new Netmask('10.0.0.1/32');
      expect(singleHost.toString()).toBe('10.0.0.1/32');
    });
  });
});
