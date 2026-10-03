import { validateQRCode } from "./qrValidation";
import { buildEscrowShareUrl } from "../components/ShareButton";

describe("validateQRCode", () => {
  it("validates stellar address", () => {
    const value =
      "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    expect(validateQRCode(value).type).toBe("stellar_address");
  });

  it("validates a realistic escrow share URL with a UUID", () => {
    const escrowId = "550e8400-e29b-41d4-a716-446655440000";
    const payload = buildEscrowShareUrl(escrowId);

    expect(validateQRCode(payload)).toEqual({
      type: "escrow_id",
      value: escrowId,
    });
  });

  it("accepts backend escrow IDs with lowercase characters", () => {
    const escrowId = "8f3c6b9e-1c4d-4e0a-9d2f-7a6b5c4d3e2f";
    expect(
      validateQRCode(`https://vaultix.app/escrow/${escrowId}`)
    ).toEqual({
      type: "escrow_id",
      value: escrowId,
    });
  });

  it("rejects the legacy synthetic escrow format", () => {
    expect(validateQRCode("ESCROW_ABC123").type).toBe("invalid");
  });

  it("rejects escrow URLs from an untrusted host", () => {
    expect(
      validateQRCode(
        "https://example.com/escrow/550e8400-e29b-41d4-a716-446655440000"
      ).type
    ).toBe("invalid");
  });

  it("rejects invalid qr", () => {
    expect(validateQRCode("hello").type).toBe("invalid");
  });
});
