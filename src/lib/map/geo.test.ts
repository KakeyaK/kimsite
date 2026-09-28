import { describe, it, expect } from "vitest";
import { alongLine, bboxCenter, greatCircle, daysUntil } from "./geo";

describe("bboxCenter", () => {
  it("returns the middle of the box", () => {
    expect(bboxCenter([0, 0, 10, 20])).toEqual([5, 10]);
  });
});

describe("greatCircle", () => {
  it("starts and ends at the endpoints", () => {
    const line = greatCircle([-46.6, -23.5], [139.7, 35.7], 32);
    expect(line).toHaveLength(33);
    expect(line[0][0]).toBeCloseTo(-46.6);
    expect(line[0][1]).toBeCloseTo(-23.5);
    expect(line[32][1]).toBeCloseTo(35.7);
  });

  it("passes through the midpoint on the equator", () => {
    const mid = greatCircle([0, 0], [90, 0], 2)[1];
    expect(mid[0]).toBeCloseTo(45);
    expect(mid[1]).toBeCloseTo(0);
  });

  it("does not jump across the antimeridian", () => {
    const line = greatCircle([139.7, 35.7], [-122.4, 37.8]); // Tokyo → San Francisco
    for (let i = 1; i < line.length; i++) {
      expect(Math.abs(line[i][0] - line[i - 1][0])).toBeLessThan(180);
    }
  });

  it("handles identical and antipodal points without NaN", () => {
    expect(greatCircle([10, 10], [10, 10])).toEqual([[10, 10], [10, 10]]);
    const anti = greatCircle([0, 0], [180, 0]);
    expect(anti.flat().every(Number.isFinite)).toBe(true);
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 8, 26, 23, 30); // 26 Sep 2026, late evening local time
  it("counts calendar days ahead", () => {
    expect(daysUntil("2026-10-01", now)).toBe(5);
  });
  it("is 0 on the day itself", () => {
    expect(daysUntil("2026-09-26", now)).toBe(0);
  });
  it("is negative in the past", () => {
    expect(daysUntil("2026-09-20", now)).toBe(-6);
  });
  it("returns null for bad dates", () => {
    expect(daysUntil("2026-13-40", now)).toBeNull();
    expect(daysUntil("soon", now)).toBeNull();
  });
});

describe("alongLine", () => {
  const line: [number, number][] = [[0, 0], [0, 10], [10, 10]];
  it("returns the ends at 0 and 1", () => {
    expect(alongLine(line, 0).point).toEqual([0, 0]);
    expect(alongLine(line, 1).point).toEqual([10, 10]);
  });
  it("interpolates by length", () => {
    const { point } = alongLine(line, 0.75); // 3/4 of 20 units = 5 into the second segment
    expect(point[0]).toBeCloseTo(5);
    expect(point[1]).toBeCloseTo(10);
  });
  it("gives the heading in degrees clockwise from north", () => {
    expect(alongLine(line, 0.25).bearing).toBeCloseTo(0); // heading north
    expect(alongLine(line, 0.75).bearing).toBeCloseTo(90, 0); // heading east
    expect(alongLine([[0, 0], [0, -5]], 0.5).bearing).toBeCloseTo(180);
  });
  it("clamps out-of-range fractions", () => {
    expect(alongLine(line, -1).point).toEqual([0, 0]);
    expect(alongLine(line, 2).point).toEqual([10, 10]);
  });
});
