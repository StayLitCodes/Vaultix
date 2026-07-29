import { convertEventsToCSV, generateTransactionFilename } from '@/lib/csv-export';
import { IEventResponse } from '@/lib/escrow-api';

describe('CSV Export', () => {
  const mockEvent: IEventResponse = {
    id: '1',
    escrowId: 'escrow-123',
    eventType: 'COMPLETED',
    actorId: 'actor-456',
    createdAt: '2024-01-15T10:30:00Z',
    escrow: {
      id: 'escrow-123',
      title: 'Test Escrow',
      amount: 100.5,
      assetCode: 'XLM',
      assetIssuer: 'issuer-789',
      status: 'COMPLETED',
    },
    actor: {
      walletAddress: 'GABC123DEF456',
    },
  };

  describe('convertEventsToCSV', () => {
    it('should convert events to CSV with proper headers', () => {
      const events = [mockEvent];
      const csv = convertEventsToCSV(events);
      
      expect(csv).toContain('Escrow ID,Status,Amount,Asset,Counterparty,Created At,Completed At,Deadline');
    });

    it('should properly escape commas in counterparty wallet address', () => {
      const eventWithComma: IEventResponse = {
        ...mockEvent,
        actor: {
          walletAddress: 'GABC,123,DEF,456',
        },
      };
      const csv = convertEventsToCSV([eventWithComma]);
      
      expect(csv).toContain('"GABC,123,DEF,456"');
    });

    it('should properly escape quotes in counterparty wallet address', () => {
      const eventWithQuote: IEventResponse = {
        ...mockEvent,
        actor: {
          walletAddress: 'GABC"123"DEF"456',
        },
      };
      const csv = convertEventsToCSV([eventWithQuote]);
      
      expect(csv).toContain('"GABC""123""DEF""456"');
    });

    it('should properly escape newlines in counterparty wallet address', () => {
      const eventWithNewline: IEventResponse = {
        ...mockEvent,
        actor: {
          walletAddress: 'GABC\n123\nDEF\n456',
        },
      };
      const csv = convertEventsToCSV([eventWithNewline]);
      
      expect(csv).toContain('"GABC\n123\nDEF\n456"');
    });

    it('should handle events without escrow data', () => {
      const eventWithoutEscrow: IEventResponse = {
        ...mockEvent,
        escrow: undefined,
      };
      const csv = convertEventsToCSV([eventWithoutEscrow]);
      
      const lines = csv.split('\n');
      expect(lines.length).toBe(2); // Header + 1 data row
      const dataRow = lines[1];
      const cells = dataRow.split(',');
      expect(cells[0]).toBe('escrow-123'); // Escrow ID
      expect(cells[1]).toBe(''); // Status
      expect(cells[2]).toBe(''); // Amount
    });

    it('should handle events without actor data', () => {
      const eventWithoutActor: IEventResponse = {
        ...mockEvent,
        actor: undefined,
        actorId: undefined,
      };
      const csv = convertEventsToCSV([eventWithoutActor]);
      
      const lines = csv.split('\n');
      const dataRow = lines[1];
      const cells = dataRow.split(',');
      expect(cells[4]).toBe(''); // Counterparty should be empty when both actor and actorId are missing
    });

    it('should derive completed date from COMPLETED event type', () => {
      const csv = convertEventsToCSV([mockEvent]);
      
      const lines = csv.split('\n');
      const dataRow = lines[1];
      const cells = dataRow.split(',');
      expect(cells[6]).toBe('2024-01-15T10:30:00.000Z'); // Completed At
    });

    it('should format dates in ISO format', () => {
      const csv = convertEventsToCSV([mockEvent]);
      
      const lines = csv.split('\n');
      const dataRow = lines[1];
      const cells = dataRow.split(',');
      expect(cells[5]).toBe('2024-01-15T10:30:00.000Z'); // Created At
    });

    it('should handle multiple events', () => {
      const events = [
        mockEvent,
        { ...mockEvent, id: '2', escrowId: 'escrow-456' },
        { ...mockEvent, id: '3', escrowId: 'escrow-789' },
      ];
      const csv = convertEventsToCSV(events);
      
      const lines = csv.split('\n');
      expect(lines.length).toBe(4); // Header + 3 data rows
    });

    it('should handle empty event array', () => {
      const csv = convertEventsToCSV([]);
      
      const lines = csv.split('\n');
      expect(lines.length).toBe(1); // Only header
      expect(lines[0]).toContain('Escrow ID,Status,Amount,Asset,Counterparty,Created At,Completed At,Deadline');
    });

    it('should format asset with issuer when present', () => {
      const csv = convertEventsToCSV([mockEvent]);
      
      const lines = csv.split('\n');
      const dataRow = lines[1];
      const cells = dataRow.split(',');
      expect(cells[3]).toBe('XLM:issuer-789'); // Asset with issuer
    });

    it('should format asset without issuer when not present', () => {
      const eventWithoutIssuer: IEventResponse = {
        ...mockEvent,
        escrow: {
          ...mockEvent.escrow!,
          assetIssuer: undefined,
        },
      };
      const csv = convertEventsToCSV([eventWithoutIssuer]);
      
      const lines = csv.split('\n');
      const dataRow = lines[1];
      const cells = dataRow.split(',');
      expect(cells[3]).toBe('XLM'); // Asset without issuer
    });
  });

  describe('generateTransactionFilename', () => {
    it('should generate CSV filename with current date', () => {
      const filename = generateTransactionFilename('csv');
      const dateRegex = /\d{4}-\d{2}-\d{2}/;
      expect(filename).toMatch(dateRegex);
      expect(filename).toContain('vaultix-transactions-');
      expect(filename).toContain('.csv');
    });

    it('should generate PDF filename with current date', () => {
      const filename = generateTransactionFilename('pdf');
      const dateRegex = /\d{4}-\d{2}-\d{2}/;
      expect(filename).toMatch(dateRegex);
      expect(filename).toContain('vaultix-transactions-');
      expect(filename).toContain('.pdf');
    });

    it('should default to CSV format when not specified', () => {
      const filename = generateTransactionFilename();
      expect(filename).toContain('.csv');
    });
  });
});
