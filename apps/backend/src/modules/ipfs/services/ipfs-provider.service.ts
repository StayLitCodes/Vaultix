import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import axios from 'axios';
import ipfsConfig from '../../../config/ipfs.config';

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

interface LocalIpfsResponse {
  Name: string;
  Hash: string;
  Size: string;
}

export type IpfsProviderType = 'pinata' | 'local';

@Injectable()
export class IpfsProviderService {
  private readonly logger = new Logger(IpfsProviderService.name);
  private readonly provider: IpfsProviderType;

  constructor(
    @Inject(ipfsConfig.KEY)
    private config: ConfigType<typeof ipfsConfig>,
  ) {
    this.provider = (config.provider as IpfsProviderType) || 'pinata';
    this.logger.log(`IPFS Provider: ${this.provider}`);
  }

  /**
   * Uploads JSON metadata to IPFS
   * @param data The JSON data to upload
   * @param name The name for the pin
   * @returns The IPFS CID
   */
  async pinJson(data: Record<string, unknown>, name: string): Promise<string> {
    const retries = this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (this.provider === 'pinata') {
          return await this.pinJsonToPinata(data, name);
        } else {
          return await this.pinJsonToLocal(data, name);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `IPFS pin attempt ${attempt + 1}/${retries + 1} failed: ${lastError.message}`,
        );
        if (attempt < retries) {
          await this.delay(1000);
        }
      }
    }

    const errorToThrow = lastError ?? new Error('All IPFS pin attempts failed');
    this.logger.error(`All IPFS pin attempts failed`, errorToThrow);
    throw errorToThrow;
  }

  /**
   * Retrieves JSON metadata from IPFS
   * @param cid The IPFS CID
   * @returns The JSON data
   */
  async getJson<T>(cid: string): Promise<T> {
    try {
      if (this.provider === 'pinata') {
        return await this.getJsonFromPinata<T>(cid);
      } else {
        return await this.getJsonFromLocal<T>(cid);
      }
    } catch (error) {
      this.logger.error(`Failed to retrieve JSON from IPFS: ${cid}`, error);
      throw error;
    }
  }

  private async pinJsonToPinata(
    data: Record<string, unknown>,
    name: string,
  ): Promise<string> {
    const response = await axios.post<PinataResponse>(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        pinataContent: data,
        pinataMetadata: { name },
      },
      {
        headers: {
          Authorization: `Bearer ${this.config.pinataJwt}`,
        },
      },
    );

    return response.data.IpfsHash;
  }

  private async pinJsonToLocal(
    data: Record<string, unknown>,
    name: string,
  ): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    formData.append('file', blob, `${name}.json`);

    const response = await axios.post<LocalIpfsResponse>(
      `${this.config.localNodeUrl}/api/v0/add`,
      formData,
    );

    return response.data.Hash;
  }

  private async getJsonFromPinata<T>(cid: string): Promise<T> {
    const response = await axios.get<T>(`${this.config.gatewayUrl}${cid}`);
    return response.data;
  }

  private async getJsonFromLocal<T>(cid: string): Promise<T> {
    const response = await axios.get<T>(
      `${this.config.localNodeUrl}/api/v0/cat?arg=${cid}`,
    );
    return response.data;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
