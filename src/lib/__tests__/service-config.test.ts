import { describe, it, expect } from "vitest";
import { getServiceConfig, SERVICE_CONFIGS, SERVICE_TYPE_OPTIONS } from "../service-config";

describe("SERVICE_CONFIGS", () => {
  it("has SPRINKLER_BLOWOUT config", () => {
    const config = SERVICE_CONFIGS.SPRINKLER_BLOWOUT;
    expect(config.jobPrefix).toBe("SB");
    expect(config.label).toBe("Sprinkler Blowout");
    expect(config.email.serviceName).toBeTruthy();
    expect(config.email.confirmationBody).toBeTruthy();
    expect(config.email.reminderSubject).toBeTruthy();
    expect(config.email.reminderHeading).toBeTruthy();
    expect(config.email.reminderBody).toBeTruthy();
    expect(config.email.cancellationBody).toBeTruthy();
  });

  it("has BACKFLOW_TESTING config", () => {
    const config = SERVICE_CONFIGS.BACKFLOW_TESTING;
    expect(config.jobPrefix).toBe("BF");
    expect(config.label).toBe("Backflow Prevention Testing");
    expect(config.email.serviceName).toBeTruthy();
  });
});

describe("getServiceConfig", () => {
  it("returns correct config for SPRINKLER_BLOWOUT", () => {
    const config = getServiceConfig("SPRINKLER_BLOWOUT");
    expect(config.jobPrefix).toBe("SB");
  });

  it("returns correct config for BACKFLOW_TESTING", () => {
    const config = getServiceConfig("BACKFLOW_TESTING");
    expect(config.jobPrefix).toBe("BF");
  });
});

describe("SERVICE_TYPE_OPTIONS", () => {
  it("has two options", () => {
    expect(SERVICE_TYPE_OPTIONS).toHaveLength(2);
  });

  it("contains expected values", () => {
    const values = SERVICE_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain("SPRINKLER_BLOWOUT");
    expect(values).toContain("BACKFLOW_TESTING");
  });
});
