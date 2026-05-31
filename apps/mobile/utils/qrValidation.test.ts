import { validateQRCode } from "./qrValidation";

describe("validateQRCode", () => {

  it("validates stellar address", () => {
    const value =
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    expect(
      validateQRCode(value).type
    ).toBe("stellar_address");
  });

  it("validates escrow id", () => {
    expect(
      validateQRCode("ESCROW_ABC123").type
    ).toBe("escrow_id");
  });

  it("rejects invalid qr", () => {
    expect(
      validateQRCode("hello").type
    ).toBe("invalid");
  });
});