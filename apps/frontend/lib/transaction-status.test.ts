import {
  DEFAULT_POLL_INTERVAL_MS,
  MAX_POLL_INTERVAL_MS,
  TransactionOutcome,
  TransactionStatus,
  awaitConfirmation,
  explorerTransactionUrl,
  fetchTransactionOutcome,
  horizonTransactionUrl,
  isRetryableOutcome,
  isTerminalStatus,
  nextPollDelay,
  progressStatus,
  resolveTransactionOutcome,
  statusForOutcome,
} from "./transaction-status";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notOk = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe("transaction status urls", () => {
  it("uses the canonical horizon node for each network", () => {
    expect(horizonTransactionUrl("testnet", "abc")).toBe(
      "https://horizon-testnet.stellar.org/transactions/abc"
    );
    expect(horizonTransactionUrl("public", "abc")).toBe(
      "https://horizon.stellar.org/transactions/abc"
    );
  });

  it("uses the explorer for the network the transaction ran on", () => {
    expect(explorerTransactionUrl("testnet", "abc")).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc"
    );
    expect(explorerTransactionUrl("public", "abc")).toBe(
      "https://stellar.expert/explorer/public/tx/abc"
    );
  });

  it("encodes hashes so a malformed value cannot alter the path", () => {
    expect(horizonTransactionUrl("testnet", "a/b?c")).toContain("a%2Fb%3Fc");
    expect(explorerTransactionUrl("public", "a/b")).toContain("a%2Fb");
  });
});

describe("resolveTransactionOutcome", () => {
  it("treats 404 as pending, because Horizon may not have indexed it yet", async () => {
    const outcome = await resolveTransactionOutcome(notOk(404));
    expect(outcome.kind).toBe("pending");
  });

  it("treats 5xx and 429 as unknown transport state, never as a chain failure", async () => {
    for (const status of [429, 500, 502, 503, 504]) {
      const outcome = await resolveTransactionOutcome(notOk(status));
      expect(outcome.kind).toBe("unknown");
      expect(outcome).toHaveProperty("detail", expect.stringContaining(String(status)));
    }
  });

  it("treats an unreadable or unexpected body as unknown", async () => {
    const unreadable = await resolveTransactionOutcome({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("bad json");
      },
    });
    expect(unreadable.kind).toBe("unknown");

    const unexpected = await resolveTransactionOutcome(ok({ hello: "world" }));
    expect(unexpected.kind).toBe("unknown");
    expect((await resolveTransactionOutcome(ok(["nope"]))).kind).toBe("unknown");
  });

  it("confirms a successful transaction and reports its ledger", async () => {
    const outcome = await resolveTransactionOutcome(ok({ successful: true, ledger: 55 }));
    expect(outcome).toEqual({ kind: "confirmed", ledger: 55 });
    expect(await resolveTransactionOutcome(ok({ successful: true }))).toEqual({
      kind: "confirmed",
      ledger: null,
    });
  });

  it("fails only when a ledger closed with the transaction unsuccessful", async () => {
    const outcome = await resolveTransactionOutcome(ok({ successful: false }));
    expect(outcome.kind).toBe("failed");
    expect(outcome).toHaveProperty("detail", expect.stringContaining("not successful"));
  });
});

describe("fetchTransactionOutcome", () => {
  it("reads the canonical endpoint for the requested hash and network", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok({ successful: true, ledger: 9 })) as any;

    const outcome = await fetchTransactionOutcome({
      txHash: "hash-1",
      network: "testnet",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://horizon-testnet.stellar.org/transactions/hash-1",
      expect.objectContaining({ signal: undefined })
    );
    expect(outcome.kind).toBe("confirmed");
  });

  it("turns a thrown transport error into unknown rather than failing the transaction", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as any;
    const outcome = await fetchTransactionOutcome({ txHash: "h", network: "public", fetchImpl });

    expect(outcome.kind).toBe("unknown");
    expect(outcome).toHaveProperty("detail", expect.stringContaining("Failed to fetch"));
  });

  it("marks a request cancelled by its own abort signal", async () => {
    const controller = new AbortController();
    const fetchImpl = jest.fn().mockImplementation(async () => {
      controller.abort();
      throw Object.assign(new Error("Aborted"), { name: "AbortError" });
    }) as any;

    const outcome = await fetchTransactionOutcome({
      txHash: "h",
      network: "testnet",
      signal: controller.signal,
      fetchImpl,
    });

    expect(outcome).toMatchObject({ kind: "unknown", cancelled: true });
  });
});

