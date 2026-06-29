import { Injectable } from '@nestjs/common';
import {
  VirusScanner,
  VirusScanResult,
} from '../interfaces/virus-scanner.interface';

/**
 * No-op virus scanner. Replace with a real ClamAV adapter by implementing
 * VirusScanner and binding it to the VIRUS_SCANNER token in UploadModule.
 *
 * ClamAV implementation would typically call clamav.scanBuffer(buffer) via
 * the 'clamscan' or 'clamdjs' npm packages.
 */
@Injectable()
export class NoopVirusScannerAdapter implements VirusScanner {
  async scan(_buffer: Buffer, _filename: string): Promise<VirusScanResult> {
    return { clean: true };
  }
}
