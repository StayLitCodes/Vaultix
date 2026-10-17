import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllowedAsset } from './entities/allowed-asset.entity';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { StellarService } from '../../services/stellar.service';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(AllowedAsset)
    private readonly assetRepository: Repository<AllowedAsset>,
    private readonly stellarService: StellarService,
  ) {}

  async create(createAssetDto: CreateAssetDto): Promise<AllowedAsset> {
    this.validateAssetIdentity(createAssetDto.code, createAssetDto.issuer);
    const metadata =
      createAssetDto.code === 'XLM'
        ? null
        : await this.stellarService.getAssetMetadata(
            createAssetDto.code,
            createAssetDto.issuer!,
          );
    if (createAssetDto.code !== 'XLM' && !metadata) {
      throw new BadRequestException(
        `Asset ${createAssetDto.code} from ${createAssetDto.issuer} does not exist on Stellar`,
      );
    }

    const asset = this.assetRepository.create({
      ...createAssetDto,
      ...(metadata ?? {}),
      lastValidatedAt: metadata ? new Date() : null,
    });
    return this.assetRepository.save(asset);
  }

  async findAll(activeOnly = false): Promise<AllowedAsset[]> {
    const where = activeOnly ? { active: true } : {};
    return this.assetRepository.find({ where });
  }

  async findOne(id: string): Promise<AllowedAsset> {
    const asset = await this.assetRepository.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return asset;
  }

  async update(
    id: string,
    updateAssetDto: UpdateAssetDto,
  ): Promise<AllowedAsset> {
    const asset = await this.findOne(id);

    const nextCode = updateAssetDto.code ?? asset.code;
    const nextIssuer =
      nextCode === 'XLM' ? null : (updateAssetDto.issuer ?? asset.issuer);
    this.validateAssetIdentity(nextCode, nextIssuer);
    if (nextCode !== 'XLM') {
      const metadata = await this.stellarService.getAssetMetadata(
        nextCode,
        nextIssuer!,
      );
      if (!metadata) {
        throw new BadRequestException(
          `Asset ${nextCode} from ${nextIssuer} does not exist on Stellar`,
        );
      }
      Object.assign(asset, metadata, { lastValidatedAt: new Date() });
    } else {
      Object.assign(asset, {
        homeDomain: null,
        assetType: null,
        numAccounts: null,
        lastValidatedAt: null,
      });
    }

    Object.assign(asset, updateAssetDto);
    if (updateAssetDto.code === 'XLM') asset.issuer = null;
    return this.assetRepository.save(asset);
  }

  async remove(id: string): Promise<void> {
    const asset = await this.findOne(id);
    await this.assetRepository.remove(asset);
  }

  async getBalance(
    walletAddress: string,
    assetCode: string,
    issuer?: string,
  ): Promise<{ balance: number; assetCode: string; issuer?: string }> {
    if (assetCode !== 'XLM' && assetCode !== 'native' && !issuer) {
      throw new BadRequestException('Issuer is required for non-native assets');
    }
    try {
      const account = await this.stellarService.getAccount(walletAddress);
      const balanceItem = account.balances.find((b) => {
        if (assetCode === 'XLM' || assetCode === 'native') {
          return b.asset_type === 'native';
        } else {
          return b.asset_code === assetCode && b.asset_issuer === issuer;
        }
      });

      if (!balanceItem) {
        if (assetCode === 'XLM') {
          throw new BadRequestException(
            'Account has no native XLM balance or is not funded',
          );
        } else {
          throw new BadRequestException(
            `Account does not trust the asset ${assetCode}. Please establish a trustline first.`,
          );
        }
      }

      return {
        balance: parseFloat(balanceItem.balance),
        assetCode,
        issuer,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to fetch balance: account ${walletAddress} may not exist or cannot be reached.`,
      );
    }
  }

  private validateAssetIdentity(code: string, issuer?: string | null): void {
    if (code === 'XLM') {
      if (issuer) {
        throw new BadRequestException('Native XLM must not have an issuer');
      }
      return;
    }
    if (!issuer) {
      throw new BadRequestException('Issuer is required for non-native assets');
    }
  }
}
