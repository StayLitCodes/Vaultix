export interface VirusScanResult {
  clean: boolean;
  threat?: string;
}

export interface VirusScanner {
  scan(buffer: Buffer, filename: string): Promise<VirusScanResult>;
}

export const VIRUS_SCANNER = 'VIRUS_SCANNER';
