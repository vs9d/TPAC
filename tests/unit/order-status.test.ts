import { describe, it, expect } from "vitest";
import { canTransition, nextStatuses, ORDER_FLOW, isOrderStatus } from "@/lib/order-status";

describe("order status workflow", () => {
  it("follows the 8-step flow plus cancellation", () => {
    expect(ORDER_FLOW).toEqual(["received", "confirmed", "preparing", "printing", "quality_check", "ready_to_ship", "shipped", "delivered"]);
  });
  it("allows forward moves, including skipping steps", () => {
    expect(canTransition("received", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "ready_to_ship")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });
  it("rejects backward moves and same-state moves", () => {
    expect(canTransition("shipped", "printing")).toBe(false);
    expect(canTransition("confirmed", "confirmed")).toBe(false);
  });
  it("allows cancellation until delivery; terminal states are final", () => {
    expect(canTransition("printing", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(true);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "confirmed")).toBe(false);
    expect(nextStatuses("delivered")).toEqual([]);
  });
  it("lists next statuses", () => {
    expect(nextStatuses("ready_to_ship")).toEqual(["shipped", "delivered", "cancelled"]);
  });
  it("type-guards", () => {
    expect(isOrderStatus("printing")).toBe(true);
    expect(isOrderStatus("lost")).toBe(false);
  });
});
