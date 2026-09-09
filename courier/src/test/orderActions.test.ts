import { describe, expect, it } from "vitest";
import { isAdjustableOrderStatus } from "../lib/orderActions";

describe("isAdjustableOrderStatus", () => {
  it("allows quantity edit after accept until delivering", () => {
    expect(isAdjustableOrderStatus("accepted")).toBe(true);
    expect(isAdjustableOrderStatus("preparing")).toBe(true);
    expect(isAdjustableOrderStatus("ready")).toBe(true);
  });

  it("blocks edit before claim and after on the road", () => {
    expect(isAdjustableOrderStatus("pending")).toBe(false);
    expect(isAdjustableOrderStatus("delivering")).toBe(false);
    expect(isAdjustableOrderStatus("delivered")).toBe(false);
  });
});