describe("status progression", () => {
  it("knows which states are terminal", () => {
    const terminal: TransactionStatus[] = ["confirmed", "failed"];
    const open: TransactionStatus[] = ["submitted", "pending", "unknown"];
    for (const status of terminal) expect(isTerminalStatus(status)).toBe(true);
    for (const status of open) expect(isTerminalStatus(status)).toBe(false);
  });

  it("maps outcomes onto statuses", () => {
    expect(statusForOutcome({ kind: "pending", detail: "" })).toBe("pending");
    expect(statusForOutcome({ kind: "unknown", detail: "" })).toBe("unknown");
    expect(statusForOutcome({ kind: "confirmed", ledger: null })).toBe("confirmed");
    expect(statusForOutcome({ kind: "failed", detail: "" })).toBe("failed");
  });

  it("walks the documented pending -> confirmed sequence", () => {
    let status: TransactionStatus = "submitted";
    const sequence: TransactionOutcome[] = [
      { kind: "pending", detail: "404" },
      { kind: "pending", detail: "404" },
      { kind: "confirmed", ledger: 12 },
    ];
    for (const outcome of sequence) status = progressStatus(status, outcome);
    expect(status).toBe("confirmed");
  });

  it("walks the documented unknown -> confirmed sequence without ever failing", () => {
    let status: TransactionStatus = "submitted";
    const seen: TransactionStatus[] = [];
    const sequence: TransactionOutcome[] = [
      { kind: "unknown", detail: "503" },
      { kind: "unknown", detail: "Failed to fetch" },
      { kind: "pending", detail: "404" },
      { kind: "confirmed", ledger: 13 },
    ];
    for (const outcome of sequence) {
      status = progressStatus(status, outcome);
      seen.push(status);
    }
    expect(seen).toEqual(["unknown", "unknown", "pending", "confirmed"]);
    expect(seen).not.toContain("failed");
  });

  it("never downgrades a settled transaction after a later transport failure", () => {
    expect(progressStatus("confirmed", { kind: "unknown", detail: "503" })).toBe("confirmed");
    expect(progressStatus("failed", { kind: "pending", detail: "404" })).toBe("failed");
  });
});

describe("retryable outcomes", () => {
  it("retries pending and unknown only", () => {
    expect(isRetryableOutcome({ kind: "pending", detail: "" })).toBe(true);
    expect(isRetryableOutcome({ kind: "unknown", detail: "" })).toBe(true);
    expect(isRetryableOutcome({ kind: "confirmed", ledger: null })).toBe(false);
    expect(isRetryableOutcome({ kind: "failed", detail: "" })).toBe(false);
  });
});

describe("nextPollDelay", () => {
  it("polls at the base interval while the node is answering", () => {
    expect(nextPollDelay(0, 3000)).toBe(3000);
    expect(nextPollDelay(0)).toBe(DEFAULT_POLL_INTERVAL_MS);
  });

  it("backs off exponentially and never exceeds the ceiling", () => {
    expect(nextPollDelay(1, 3000)).toBe(6000);
    expect(nextPollDelay(2, 3000)).toBe(12000);
    expect(nextPollDelay(3, 3000)).toBe(24000);
    expect(nextPollDelay(4, 3000)).toBe(MAX_POLL_INTERVAL_MS);
    expect(nextPollDelay(50, 3000)).toBe(MAX_POLL_INTERVAL_MS);
  });

  it("is bounded by the ceiling even when the base already exceeds it", () => {
    expect(nextPollDelay(5, 60_000, 30_000)).toBe(60_000);
  });
});

describe("awaitConfirmation", () => {
  it("resolves confirmed once the chain reports the transaction", async () => {
    let call = 0;
    const fetchImpl = jest.fn().mockImplementation(async () => {
      call += 1;
      return call < 3 ? notOk(404) : ok({ successful: true, ledger: 77 });
    }) as any;

    const result = await awaitConfirmation({
      txHash: "h",
      network: "testnet",
      timeoutMs: 5000,
      pollInterval: 1,
      fetchImpl,
      sleep: async () => {},
    });

    expect(result).toEqual({ kind: "confirmed", ledger: 77 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns unconfirmed instead of failed when the deadline passes during an outage", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(notOk(503)) as any;
    let clock = 0;

    const result = await awaitConfirmation({
      txHash: "h",
      network: "testnet",
      timeoutMs: 100,
      pollInterval: 1000,
      fetchImpl,
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms;
      },
    });

    expect(result.kind).toBe("unconfirmed");
    // Bounded: the first backoff already exceeds the remaining budget.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops immediately on a confirmed chain failure", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok({ successful: false })) as any;

    const result = await awaitConfirmation({
      txHash: "h",
      network: "public",
      pollInterval: 1,
      fetchImpl,
      sleep: async () => {},
    });

    expect(result.kind).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up when its abort signal fires", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = jest.fn() as any;

    const result = await awaitConfirmation({
      txHash: "h",
      network: "testnet",
      signal: controller.signal,
      fetchImpl,
    });

    expect(result.kind).toBe("unconfirmed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
