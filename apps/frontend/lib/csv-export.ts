import { IEventResponse } from "@/lib/escrow-api";

/**
 * Converts transaction events to CSV format
 */
export function convertEventsToCSV(events: IEventResponse[]): string {
  // CSV Headers
  const headers = [
    "Date",
    "Escrow ID",
    "Escrow Title",
    "Event Type",
    "Amount",
    "Asset",
    "Status",
    "Transaction Hash",
    "Counterparty",
  ];

  // Convert events to rows
  const rows = events.map((event) => {
    const date = new Date(event.createdAt).toISOString();
    const escrowId = event.escrowId || "";
    const escrowTitle = event.escrow?.title || "";
    const eventType = event.eventType.replace(/_/g, " ");

    // Calculate amount based on event type
    let amount = "";
    let asset = "";
    if (event.escrow) {
      amount = String(event.escrow.amount);
      asset = event.escrow.assetIssuer
        ? `${event.escrow.assetCode}:${event.escrow.assetIssuer}`
        : event.escrow.assetCode;
    }

    // Status from escrow or event
    const status = event.escrow?.status || "";

    // Transaction hash from event data
    const txHash =
      event.data?.transactionHash || event.data?.stellarTxHash || "";

    // Counterparty (actor)
    const counterparty = event.actor?.walletAddress || event.actorId || "";

    return [
      date,
      escrowId,
      escrowTitle,
      eventType,
      amount,
      asset,
      status,
      txHash,
      counterparty,
    ];
  });

  // Build CSV string
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape cells that contain commas, quotes, or newlines
          const cellStr = String(cell);
          if (
            cellStr.includes(",") ||
            cellStr.includes('"') ||
            cellStr.includes("\n")
          ) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(","),
    ),
  ].join("\n");

  return csvContent;
}

/**
 * Downloads CSV content as a file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Generates filename with current date
 */
export function generateTransactionFilename(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return `vaultix-transactions-${date}.csv`;
}
