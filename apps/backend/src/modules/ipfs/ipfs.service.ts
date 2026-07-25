import {
  Injectable,
  Logger,
  Inject,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import ipfsConfig from '../../config/ipfs.config';
import { IpfsProviderService } from './services/ipfs-provider.service';
import {
  computeMetadataHash,
  verifyMetadataHash,
} from './utils/metadata-hash.util';
import {
  EscrowMetadata,
  MetadataVerificationResult,
} from './types/ipfs-metadata.types';
import { Escrow } from '../escrow/entities/escrow.entity';
import { PartyRole } from '../escrow/entities/party.entity';
import { ConditionType } from '../escrow/entities/condition.entity';

@Injectable()
export class IpfsService {
  private readonly logger = new Logger(IpfsService.name);

  constructor(
    @Inject(ipfsConfig.KEY)
    private config: ConfigType<typeof ipfsConfig>,
    private readonly providerService: IpfsProviderService,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
  ) {}

  /**
   * Pins escrow metadata to IPFS and updates the escrow entity
   * @param escrowId The escrow ID
   * @param metadata The metadata to pin
   * @returns Object containing CID and metadata hash
   */
  async pinMetadata(
    escrowId: string,
    metadata: Partial<EscrowMetadata>,
  ): Promise<{ cid: string; metadataHash: string }> {
    try {
      this.logger.log(`Pinning metadata for escrow: ${escrowId}`);

      // Fetch existing escrow to get current version and previous CID
      const escrow = await this.escrowRepository.findOne({
        where: { id: escrowId },
      });

      if (!escrow) {
        throw new BadRequestException(`Escrow ${escrowId} not found`);
      }

      // Build complete metadata object
      const completeMetadata: EscrowMetadata = {
        escrowId: escrow.id,
        buyer:
          escrow.parties?.find((p) => p.role === PartyRole.BUYER)?.userId ?? '',
        seller:
          escrow.parties?.find((p) => p.role === PartyRole.SELLER)?.userId ??
          '',
        amount: escrow.amount.toString(),
        asset: escrow.assetCode,
        conditions:
          escrow.conditions?.map((c) => ({
            description: c.description,
            type: c.type ?? ConditionType.MANUAL,
            fulfilled: c.isFulfilled ?? false,
          })) ?? [],
        deadline: escrow.expiresAt?.toISOString() ?? '',
        status: escrow.status,
        timestamp: new Date().toISOString(),
        version: (escrow.ipfsVersion ?? 0) + 1,
        previousCid: escrow.ipfsCid ?? undefined,
        ...metadata,
      };

      // Compute SHA-256 hash before pinning
      const metadataHash = computeMetadataHash(
        completeMetadata as Record<string, unknown>,
      );

      // Pin to IPFS
      const cid = await this.providerService.pinJson(
        completeMetadata as Record<string, unknown>,
        `escrow-${escrowId}-v${completeMetadata.version}`,
      );

      // Update escrow entity with IPFS information
      escrow.ipfsCid = cid;
      escrow.ipfsMetadataHash = metadataHash;
      escrow.ipfsVersion = completeMetadata.version;
      await this.escrowRepository.save(escrow);

      this.logger.log(
        `Metadata pinned successfully for escrow ${escrowId}. CID: ${cid}, Version: ${completeMetadata.version}`,
      );

      return { cid, metadataHash };
    } catch (error) {
      this.logger.error(`Failed to pin metadata for escrow ${escrowId}`, error);
      // Graceful failure - don't block the operation
      throw new InternalServerErrorException('IPFS metadata pinning failed');
    }
  }

  /**
   * Retrieves escrow metadata from IPFS
   * @param escrowId The escrow ID
   * @returns The metadata object
   */
  async getMetadata(escrowId: string): Promise<EscrowMetadata> {
    try {
      this.logger.log(`Retrieving metadata for escrow: ${escrowId}`);

      const escrow = await this.escrowRepository.findOne({
        where: { id: escrowId },
      });

      if (!escrow || !escrow.ipfsCid) {
        throw new BadRequestException(
          `No IPFS metadata found for escrow ${escrowId}`,
        );
      }

      const metadata = await this.providerService.getJson<EscrowMetadata>(
        escrow.ipfsCid,
      );

      this.logger.log(`Metadata retrieved successfully for escrow ${escrowId}`);
      return metadata;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve metadata for escrow ${escrowId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve IPFS metadata',
      );
    }
  }

  /**
   * Verifies escrow metadata integrity by comparing hashes
   * @param escrowId The escrow ID
   * @returns Verification result
   */
  async verifyMetadata(escrowId: string): Promise<MetadataVerificationResult> {
    try {
      this.logger.log(`Verifying metadata for escrow: ${escrowId}`);

      const escrow = await this.escrowRepository.findOne({
        where: { id: escrowId },
      });

      if (!escrow || !escrow.ipfsCid || !escrow.ipfsMetadataHash) {
        return {
          isValid: false,
          escrowId,
          computedHash: '',
          storedHash: '',
          metadata: {} as EscrowMetadata,
          errors: ['No IPFS metadata found'],
        };
      }

      // Retrieve metadata from IPFS
      const metadata = await this.providerService.getJson<EscrowMetadata>(
        escrow.ipfsCid,
      );

      // Compute hash from retrieved metadata
      const computedHash = computeMetadataHash(
        metadata as Record<string, unknown>,
      );

      const isValid = verifyMetadataHash(
        metadata as Record<string, unknown>,
        escrow.ipfsMetadataHash,
      );

      this.logger.log(
        `Metadata verification for escrow ${escrowId}: ${isValid ? 'VALID' : 'INVALID'}`,
      );

      return {
        isValid,
        escrowId,
        computedHash,
        storedHash: escrow.ipfsMetadataHash,
        metadata,
        errors: isValid ? [] : ['Hash mismatch detected'],
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify metadata for escrow ${escrowId}`,
        error,
      );
      throw new InternalServerErrorException('Metadata verification failed');
    }
  }

  /**
   * Uploads a file to IPFS (backward compatibility)
   * @param fileBuffer The file content as a Buffer
   * @param filename The original filename
   * @returns The IPFS CID
   */
  async uploadFile(fileBuffer: Buffer, filename: string): Promise<string> {
    try {
      this.logger.log(`Uploading file to IPFS: ${filename}`);

      // For file uploads, we still use Pinata directly since provider service only handles JSON
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(fileBuffer)]);
      formData.append('file', blob, filename);

      const axios = (await import('axios')).default;
      const response = await axios.post<{
        IpfsHash: string;
        PinSize: number;
        Timestamp: string;
      }>('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
        headers: {
          Authorization: `Bearer ${this.config.pinataJwt}`,
        },
      });

      const cid = response.data.IpfsHash;
      this.logger.log(`File uploaded successfully to IPFS. CID: ${cid}`);
      return cid;
    } catch (error) {
      this.logger.error(`Failed to upload file to IPFS: ${filename}`, error);
      throw new InternalServerErrorException('IPFS upload failed');
    }
  }

  /**
   * Uploads JSON metadata to IPFS (backward compatibility)
   * @param data The JSON data to upload
   * @param name The name for the pin
   * @returns The IPFS CID
   */
  async uploadJson(
    data: Record<string, unknown>,
    name: string,
  ): Promise<string> {
    return this.providerService.pinJson(data, name);
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
