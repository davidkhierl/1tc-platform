import { describe, test, expect } from "vitest";
import { Netmask } from "../src/netmask.js";

describe("Netmask", () => {
  describe("can build a block", () => {
    const block = new Netmask("10.1.2.0/24");

    test("should contain a sub-block", () => {
      const block1 = new Netmask("10.1.2.10/29");
      expect(block.contains(block1)).toBe(true);
    });

    test("should contain another sub-block", () => {
      const block2 = new Netmask("10.1.2.10/31");
      expect(block.contains(block2)).toBe(true);
    });

    test("should contain a third sub-block", () => {
      const block3 = new Netmask("10.1.2.20/32");
      expect(block.contains(block3)).toBe(true);
    });
  });

  describe("can describe a block", () => {
    const block = new Netmask("10.1.2.0/24");

    test("should have a specific size", () => {
      expect(block.size).toBe(256);
    });

    test("should have a specific base", () => {
      expect(block.base).toBe("10.1.2.0");
    });

    test("should have a specific mask", () => {
      expect(block.mask).toBe("255.255.255.0");
    });

    test("should have a specific host mask", () => {
      expect(block.hostmask).toBe("0.0.0.255");
    });

    test("should have a specific first ip", () => {
      expect(block.first).toBe("10.1.2.1");
    });

    test("should have a specific last ip", () => {
      expect(block.last).toBe("10.1.2.254");
    });

    test("should have a specific broadcast", () => {
      expect(block.broadcast).toBe("10.1.2.255");
    });
  });

  describe("when presented with an octet which is not a number", () => {
    const block = new Netmask("192.168.0.0/29");

    test("should throw on invalid octet in contains()", () => {
      expect(() => block.contains("192.168.~.4")).toThrow(Error);
    });
  });

  describe("can handle hexadecimal, octal, & decimal octets in input IP", () => {
    const block1 = new Netmask("31.0.0.0/19");
    const block2 = new Netmask("127.0.0.0/8");
    const block3 = new Netmask("255.0.0.1/12");
    const block4 = new Netmask("10.0.0.1/8");
    const block5 = new Netmask("1.0.0.1/4");

    describe("octal", () => {
      test("block 31.0.0.0/19 does not contain 031.0.5.5", () => {
        expect(block1.contains("031.0.5.5")).toBe(false);
      });
      test("block 127.0.0.0/8 contains 0177.0.0.2 (127.0.0.2)", () => {
        expect(block2.contains("0177.0.0.2")).toBe(true);
      });
      test("block 255.0.0.1/12 does not contain 0255.0.0.2 (173.0.0.2)", () => {
        expect(block3.contains("0255.0.0.2")).toBe(false);
      });
      test("block 10.0.0.1/8 contains 012.0.0.255 (10.0.0.255)", () => {
        expect(block4.contains("012.0.0.255")).toBe(true);
      });
      test("block 1.0.0.1/4 contains 01.02.03.04", () => {
        expect(block5.contains("01.02.03.04")).toBe(true);
      });
    });

    describe("hexadecimal", () => {
      test("block 31.0.0.0/19 does not contain 0x31.0.5.5", () => {
        expect(block1.contains("0x31.0.5.5")).toBe(false);
      });
      test("block 127.0.0.0/8 contains 0x7f.0.0.0x2 (127.0.0.2)", () => {
        expect(block2.contains("0x7f.0.0.0x2")).toBe(true);
      });
      test("block 255.0.0.1/12 contains 0xff.0.0.2", () => {
        expect(block3.contains("0xff.0.0.2")).toBe(true);
      });
      test("block 10.0.0.1/8 does not contain 0x10.0.0.255", () => {
        expect(block4.contains("0x10.0.0.255")).toBe(false);
      });
      test("block 1.0.0.1/4 contains 0x1.0x2.0x3.0x4", () => {
        expect(block5.contains("0x1.0x2.0x3.0x4")).toBe(true);
      });
    });

    describe("decimal", () => {
      test("block 31.0.0.0/19 contains 31.0.5.5", () => {
        expect(block1.contains("31.0.5.5")).toBe(true);
      });
      test("block 127.0.0.0/8 does not contain 128.0.0.2", () => {
        expect(block2.contains("128.0.0.2")).toBe(false);
      });
      test("block 255.0.0.1/12 contains 255.0.0.2", () => {
        expect(block3.contains("255.0.0.2")).toBe(true);
      });
      test("block 10.0.0.1/8 contains 10.0.0.255", () => {
        expect(block4.contains("10.0.0.255")).toBe(true);
      });
      test("block 1.0.0.1/4 contains 1.2.3.4", () => {
        expect(block5.contains("1.2.3.4")).toBe(true);
      });
    });
  });
});
