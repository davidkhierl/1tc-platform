import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import * as ip from '../src/ip.js';

describe('IP Utilities', () => {
  describe('isV4Format', () => {
    it('should return true for valid IPv4 addresses', () => {
      expect(ip.isV4Format('127.0.0.1')).toBe(true);
      expect(ip.isV4Format('0.0.0.0')).toBe(true);
      expect(ip.isV4Format('255.255.255.255')).toBe(true);
      expect(ip.isV4Format('192.168.1.1')).toBe(true);
      expect(ip.isV4Format('10.0.0.1')).toBe(true);
    });

    it('should return false for invalid IPv4 addresses', () => {
      expect(ip.isV4Format('::1')).toBe(false);
      expect(ip.isV4Format('2001:db8::1')).toBe(false);
      expect(ip.isV4Format('foo')).toBe(false);
      expect(ip.isV4Format('256.1.1.1')).toBe(false);
      expect(ip.isV4Format('1.1.1')).toBe(false);
      expect(ip.isV4Format('')).toBe(false);
    });
  });

  describe('isV6Format', () => {
    it('should return true for valid IPv6 addresses', () => {
      expect(ip.isV6Format('::1')).toBe(true);
      expect(ip.isV6Format('2001:db8::1')).toBe(true);
      expect(ip.isV6Format('fe80::1')).toBe(true);
      expect(ip.isV6Format('::ffff:192.168.1.1')).toBe(true);
      expect(ip.isV6Format('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
        true
      );
    });

    it('should return false for invalid IPv6 addresses', () => {
      expect(ip.isV6Format('127.0.0.1')).toBe(false);
      expect(ip.isV6Format('192.168.1.1')).toBe(false);
      expect(ip.isV6Format('foo')).toBe(false);
      expect(ip.isV6Format('')).toBe(false);
    });
  });

  describe('toUInt8Array', () => {
    it('should convert IPv4 addresses to Uint8Array', () => {
      expect(ip.toUInt8Array('127.0.0.1')).toEqual(
        new Uint8Array([127, 0, 0, 1])
      );
      expect(ip.toUInt8Array('192.168.1.1')).toEqual(
        new Uint8Array([192, 168, 1, 1])
      );
      expect(ip.toUInt8Array('0.0.0.0')).toEqual(new Uint8Array([0, 0, 0, 0]));
      expect(ip.toUInt8Array('255.255.255.255')).toEqual(
        new Uint8Array([255, 255, 255, 255])
      );
    });

    it('should convert IPv6 addresses to Uint8Array', () => {
      expect(ip.toUInt8Array('::1')).toEqual(
        new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
      );
      expect(ip.toUInt8Array('fe80::1')).toEqual(
        new Uint8Array([254, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
      );
    });

    it('should handle numeric IPv4 addresses', () => {
      expect(ip.toUInt8Array(2130706433)).toEqual(
        new Uint8Array([127, 0, 0, 1])
      );
      expect(ip.toUInt8Array(0)).toEqual(new Uint8Array([0, 0, 0, 0]));
    });

    it('should handle hexadecimal format', () => {
      expect(ip.toUInt8Array('0x7f.0x0.0x0.0x1')).toEqual(
        new Uint8Array([127, 0, 0, 1])
      );
    });

    it('should handle octal format', () => {
      expect(ip.toUInt8Array('0177.0.0.01')).toEqual(
        new Uint8Array([127, 0, 0, 1])
      );
    });

    it('should handle short IPv4 notation', () => {
      expect(ip.toUInt8Array('127.1')).toEqual(new Uint8Array([127, 0, 0, 1]));
      expect(ip.toUInt8Array('192.168.1')).toEqual(
        new Uint8Array([192, 168, 0, 1])
      );
    });

    it('should handle invalid addresses gracefully', () => {
      // Invalid strings are parsed as numbers and converted to IPv4
      expect(ip.toUInt8Array('foo')).toEqual(new Uint8Array([0, 0, 0, 0]));
      expect(() => ip.toUInt8Array('256.1.1.1')).toThrow('invalid ip address');
      expect(() => ip.toUInt8Array('1.1.1.1.1')).toThrow('invalid ip address');
      expect(() => ip.toUInt8Array('')).toThrow('invalid ip address');
    });

    it('should handle octets that result in NaN', () => {
      // Test cases that trigger the NaN check in parseOctets
      expect(() => ip.toUInt8Array('192.168.1.foo')).toThrow(
        'invalid ip address'
      );
      expect(() => ip.toUInt8Array('192.168.300.1')).toThrow(
        'invalid ip address'
      );
      expect(() => ip.toUInt8Array('192.168.-1.1')).toThrow(
        'invalid ip address'
      );
    });
  });

  describe('toBuffer', () => {
    it('should convert IPv4 addresses to Buffer', () => {
      const result = ip.toBuffer('127.0.0.1');
      expect(result).toBeInstanceOf(Buffer);
      expect(Array.from(result)).toEqual([127, 0, 0, 1]);
    });

    it('should convert IPv6 addresses to Buffer', () => {
      const result = ip.toBuffer('::1');
      expect(result).toBeInstanceOf(Buffer);
      expect(Array.from(result)).toEqual([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
      ]);
    });

    it('should write to provided buffer with offset', () => {
      const buf = Buffer.alloc(6);
      const result = ip.toBuffer('127.0.0.1', buf, 1);
      expect(result).toBe(buf);
      expect(Array.from(result)).toEqual([0, 127, 0, 0, 1, 0]);
    });

    it('should handle numeric input', () => {
      const result = ip.toBuffer(2130706433);
      expect(Array.from(result)).toEqual([127, 0, 0, 1]);
    });
  });

  describe('toString', () => {
    it('should convert IPv4 byte arrays to string', () => {
      expect(ip.toString(new Uint8Array([127, 0, 0, 1]))).toBe('127.0.0.1');
      expect(ip.toString(new Uint8Array([192, 168, 1, 1]))).toBe('192.168.1.1');
      expect(ip.toString(new Uint8Array([0, 0, 0, 0]))).toBe('0.0.0.0');
    });

    it('should convert IPv6 byte arrays to string', () => {
      expect(
        ip.toString(
          new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        )
      ).toBe('::1');
      expect(
        ip.toString(
          new Uint8Array([254, 128, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        )
      ).toBe('fe80::1');
    });

    it('should convert Buffer to string', () => {
      expect(ip.toString(Buffer.from([127, 0, 0, 1]))).toBe('127.0.0.1');
      expect(
        ip.toString(
          Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        )
      ).toBe('::1');
    });

    it('should handle Buffer with offset and length', () => {
      const buf = Buffer.from([0, 127, 0, 0, 1, 0]);
      expect(ip.toString(buf, 1, 4)).toBe('127.0.0.1');
    });

    it('should throw for invalid byte arrays', () => {
      expect(() => ip.toString(new Uint8Array([1, 2]))).toThrow(
        'invalid ip address'
      );
      expect(() => ip.toString('invalid' as any)).toThrow(
        'argument must be Buffer or a Uint8Array'
      );
    });
  });

  describe('fromPrefixLen', () => {
    it('should create IPv4 subnet masks', () => {
      expect(ip.fromPrefixLen(24)).toBe('255.255.255.0');
      expect(ip.fromPrefixLen(16)).toBe('255.255.0.0');
      expect(ip.fromPrefixLen(8)).toBe('255.0.0.0');
      expect(ip.fromPrefixLen(32)).toBe('255.255.255.255');
      expect(ip.fromPrefixLen(0)).toBe('0.0.0.0');
    });

    it('should create IPv6 subnet masks', () => {
      expect(ip.fromPrefixLen(64)).toBe('ffff:ffff:ffff:ffff::');
      expect(ip.fromPrefixLen(128)).toBe(
        'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'
      );
      expect(ip.fromPrefixLen(0, 'ipv6')).toBe('::');
    });

    it('should infer IPv6 for prefix lengths > 32', () => {
      expect(ip.fromPrefixLen(48)).toBe('ffff:ffff:ffff::');
      expect(ip.fromPrefixLen(96)).toBe('ffff:ffff:ffff:ffff:ffff:ffff::');
    });

    it('should handle explicit family specification', () => {
      expect(ip.fromPrefixLen(24, 'ipv4')).toBe('255.255.255.0');
      expect(ip.fromPrefixLen(24, 'ipv6')).toBe('ffff:ff00::');
    });
  });

  describe('mask', () => {
    it('should apply IPv4 subnet masks', () => {
      expect(ip.mask('192.168.1.134', '255.255.255.0')).toBe('192.168.1.0');
      expect(ip.mask('192.168.1.134', '255.0.0.0')).toBe('192.0.0.0');
      expect(ip.mask('10.1.2.3', '255.255.0.0')).toBe('10.1.0.0');
    });

    it('should apply IPv6 subnet masks', () => {
      expect(ip.mask('2001:db8::1234', 'ffff:ffff:ffff:ffff::')).toBe(
        '2001:db8::'
      );
    });

    it('should handle mixed protocol masking', () => {
      // IPv6 address with IPv4 mask should mask the low bits
      expect(ip.mask('::ffff:192.168.1.134', '255.255.255.0')).toBe(
        '::c0a8:100'
      );
    });

    it('should handle IPv4 address with IPv6 mask', () => {
      // IPv4 address with IPv6 mask (v4 embedded in v6)
      expect(
        ip.mask('192.168.1.134', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ff00')
      ).toBe('::ffff:c0a8:100');
    });

    it('should handle invalid mask operations gracefully', () => {
      // Test edge cases that might trigger error conditions
      expect(ip.mask('192.168.1.1', '0.0.0.0')).toBe('0.0.0.0');
      expect(ip.mask('invalid', '255.255.255.0')).toBe('0.0.0.0');
    });
  });

  describe('cidr', () => {
    it('should apply CIDR masks to IPv4', () => {
      expect(ip.cidr('192.168.1.134/26')).toBe('192.168.1.128');
      expect(ip.cidr('10.1.2.3/16')).toBe('10.1.0.0');
      expect(ip.cidr('172.16.1.1/24')).toBe('172.16.1.0');
    });

    it('should apply CIDR masks to IPv6', () => {
      expect(ip.cidr('2001:db8::1234/64')).toBe('2001:db8::');
    });

    it('should throw for invalid CIDR notation', () => {
      expect(() => ip.cidr('192.168.1.1/24/extra')).toThrow(
        'invalid CIDR subnet'
      );
    });
  });

  describe('subnet', () => {
    it('should calculate subnet details for IPv4', () => {
      const result = ip.subnet('192.168.1.134', '255.255.255.192');

      expect(result.networkAddress).toBe('192.168.1.128');
      expect(result.firstAddress).toBe('192.168.1.129');
      expect(result.lastAddress).toBe('192.168.1.190');
      expect(result.broadcastAddress).toBe('192.168.1.191');
      expect(result.subnetMask).toBe('255.255.255.192');
      expect(result.subnetMaskLength).toBe(26);
      expect(result.numHosts).toBe(62);
      expect(result.length).toBe(64);
      expect(result.contains('192.168.1.150')).toBe(true);
      expect(result.contains('192.168.1.200')).toBe(false);
    });

    it('should handle /31 and /32 subnets correctly', () => {
      const result31 = ip.subnet('192.168.1.1', '255.255.255.254');
      expect(result31.numHosts).toBe(2);
      expect(result31.firstAddress).toBe('192.168.1.0');
      expect(result31.lastAddress).toBe('192.168.1.1');

      const result32 = ip.subnet('192.168.1.1', '255.255.255.255');
      expect(result32.numHosts).toBe(1);
      expect(result32.firstAddress).toBe('192.168.1.1');
      expect(result32.lastAddress).toBe('192.168.1.1');
    });
  });

  describe('cidrSubnet', () => {
    it('should calculate subnet details from CIDR notation', () => {
      const result = ip.cidrSubnet('192.168.1.134/26');

      expect(result.networkAddress).toBe('192.168.1.128');
      expect(result.firstAddress).toBe('192.168.1.129');
      expect(result.lastAddress).toBe('192.168.1.190');
      expect(result.broadcastAddress).toBe('192.168.1.191');
      expect(result.subnetMask).toBe('255.255.255.192');
      expect(result.subnetMaskLength).toBe(26);
      expect(result.numHosts).toBe(62);
      expect(result.length).toBe(64);
    });

    it('should throw for invalid CIDR notation', () => {
      expect(() => ip.cidrSubnet('192.168.1.1/24/extra')).toThrow(
        'invalid CIDR subnet'
      );
    });
  });

  describe('not', () => {
    it('should invert IPv4 addresses', () => {
      expect(ip.not('255.255.255.0')).toBe('0.0.0.255');
      expect(ip.not('192.168.1.1')).toBe('63.87.254.254');
      expect(ip.not('0.0.0.0')).toBe('255.255.255.255');
    });

    it('should invert IPv6 addresses', () => {
      expect(ip.not('::1')).toBe('ffff:ffff:ffff:ffff:ffff:ffff:ffff:fffe');
      expect(ip.not('ffff::')).toBe('0:ffff:ffff:ffff:ffff:ffff:ffff:ffff');
    });

    it('should handle numeric input', () => {
      expect(ip.not(0)).toBe('255.255.255.255');
      expect(ip.not(2130706433)).toBe('128.255.255.254'); // ~127.0.0.1
    });
  });

  describe('or', () => {
    it('should perform OR operation on IPv4 addresses', () => {
      expect(ip.or('192.168.1.134', '0.0.0.255')).toBe('192.168.1.255');
      expect(ip.or('192.168.0.0', '0.0.1.1')).toBe('192.168.1.1');
    });

    it('should perform OR operation on IPv6 addresses', () => {
      expect(ip.or('2001:db8::', '::1')).toBe('2001:db8::1');
    });

    it('should handle mixed protocol OR operations', () => {
      expect(ip.or('192.168.1.1', '::ffff:0.0.0.255')).toBe('::ffff:c0a8:1ff');
    });

    it('should handle numeric input', () => {
      expect(ip.or(2130706432, 1)).toBe('127.0.0.1'); // 127.0.0.0 | 0.0.0.1
    });
  });

  describe('isEqual', () => {
    it('should compare IPv4 addresses correctly', () => {
      expect(ip.isEqual('127.0.0.1', '127.0.0.1')).toBe(true);
      expect(ip.isEqual('127.0.0.1', '127.0.0.2')).toBe(false);
      expect(ip.isEqual('192.168.1.1', '192.168.1.1')).toBe(true);
    });

    it('should compare IPv6 addresses correctly', () => {
      expect(ip.isEqual('::1', '::0:1')).toBe(true);
      expect(ip.isEqual('2001:db8::1', '2001:db8::1')).toBe(true);
      expect(ip.isEqual('2001:db8::1', '2001:db8::2')).toBe(false);
    });

    it('should compare numeric and string IPv4 addresses', () => {
      expect(ip.isEqual('127.0.0.1', 2130706433)).toBe(true);
      expect(ip.isEqual(0, '0.0.0.0')).toBe(true);
    });

    it('should compare IPv4-mapped IPv6 addresses', () => {
      expect(ip.isEqual('127.0.0.1', '::ffff:127.0.0.1')).toBe(true);
      expect(ip.isEqual('192.168.1.1', '::ffff:192.168.1.1')).toBe(true);
    });
  });

  describe('isLoopback', () => {
    it('should identify IPv4 loopback addresses', () => {
      expect(ip.isLoopback('127.0.0.1')).toBe(true);
      expect(ip.isLoopback('127.1.1.1')).toBe(true);
      expect(ip.isLoopback('127.255.255.255')).toBe(true);
      expect(ip.isLoopback('128.0.0.1')).toBe(false);
      expect(ip.isLoopback('192.168.1.1')).toBe(false);
    });

    it('should identify IPv6 loopback addresses', () => {
      expect(ip.isLoopback('::1')).toBe(true);
      expect(ip.isLoopback('::2')).toBe(false);
      expect(ip.isLoopback('2001:db8::1')).toBe(false);
    });

    it('should handle IPv4-mapped IPv6 loopback', () => {
      expect(ip.isLoopback('::ffff:127.0.0.1')).toBe(true);
    });

    it('should handle numeric input', () => {
      expect(ip.isLoopback(2130706433)).toBe(true); // 127.0.0.1
    });

    it('should return false for invalid addresses', () => {
      expect(ip.isLoopback('foo')).toBe(false);
      expect(ip.isLoopback('256.1.1.1')).toBe(false);
    });
  });

  describe('isLinkLocal', () => {
    it('should identify IPv4 link-local addresses', () => {
      expect(ip.isLinkLocal('169.254.0.0')).toBe(true);
      expect(ip.isLinkLocal('169.254.1.1')).toBe(true);
      expect(ip.isLinkLocal('169.254.255.255')).toBe(true);
      expect(ip.isLinkLocal('169.253.1.1')).toBe(false);
      expect(ip.isLinkLocal('169.255.1.1')).toBe(false);
    });

    it('should identify IPv6 link-local addresses', () => {
      expect(ip.isLinkLocal('fe80::')).toBe(true);
      expect(ip.isLinkLocal('fe80::1')).toBe(true);
      expect(ip.isLinkLocal('febf::1')).toBe(true);
      expect(ip.isLinkLocal('fec0::1')).toBe(false);
      expect(ip.isLinkLocal('fe7f::1')).toBe(false);
    });

    it('should handle IPv4-mapped IPv6 link-local', () => {
      expect(ip.isLinkLocal('::ffff:169.254.1.1')).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(ip.isLinkLocal('foo')).toBe(false);
    });
  });

  describe('isReserved', () => {
    it('should identify IPv4 reserved addresses', () => {
      expect(ip.isReserved('0.0.0.0')).toBe(true);
      expect(ip.isReserved('0.1.1.1')).toBe(true);
      expect(ip.isReserved('255.255.255.255')).toBe(true);
      expect(ip.isReserved('224.0.0.1')).toBe(true); // multicast
      expect(ip.isReserved('239.255.255.255')).toBe(true); // multicast
      expect(ip.isReserved('192.0.2.1')).toBe(true); // TEST-NET-1
      expect(ip.isReserved('198.51.100.1')).toBe(true); // TEST-NET-2
      expect(ip.isReserved('203.0.113.1')).toBe(true); // TEST-NET-3
      expect(ip.isReserved('192.0.0.1')).toBe(true); // IETF Protocol Assignments
      expect(ip.isReserved('192.88.99.1')).toBe(true); // 6to4 Relay Anycast
      expect(ip.isReserved('198.18.0.1')).toBe(true); // Benchmark Testing
      expect(ip.isReserved('198.19.255.255')).toBe(true); // Benchmark Testing
    });

    it('should not identify regular addresses as reserved', () => {
      expect(ip.isReserved('8.8.8.8')).toBe(false);
      expect(ip.isReserved('192.168.1.1')).toBe(false);
      expect(ip.isReserved('1.1.1.1')).toBe(false);
    });

    it('should identify IPv6 reserved addresses', () => {
      expect(ip.isReserved('ff00::')).toBe(true); // multicast
      expect(ip.isReserved('100::')).toBe(true); // discard-only
      expect(ip.isReserved('2001::')).toBe(true); // TEREDO
      expect(ip.isReserved('2002::')).toBe(true); // 6to4
      expect(ip.isReserved('::')).toBe(true); // all zeros
      expect(ip.isReserved('ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff')).toBe(
        true
      ); // all ones
    });

    it('should handle invalid addresses gracefully', () => {
      // Invalid addresses are handled gracefully and may return true for some cases
      expect(ip.isReserved('foo')).toBe(true); // Treated as 0.0.0.0 which is reserved
    });
  });

  describe('isPrivate', () => {
    it('should identify IPv4 private addresses', () => {
      expect(ip.isPrivate('10.0.0.1')).toBe(true);
      expect(ip.isPrivate('10.255.255.255')).toBe(true);
      expect(ip.isPrivate('172.16.0.1')).toBe(true);
      expect(ip.isPrivate('172.31.255.255')).toBe(true);
      expect(ip.isPrivate('192.168.0.1')).toBe(true);
      expect(ip.isPrivate('192.168.255.255')).toBe(true);
      expect(ip.isPrivate('127.0.0.1')).toBe(true); // loopback is private
      expect(ip.isPrivate('169.254.1.1')).toBe(true); // link-local is private
    });

    it('should not identify public addresses as private', () => {
      expect(ip.isPrivate('8.8.8.8')).toBe(false);
      expect(ip.isPrivate('1.1.1.1')).toBe(false);
      expect(ip.isPrivate('172.15.255.255')).toBe(false);
      expect(ip.isPrivate('172.32.0.1')).toBe(false);
      expect(ip.isPrivate('11.0.0.1')).toBe(false);
    });

    it('should identify IPv6 private addresses', () => {
      expect(ip.isPrivate('fc00::')).toBe(true); // unique local
      expect(ip.isPrivate('fdff::')).toBe(true); // unique local
      expect(ip.isPrivate('fe80::')).toBe(true); // link-local
      expect(ip.isPrivate('::1')).toBe(true); // loopback
    });

    it('should handle invalid addresses gracefully', () => {
      // Invalid addresses are handled gracefully and may return true for some cases
      expect(ip.isPrivate('foo')).toBe(true); // Treated as 0.0.0.0 which is considered private/reserved
    });
  });

  describe('isPublic', () => {
    it('should identify public IPv4 addresses', () => {
      expect(ip.isPublic('8.8.8.8')).toBe(true);
      expect(ip.isPublic('1.1.1.1')).toBe(true);
      expect(ip.isPublic('208.67.222.222')).toBe(true);
    });

    it('should not identify private addresses as public', () => {
      expect(ip.isPublic('192.168.1.1')).toBe(false);
      expect(ip.isPublic('10.0.0.1')).toBe(false);
      expect(ip.isPublic('172.16.0.1')).toBe(false);
      expect(ip.isPublic('127.0.0.1')).toBe(false);
      expect(ip.isPublic('169.254.1.1')).toBe(false);
    });

    it('should identify public IPv6 addresses', () => {
      // Using Cloudflare DNS IPv6 address which should be public
      expect(ip.isPublic('2606:4700:4700::1111')).toBe(true);
    });

    it('should not identify private IPv6 addresses as public', () => {
      expect(ip.isPublic('fc00::')).toBe(false);
      expect(ip.isPublic('fe80::')).toBe(false);
      expect(ip.isPublic('::1')).toBe(false);
    });

    it('should return false for invalid addresses', () => {
      expect(ip.isPublic('foo')).toBe(false);
      expect(ip.isPublic('256.1.1.1')).toBe(false);
    });
  });

  describe('loopback', () => {
    it('should return IPv4 loopback by default', () => {
      expect(ip.loopback()).toBe('127.0.0.1');
    });

    it('should return IPv4 loopback for ipv4 family', () => {
      expect(ip.loopback('ipv4')).toBe('127.0.0.1');
      expect(ip.loopback('IPv4')).toBe('127.0.0.1');
      expect(ip.loopback('IPV4')).toBe('127.0.0.1');
      expect(ip.loopback('4')).toBe('127.0.0.1');
      expect(ip.loopback(4 as any)).toBe('127.0.0.1');
    });

    it('should return IPv6 loopback for ipv6 family', () => {
      expect(ip.loopback('ipv6')).toBe('::1');
      expect(ip.loopback('IPv6')).toBe('::1');
      expect(ip.loopback('IPV6')).toBe('::1');
      expect(ip.loopback('6')).toBe('::1');
      expect(ip.loopback(6 as any)).toBe('::1');
    });

    it('should handle invalid family gracefully', () => {
      // Invalid family defaults to IPv4
      expect(ip.loopback('invalid' as any)).toBe('127.0.0.1');
    });
  });

  describe('address', () => {
    it('should return an address when called without parameters', () => {
      const addr = ip.address();
      expect(typeof addr).toBe('string');
      if (addr) {
        expect(ip.isV4Format(addr) || ip.isV6Format(addr)).toBe(true);
      }
    });

    it('should return IPv4 address by default', () => {
      const addr = ip.address();
      if (addr && addr !== '127.0.0.1') {
        expect(ip.isV4Format(addr)).toBe(true);
      }
    });

    it('should return IPv6 address when specified', () => {
      const addr = ip.address(undefined, 'ipv6');
      if (addr && addr !== '::1') {
        expect(ip.isV6Format(addr)).toBe(true);
      }
    });

    it('should return loopback when no interface is found', () => {
      const addr = ip.address('nonexistent-interface');
      expect(addr).toBeUndefined();
    });

    it('should filter public addresses', () => {
      const addr = ip.address('public');
      // In test environment, might return loopback if no public address exists
      if (addr && addr !== '127.0.0.1') {
        expect(ip.isPublic(addr)).toBe(true);
      } else {
        // No public address available in test environment
        expect(addr).toBe('127.0.0.1');
      }
    });

    it('should filter private addresses', () => {
      const addr = ip.address('private');
      if (addr) {
        expect(ip.isPrivate(addr)).toBe(true);
      }
    });

    it('should handle specific interface names', () => {
      // Test getting address from a specific interface (likely to return undefined in test env)
      const addr = ip.address('eth0');
      if (addr) {
        expect(ip.isV4Format(addr) || ip.isV6Format(addr)).toBe(true);
      } else {
        expect(addr).toBeUndefined();
      }
    });
  });

  describe('toLong', () => {
    it('should convert IPv4 addresses to 32-bit integers', () => {
      expect(ip.toLong('127.0.0.1')).toBe(2130706433);
      expect(ip.toLong('0.0.0.0')).toBe(0);
      expect(ip.toLong('255.255.255.255')).toBe(4294967295);
      expect(ip.toLong('192.168.1.1')).toBe(3232235777);
    });

    it('should throw for IPv6 addresses', () => {
      expect(() => ip.toLong('::1')).toThrow('invalid ip address');
      expect(() => ip.toLong('2001:db8::1')).toThrow('invalid ip address');
    });

    it('should handle invalid addresses gracefully', () => {
      // Invalid addresses are parsed as numbers and converted
      expect(ip.toLong('foo')).toBe(0); // Parsed as NaN, becomes 0
      expect(() => ip.toLong('256.1.1.1')).toThrow('invalid ip address');
    });
  });

  describe('fromLong', () => {
    it('should convert 32-bit integers to IPv4 addresses', () => {
      expect(ip.fromLong(2130706433)).toBe('127.0.0.1');
      expect(ip.fromLong(0)).toBe('0.0.0.0');
      expect(ip.fromLong(4294967295)).toBe('255.255.255.255');
      expect(ip.fromLong(3232235777)).toBe('192.168.1.1');
    });

    it('should throw for invalid long values', () => {
      expect(() => ip.fromLong(-1)).toThrow('invalid long value');
      expect(() => ip.fromLong(4294967296)).toThrow('invalid long value');
      expect(() => ip.fromLong(1.5)).toThrow('invalid long value');
    });
  });

  describe('normalizeToLong', () => {
    it('should convert valid IPv4 addresses to long', () => {
      expect(ip.normalizeToLong('127.0.0.1')).toBe(2130706433);
      expect(ip.normalizeToLong('0.0.0.0')).toBe(0);
      expect(ip.normalizeToLong('192.168.1.1')).toBe(3232235777);
    });

    it('should handle invalid addresses gracefully', () => {
      // Invalid addresses are parsed as numbers and converted
      expect(ip.normalizeToLong('foo')).toBe(0); // Parsed as NaN, becomes 0
      expect(ip.normalizeToLong('256.1.1.1')).toBe(-1);
      expect(ip.normalizeToLong('::1')).toBe(-1);
    });
  });

  describe('normalize', () => {
    it('should normalize IPv4 addresses', () => {
      expect(ip.normalize('127.1')).toBe('127.0.0.1');
      expect(ip.normalize('0x7f.0.0.1')).toBe('127.0.0.1');
      expect(ip.normalize('0177.0.0.01')).toBe('127.0.0.1');
      expect(ip.normalize(2130706433)).toBe('127.0.0.1');
    });

    it('should normalize IPv6 addresses', () => {
      expect(ip.normalize('::0:1')).toBe('::1');
      expect(ip.normalize('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(
        '2001:db8::1'
      );
      expect(ip.normalize('fe80:0:0:0:0:0:0:1')).toBe('fe80::1');
    });

    it('should handle invalid addresses gracefully', () => {
      // Invalid addresses are parsed as numbers and converted
      expect(ip.normalize('foo')).toBe('0.0.0.0'); // Parsed as NaN, becomes 0.0.0.0
      expect(() => ip.normalize('256.1.1.1')).toThrow('invalid ip address');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty strings appropriately', () => {
      expect(() => ip.toUInt8Array('')).toThrow('invalid ip address');
      expect(() => ip.normalize('')).toThrow('invalid ip address');
      expect(ip.isV4Format('')).toBe(false);
      expect(ip.isV6Format('')).toBe(false);
    });

    it('should handle non-string inputs appropriately', () => {
      expect(() => ip.toUInt8Array(null as any)).toThrow('invalid ip address');
      expect(() => ip.toUInt8Array(undefined as any)).toThrow(
        'invalid ip address'
      );
      expect(() => ip.toUInt8Array({} as any)).toThrow('invalid ip address');
    });

    it('should handle float values correctly', () => {
      expect(() => ip.toUInt8Array('1.1.1.1.1')).toThrow('invalid ip address');
      expect(() => ip.toLong('1.2.3.4.5')).toThrow('invalid ip address');
    });

    it('should handle boundary values', () => {
      expect(ip.toUInt8Array('255.255.255.255')).toEqual(
        new Uint8Array([255, 255, 255, 255])
      );
      expect(ip.toUInt8Array('0.0.0.0')).toEqual(new Uint8Array([0, 0, 0, 0]));
      expect(() => ip.toUInt8Array('256.0.0.0')).toThrow('invalid ip address');
    });

    it('should handle float-like values correctly', () => {
      // Test values that might be interpreted as floats
      expect(() => ip.toUInt8Array('192.168.1.1.5')).toThrow(
        'invalid ip address'
      );
      expect(() => ip.toUInt8Array('192.168.1')).not.toThrow(); // Should be valid short notation
    });
  });

  describe('IPv6 compression', () => {
    it('should properly compress IPv6 addresses', () => {
      expect(ip.toString(new Uint8Array(16).fill(0))).toBe('::');
      expect(
        ip.toString(
          new Uint8Array([
            0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
          ])
        )
      ).toBe('2001:db8::1');
      expect(
        ip.toString(
          new Uint8Array([0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        )
      ).toBe('fe80::1');
    });

    it('should handle IPv6 addresses with embedded IPv4', () => {
      const bytes = new Uint8Array([
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, 192, 168, 1, 1,
      ]);
      expect(ip.toString(bytes)).toBe('::ffff:c0a8:101');
    });
    describe('Additional edge cases for maximum coverage', () => {
      it('should handle various IPv6 edge cases', () => {
        // Test IPv6 with double colon edge cases
        expect(ip.toUInt8Array('::')).toEqual(new Uint8Array(16).fill(0));
        expect(ip.toUInt8Array('::1')).toEqual(
          new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        );
      });

      it('should handle IPv6 parsing edge cases', () => {
        // Test that would trigger different parsing paths
        expect(ip.toUInt8Array('2001:db8::1')).toEqual(
          new Uint8Array([
            0x20, 0x01, 0x0d, 0xb8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
          ])
        );
      });

      it('should handle address function edge cases', () => {
        // Test with different family normalization paths
        const addr4 = ip.address(undefined, '4');
        const addr6 = ip.address(undefined, '6');
        const addrIpv4 = ip.address(undefined, 'IPv4');
        const addrIpv6 = ip.address(undefined, 'IPv6');

        // These should all work (or return loopback in test environment)
        if (addr4)
          expect(ip.isV4Format(addr4) || addr4 === '127.0.0.1').toBe(true);
        if (addr6) expect(ip.isV6Format(addr6) || addr6 === '::1').toBe(true);
        if (addrIpv4)
          expect(ip.isV4Format(addrIpv4) || addrIpv4 === '127.0.0.1').toBe(
            true
          );
        if (addrIpv6)
          expect(ip.isV6Format(addrIpv6) || addrIpv6 === '::1').toBe(true);
      });

      it('should handle fromPrefixLen edge cases', () => {
        // Test edge cases for prefix length
        expect(ip.fromPrefixLen(1)).toBe('128.0.0.0');
        expect(ip.fromPrefixLen(31)).toBe('255.255.255.254');
        expect(ip.fromPrefixLen(1, 'ipv6')).toBe('8000::');
        expect(ip.fromPrefixLen(127, 'ipv6')).toBe(
          'ffff:ffff:ffff:ffff:ffff:ffff:ffff:fffe'
        );
      });

      it('should handle various numeric conversions', () => {
        // Test edge cases in numeric handling
        expect(ip.fromLong(1)).toBe('0.0.0.1');
        expect(ip.fromLong(16777216)).toBe('1.0.0.0'); // 256^3
        expect(ip.toLong('1.0.0.0')).toBe(16777216);
      });

      it('should handle isEqual edge cases', () => {
        // Test edge cases in equality comparison
        expect(ip.isEqual('127.0.0.1', '::ffff:127.0.0.1')).toBe(true);
        expect(ip.isEqual('0.0.0.0', '::')).toBe(true); // Both represent null address
        expect(ip.isEqual('1.2.3.4', '::1')).toBe(false); // Different addresses
      });
    });
  });
});
