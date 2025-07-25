/**
 * Modern TypeScript implementation of IPv4 network mask utilities
 * Complies with RFC 791 (Internet Protocol), RFC 950 (Subnetting),
 * RFC 4632 (CIDR), and RFC 3986 (URI Generic Syntax) standards
 */

/**
 * Converts a 32-bit integer to IPv4 dotted decimal notation
 */
export function long2ip(long: number): string {
  const a = (long & (0xff << 24)) >>> 24;
  const b = (long & (0xff << 16)) >>> 16;
  const c = (long & (0xff << 8)) >>> 8;
  const d = long & 0xff;
  return [a, b, c, d].join('.');
}

/**
 * RFC-compliant IPv4 address to 32-bit integer conversion
 *
 * Implements strict dotted decimal notation parsing per:
 * - RFC 791 (Internet Protocol)
 * - RFC 3986 Section 7.4 (security considerations for rare IP formats)
 *
 * Security: Rejects octal and hexadecimal formats that could lead to
 * address spoofing vulnerabilities in web applications.
 *
 * @param ip - IPv4 address in dotted decimal notation (e.g., "192.168.1.1")
 * @returns 32-bit integer representation
 * @throws Error for invalid or non-standard formats
 */
function ip2long(ip: string): number {
  // Strict validation: only accept dotted decimal notation
  if (typeof ip !== 'string' || ip.length === 0) {
    throw new Error('Invalid IP: must be a non-empty string');
  }

  // Check for valid IPv4 format using strict regex
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) {
    throw new Error(
      `Invalid IP format: ${ip}. Must be dotted decimal notation (e.g., 192.168.1.1)`
    );
  }

  const octets: number[] = [];

  // Parse each octet with strict decimal validation
  for (let i = 1; i <= 4; i++) {
    const octetStr = match[i];
    if (!octetStr) {
      throw new Error('Invalid IP: missing octet');
    }

    // Reject leading zeros (except for "0" itself) to prevent octal interpretation
    if (octetStr.length > 1 && octetStr.charAt(0) === '0') {
      throw new Error(
        `Invalid IP: octet "${octetStr}" has leading zeros. Use standard decimal notation.`
      );
    }

    const value = parseInt(octetStr, 10);

    // Validate octet range (0-255)
    if (value < 0 || value > 255) {
      throw new Error(
        `Invalid IP: octet "${octetStr}" must be between 0 and 255`
      );
    }

    octets.push(value);
  }

  // Convert to 32-bit integer - octets array is guaranteed to have 4 elements
  const [a, b, c, d] = octets;
  if (
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  ) {
    throw new Error('Invalid IP: missing octets');
  }
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/**
 * Validates that a subnet mask is contiguous (RFC 950 standard)
 */
/**
 * Validates that a subnet mask has contiguous 1 bits followed by contiguous 0 bits
 * per RFC 950 requirements
 */
function isValidSubnetMask(mask: number): boolean {
  // Special case: /0 means no mask bits, which is valid
  if (mask === 0) return true;

  // Special case: /32 means all mask bits, which is valid
  if (mask === 0xffffffff) return true;

  // Convert to binary and check for contiguous 1s followed by contiguous 0s
  const binary = (mask >>> 0).toString(2).padStart(32, '0');
  return /^1*0*$/.test(binary);
}

/**
 * RFC-compliant IPv4 network mask utilities with CIDR notation support
 *
 * Implements strict compliance with:
 * - RFC 791: Internet Protocol (basic IPv4 specification)
 * - RFC 950: Internet Standard Subnetting Procedure
 * - RFC 4632: CIDR Address Strategy and Address Aggregation
 * - RFC 3986: Security considerations (rejects non-standard IP formats)
 *
 * Security Features:
 * - Rejects octal/hexadecimal IPv4 formats to prevent address spoofing
 * - Validates subnet masks for contiguous bit patterns
 * - Strict input validation with descriptive error messages
 *
 * @example
 * ```typescript
 * const net = new Netmask('192.168.1.0/24');
 * console.log(net.contains('192.168.1.100')); // true
 * console.log(net.first); // '192.168.1.1'
 * console.log(net.broadcast); // '192.168.1.255'
 * ```
 */
export class Netmask {
  public readonly bitmask: number;
  public readonly maskLong: number;
  public readonly netLong: number;
  public readonly size: number;
  public readonly base: string;
  public readonly mask: string;
  public readonly hostmask: string;
  public readonly first: string;
  public readonly last: string;
  public readonly broadcast?: string;

