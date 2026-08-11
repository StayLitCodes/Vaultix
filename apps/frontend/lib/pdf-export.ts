import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { IEventResponse } from "./escrow-api";

export interface ExportStats {
  totalTransactions: number;
  totalAmount: number;
  completedTransactions: number;
  activeTransactions: number;
  disputedTransactions: number;
}

/**
 * Calculates summary statistics from events
 */
export function calculateExportStats(events: IEventResponse[]): ExportStats {
  const stats: ExportStats = {
    totalTransactions: events.length,
    totalAmount: 0,
    completedTransactions: 0,
    activeTransactions: 0,
    disputedTransactions: 0,
  };

  events.forEach((event) => {
    if (event.escrow) {
      stats.totalAmount += event.escrow.amount || 0;
      
      if (event.escrow.status === "COMPLETED") {
        stats.completedTransactions++;
      } else if (event.escrow.status === "ACTIVE") {
        stats.activeTransactions++;
      } else if (event.escrow.status === "DISPUTED") {
        stats.disputedTransactions++;
      }
    }
  });

  return stats;
}

/**
 * Converts transaction events to PDF format with Vaultix branding
 */
export function convertEventsToPDF(events: IEventResponse[]): jsPDF {
  const doc = new jsPDF();
  const stats = calculateExportStats(events);

  // Vaultix branding - header
  doc.setFillColor(59, 130, 246); // Blue color
  doc.rect(0, 0, 210, 40, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Vaultix", 14, 25);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Transaction History Export", 14, 33);

  // Export date
  const exportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text(`Exported on: ${exportDate}`, 14, 50);

  // Summary statistics
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Summary Statistics", 14, 60);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  
  const statsData = [
    [`Total Transactions: ${stats.totalTransactions}`],
    [`Total Amount: ${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 })} XLM`],
    [`Completed: ${stats.completedTransactions}`],
    [`Active: ${stats.activeTransactions}`],
    [`Disputed: ${stats.disputedTransactions}`],
  ];

  statsData.forEach((stat, index) => {
    doc.text(stat[0], 14, 68 + index * 7);
  });

  // Prepare table data
  const tableData = events.map((event) => [
    event.escrowId?.slice(0, 12) + "..." || "",
    event.escrow?.status || "",
    event.escrow?.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 7 }) || "",
    event.escrow?.assetIssuer
      ? `${event.escrow.assetCode}:${event.escrow.assetIssuer.slice(0, 8)}...`
      : event.escrow?.assetCode || "",
    event.actor?.walletAddress?.slice(0, 12) + "..." || event.actorId?.slice(0, 12) + "..." || "",
    event.createdAt ? new Date(event.createdAt).toLocaleDateString() : "",
    event.eventType === "COMPLETED" && event.createdAt
      ? new Date(event.createdAt).toLocaleDateString()
      : "",
  ]);

  // Add table
  autoTable(doc, {
    startY: 105,
    head: [["Escrow ID", "Status", "Amount", "Asset", "Counterparty", "Created At", "Completed At"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 10, left: 14, right: 14, bottom: 20 },
    styles: {
      overflow: "linebreak",
    },
  });

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount} | Vaultix Transaction Export`,
      105,
      290,
      { align: "center" }
    );
  }

  return doc;
}

/**
 * Downloads PDF content as a file
 */
export function downloadPDF(doc: jsPDF, filename: string): void {
  doc.save(filename);
}
