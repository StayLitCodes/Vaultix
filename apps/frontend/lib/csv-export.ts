import { IEventResponse } from "@/lib/escrow-api";

export interface ExportFilters {
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Converts transaction events to CSV format with proper column mapping
 */
export function convertEventsToCSV(events: IEventResponse[]): string {
  const headers = [
    "Escrow ID",
    "Status",
    "Amount",
    "Asset",
    "Counterparty",
    "Created At",
    "Completed At",
    "Deadline",
  ];

  const rows = events.map((event) => {
    const escrowId = event.escrowId || "";
    const status = event.escrow?.status || "";
    const amount = event.escrow?.amount ? String(event.escrow.amount) : "";
    const asset = event.escrow?.assetIssuer
      ? `${event.escrow.assetCode}:${event.escrow.assetIssuer}`
      : event.escrow?.assetCode || "";
    const counterparty = event.actor?.walletAddress || event.actorId || "";
    const createdAt = event.createdAt ? new Date(event.createdAt).toISOString() : "";

    let completedAt = "";
    if (event.eventType === "COMPLETED" && event.createdAt) {
      completedAt = new Date(event.createdAt).toISOString();
    } else if (event.escrow?.completedAt) {
      completedAt = new Date(event.escrow.completedAt).toISOString();
    }

    const deadline = event.escrow?.deadline
      ? new Date(event.escrow.deadline).toISOString()
      : "";

    return [escrowId, status, amount, asset, counterparty, createdAt, completedAt, deadline];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
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

  URL.revokeObjectURL(url);
}

/**
 * Generates filename with current date
 */
export function generateTransactionFilename(format: "csv" | "pdf" = "csv"): string {
  const date = new Date().toISOString().split("T")[0];
  return `vaultix-transactions-${date}.${format}`;
}