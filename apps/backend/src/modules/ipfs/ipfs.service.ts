import {
  Injectable,
  Logger,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import ipfsConfig from '../../config/ipfs.config';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);

  constructor(
    @Inject(ipfsConfig.KEY)
    private config: ConfigType<typeof ipfsConfig>,
  ) {}

  /**
   * Uploads a file to IPFS via Pinata
   * @param fileBuffer The file content as a Buffer
   * @param filename The original filename
   * @returns The IPFS CID
   */
  async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
    try {
      this.logger.log(`Uploading file to IPFS: ${filename}`);

      const formData = new FormData();
      const blob = new Blob([fileBuffer]);
      formData.append('file', blob, filename);

      const response = await axios.post<PinataResponse>(
        'https://api.pinata.cloud/pinning/pinFileToIPFS',
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.config.pinataJwt}`,
          },
        },
      );

      const cid = response.data.IpfsHash;
      this.logger.log(`File uploaded successfully to IPFS. CID: ${cid}`);
      return cid;
    } catch (error) {
      this.logger.error(`Failed to upload file to IPFS: ${filename}`, error);
      throw new InternalServerErrorException('IPFS upload failed');
    }
  }

  /**
   * Uploads JSON metadata to IPFS via Pinata
   * @param data The JSON data to upload
   * @param name The name for the pin
   * @returns The IPFS CID
   */
  async uploadJson(
    data: Record<string, unknown>,
    name: string,
  ): Promise<string> {
    try {
      this.logger.log(`Uploading JSON to IPFS: ${name}`);

      const response = await axios.post<PinataResponse>(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        {
          pinataContent: data,
          pinataMetadata: {
            name,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.pinataJwt}`,
          },
        },
      );

      const cid = response.data.IpfsHash;
      this.logger.log(`JSON uploaded successfully to IPFS. CID: ${cid}`);
      return cid;
    } catch (error) {
      this.logger.error(`Failed to upload JSON to IPFS: ${name}`, error);
      throw new InternalServerErrorException('IPFS JSON upload failed');
    }
  }

  /**
   * Gets the gateway URL for a CID
   * @param cid The IPFS CID
   * @returns The full gateway URL
   */
  getGatewayUrl(cid: string): string {
    return `${this.config.gatewayUrl}${cid}`;
  }
}
