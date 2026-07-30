import { describe, expect, it } from "vitest";
import {
  money,
  formatDateTime,
  formatDay,
  statusLabel,
  statusPill,
  paymentLabel,
  mapsUrl,
  qtyUnit,
  distanceLabel,
  etaLabel,
} from "../lib/format";

/** toLocaleString ru-RU non-breaking space (\u00a0) ni oddiy space ga almashtiradi. */
const NBSP = "\u00a0";

describe("money", () => {
  it("formats number with spaces", () => {
    expect(money(1000)).toBe(`1${NBSP}000`);
    expect(money(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(money(0)).toBe("0");
  });
});

describe("formatDateTime", () => {
  it("formats ISO string", () => {
    const r = formatDateTime("2026-06-30T12:00:00Z");
    expect(r).toContain("30.06");
  });
});

describe("formatDay", () => {
  it("formats as day + short month", () => {
    const r = formatDay("2026-06-30");
    expect(r).toContain("30");
  });
});

describe("statusLabel", () => {
  it("returns label for known status", () => {
    expect(statusLabel("pending")).toBe("Yangi");
    expect(statusLabel("accepted")).toBe("Qabul qilindi");
    expect(statusLabel("delivering")).toBe("Yetkazilmoqda");
    expect(statusLabel("delivered")).toBe("Yetkazildi");
    expect(statusLabel("cancelled")).toBe("Bekor qilindi");
  });

  it("falls back to the status value for unknown", () => {
    expect(statusLabel("unknown" as any)).toBe("unknown");
  });
});

describe("statusPill", () => {
  it("returns CSS class for known status", () => {
    expect(statusPill("delivered")).toContain("emerald");
    expect(statusPill("cancelled")).toContain("rose");
    expect(statusPill("accepted")).toContain("cyan");
  });

  it("falls back to default for unknown", () => {
    expect(statusPill("unknown" as any)).toContain("slate");
  });
});

describe("paymentLabel", () => {
  it("returns Uzbek label", () => {
    expect(paymentLabel("cash")).toBe("Naqd");
    expect(paymentLabel("payme")).toBe("Payme");
  });

  it("returns dash for undefined", () => {
    expect(paymentLabel(undefined)).toBe("—");
  });
});

describe("mapsUrl", () => {
  it("generates Google Maps navigation URL", () => {
    const url = mapsUrl(41.3, 69.2);
    expect(url).toContain("google.com/maps");
    expect(url).toContain("destination=41.3,69.2");
  });

  it("returns null if lat/lng missing", () => {
    expect(mapsUrl(null, null)).toBeNull();
    expect(mapsUrl(undefined, undefined)).toBeNull();
  });
});

describe("qtyUnit", () => {
  it("uses provided unit", () => {
    expect(qtyUnit(2, "kg")).toBe("2 kg");
    expect(qtyUnit(1, "dona")).toBe("1 dona");
  });

  it("defaults to 'dona' when unit missing", () => {
    expect(qtyUnit(5, null)).toBe("5 dona");
    expect(qtyUnit(3, undefined)).toBe("3 dona");
  });
});

describe("distanceLabel", () => {
  it("shows km for >= 1 km", () => {
    expect(distanceLabel(4.2)).toBe("4.2 km");
    expect(distanceLabel(1.0)).toBe("1.0 km");
  });

  it("shows meters for < 1 km", () => {
    expect(distanceLabel(0.85)).toBe("850 m");
    expect(distanceLabel(0.05)).toBe("50 m");
  });

  it("returns null for null/undefined", () => {
    expect(distanceLabel(null)).toBeNull();
    expect(distanceLabel(undefined)).toBeNull();
  });
});

describe("etaLabel", () => {
  it("formats with ~ prefix", () => {
    expect(etaLabel(25)).toBe("~25 daqiqa");
    expect(etaLabel(10)).toBe("~10 daqiqa");
  });

  it("returns null for null/undefined/0", () => {
    expect(etaLabel(null)).toBeNull();
    expect(etaLabel(undefined)).toBeNull();
  });
});