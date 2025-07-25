/**
 * Modern TypeScript implementation of IPv4 network mask utilities
 */

type ParseResult = [number, number];

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
 * Converts IPv4 dotted decimal notation to a 32-bit integer
 */
export function ip2long(ip: string): number {
  const octets: number[] = [];
  let remaining = ip;

  for (let i = 0; i <= 3; i++) {
    if (remaining.length === 0) {
      break;
    }

    if (i > 0) {
      const firstChar = remaining.charAt(0);
      if (firstChar !== '.') {
        throw new Error('Invalid IP');
      }
      remaining = remaining.substring(1);
    }

    const [value, consumed] = parseOctet(remaining);
    remaining = remaining.substring(consumed);
    octets.push(value);
  }

  if (remaining.length !== 0) {
    throw new Error('Invalid IP');
  }

  switch (octets.length) {
    case 1: {
      const octet0 = octets[0];
      if (octet0 === undefined || octet0 > 0xffffffff) {
        throw new Error('Invalid IP');
      }
      return octet0 >>> 0;
    }

    case 2: {
      const [octet0, octet1] = octets;
      if (
        octet0 === undefined ||
        octet1 === undefined ||
        octet0 > 0xff ||
        octet1 > 0xffffff
      ) {
        throw new Error('Invalid IP');
      }
      return ((octet0 << 24) | octet1) >>> 0;
    }

    case 3: {
      const [octet0, octet1, octet2] = octets;
      if (
        octet0 === undefined ||
        octet1 === undefined ||
        octet2 === undefined ||
        octet0 > 0xff ||
        octet1 > 0xff ||
        octet2 > 0xffff
      ) {
        throw new Error('Invalid IP');
      }
      return ((octet0 << 24) | (octet1 << 16) | octet2) >>> 0;
    }

    case 4: {
      const [octet0, octet1, octet2, octet3] = octets;
      if (
        octet0 === undefined ||
        octet1 === undefined ||
        octet2 === undefined ||
        octet3 === undefined ||
        octets.some(octet => octet > 0xff)
      ) {
        throw new Error('Invalid IP');
      }
      return ((octet0 << 24) | (octet1 << 16) | (octet2 << 8) | octet3) >>> 0;
    }

    default:
      throw new Error('Invalid IP');
  }
}

/**
 * Parses a numeric string in decimal, octal, or hexadecimal format
 */
function parseOctet(s: string): ParseResult {
  let value = 0;
  let base = 10;
  let maxDigit = '9';
  let index = 0;

  if (s.length > 1 && s.charAt(index) === '0') {
    const nextChar = s.charAt(index + 1);
    if (nextChar === 'x' || nextChar === 'X') {
      index += 2;
      base = 16;
    } else if (nextChar >= '0' && nextChar <= '9') {
      index++;
      base = 8;
      maxDigit = '7';
    }
  }

  const start = index;

  while (index < s.length) {
    const char = s.charAt(index);

    if (char >= '0' && char <= maxDigit) {
      value = (value * base + (char.charCodeAt(0) - '0'.charCodeAt(0))) >>> 0;
    } else if (base === 16) {
      if (char >= 'a' && char <= 'f') {
        value =
          (value * base + (10 + char.charCodeAt(0) - 'a'.charCodeAt(0))) >>> 0;
      } else if (char >= 'A' && char <= 'F') {
        value =
          (value * base + (10 + char.charCodeAt(0) - 'A'.charCodeAt(0))) >>> 0;
      } else {
        break;
      }
    } else {
      break;
    }

    if (value > 0xffffffff) {
      throw new Error('Number too large');
    }

    index++;
  }

  if (index === start) {
    throw new Error('Empty octet');
  }

  return [value, index];
}

/**
 * Represents an IPv4 network with CIDR notation support
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

    // Parse mask
    if (typeof networkMask === 'string' && networkMask.includes('.')) {
      // Dotted decimal mask
      try {
        this.maskLong = ip2long(networkMask);
      } catch (error) {
        throw new Error(`Invalid mask: ${networkMask}`);
      }

      // Convert to CIDR notation
      this.bitmask = this.maskLongToBitmask(this.maskLong);
    } else {
      // CIDR notation
      this.bitmask = parseInt(String(networkMask), 10);
      if (this.bitmask > 0) {
        this.maskLong = (0xffffffff << (32 - this.bitmask)) >>> 0;
      } else {
        this.maskLong = 0;
      }
    }

    // Validate bitmask
    if (this.bitmask > 32) {
      throw new Error(`Invalid mask for IPv4: ${networkMask}`);
    }

    // Parse network address
    try {
      this.netLong = (ip2long(networkAddress) & this.maskLong) >>> 0;
    } catch (error) {
      throw new Error(`Invalid net address: ${networkAddress}`);
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

    return (
      (ip2long(ip) & this.maskLong) >>> 0 ===
      (this.netLong & this.maskLong) >>> 0
    );
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
