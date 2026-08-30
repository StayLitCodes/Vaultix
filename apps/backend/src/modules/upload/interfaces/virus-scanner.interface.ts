/**
 * ClamAV virus-scanning hook interface.
 *
 * The concrete implementation (`ClamAvScannerService`) would connect to a
 * clamd TCP socket (default 127.0.0.1:3310) using the INSTREAM command.
 * A no-op stub is provided so the module works without a running ClamAV daemon.
 */

export interface VirusScanResult {
  /** true if no threat was found */
  clean: boolean;
  /** Raw verdict string, e.g. "Win.Malware.Eicar-6961992-0 FOUND" or "OK" */
  verdict: string;
  /** Error message when the scan could not be completed */
  error?: string;
}

export const VIRUS_SCANNER_TOKEN = 'VIRUS_SCANNER';

export interface VirusScanner {
  /**
   * Scan a file buffer.
   * Implementations MUST NOT throw — wrap errors in the result object instead.
   */
  scan(buffer: Buffer, filename: string): Promise<VirusScanResult>;
}

/**
 * No-op scanner used when ClamAV is not configured.
 * Always reports the file as clean so uploads are never blocked in dev/test.
 */
export class NoOpVirusScanner implements VirusScanner {
  async scan(_buffer: Buffer, _filename: string): Promise<VirusScanResult> {
    return { clean: true, verdict: 'NO_SCANNER_CONFIGURED' };
  }
}