  constructor(net: string, mask?: string | number) {
    if (typeof net !== 'string') {
      throw new Error("Missing 'net' parameter");
    }

    let networkAddress = net;
    let networkMask = mask;

    // Parse CIDR notation
    if (!networkMask) {
      const parts = net.split('/', 2);
      const networkPart = parts[0];
      if (networkPart) {
        networkAddress = networkPart;
      }
      networkMask = parts[1];
    }

    // Default to /32 if no mask specified
    if (!networkMask) {
      networkMask = 32;
    }

    // Parse mask with improved validation
    if (typeof networkMask === 'string' && networkMask.includes('.')) {
      // Dotted decimal mask - validate RFC compliance
      try {
        this.maskLong = ip2long(networkMask);

        // Validate that it's a proper subnet mask (contiguous bits)
        if (!isValidSubnetMask(this.maskLong)) {
          throw new Error(
            `Invalid subnet mask: ${networkMask}. Subnet mask must have contiguous 1 bits followed by contiguous 0 bits`
          );
        }

        this.bitmask = this.maskLongToBitmask(this.maskLong);
      } catch (error) {
        throw new Error(
          `Invalid mask: ${networkMask}. ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // CIDR notation
      this.bitmask = parseInt(String(networkMask), 10);

      // Validate CIDR range
      if (this.bitmask < 0 || this.bitmask > 32) {
        throw new Error(
          `Invalid CIDR notation: /${this.bitmask}. Must be between 0 and 32`
        );
      }

      if (this.bitmask > 0) {
        this.maskLong = (0xffffffff << (32 - this.bitmask)) >>> 0;
      } else {
        this.maskLong = 0;
      }
    }

    // Parse network address
    try {
      const addressLong = ip2long(networkAddress);
      this.netLong = (addressLong & this.maskLong) >>> 0;
    } catch (error) {
      throw new Error(
        `Invalid net address: ${networkAddress}. ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Calculate network properties
    this.size = Math.pow(2, 32 - this.bitmask);
    this.base = long2ip(this.netLong);
    this.mask = long2ip(this.maskLong);
    this.hostmask = long2ip(~this.maskLong);

    // Calculate first and last usable addresses
    if (this.bitmask <= 30) {
      this.first = long2ip(this.netLong + 1);
      this.last = long2ip(this.netLong + this.size - 2);
      this.broadcast = long2ip(this.netLong + this.size - 1);
    } else {
      this.first = this.base;
      this.last = long2ip(this.netLong + this.size - 1);
    }
  }

  /**
   * Converts a mask in long format to bitmask notation
   */
  private maskLongToBitmask(maskLong: number): number {
    for (let i = 32; i >= 0; i--) {
      if (maskLong === (0xffffffff << (32 - i)) >>> 0) {
        return i;
      }
    }
    throw new Error('Invalid subnet mask');
  }

  /**
   * Checks if an IP address or network is contained within this network
   * Uses strict RFC-compliant IPv4 address validation
   */
  contains(ip: string | Netmask): boolean {
    if (
      typeof ip === 'string' &&
      (ip.includes('/') || ip.split('.').length !== 4)
    ) {
      return this.contains(new Netmask(ip));
    }

    if (ip instanceof Netmask) {
      return this.contains(ip.base) && this.contains(ip.broadcast || ip.last);
    }

    try {
      const ipLong = ip2long(ip);
      return (
        (ipLong & this.maskLong) >>> 0 === (this.netLong & this.maskLong) >>> 0
      );
    } catch (error) {
      // Invalid IP format
      throw new Error(
        `Invalid IP address: ${ip}. ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Returns the next network block
   */
  next(count: number = 1): Netmask {
    return new Netmask(long2ip(this.netLong + this.size * count), this.mask);
  }

  /**
   * Iterates over all IP addresses in the network
   */
  forEach(callback: (ip: string, long: number, index: number) => void): void {
    let currentLong = ip2long(this.first);
    const lastLong = ip2long(this.last);
    let index = 0;

    while (currentLong <= lastLong) {
      callback(long2ip(currentLong), currentLong, index);
      index++;
      currentLong++;
    }
  }

  /**
   * Returns the network in CIDR notation
   */
  toString(): string {
    return `${this.base}/${this.bitmask}`;
  }
}
