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
    if (createAssetDto.code !== 'XLM') {
      if (!createAssetDto.issuer) {
        throw new BadRequestException(
          'Issuer is required for non-native assets',
        );
      }

      const isValid = await this.stellarService.validateAsset(
        createAssetDto.code,
        createAssetDto.issuer,
      );
      if (!isValid) {
        throw new BadRequestException(
          `Asset ${createAssetDto.code} from ${createAssetDto.issuer} does not exist on Stellar`,
        );
      }
    }

    const asset = this.assetRepository.create(createAssetDto);
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

    if (
      updateAssetDto.code &&
      updateAssetDto.code !== 'XLM' &&
      updateAssetDto.issuer
    ) {
      const isValid = await this.stellarService.validateAsset(
        updateAssetDto.code,
        updateAssetDto.issuer,
      );
      if (!isValid) {
        throw new BadRequestException(
          `Asset ${updateAssetDto.code} from ${updateAssetDto.issuer} does not exist on Stellar`,
        );
      }
    }

    Object.assign(asset, updateAssetDto);
    return this.assetRepository.save(asset);
  }

  async remove(id: string): Promise<void> {
    const asset = await this.findOne(id);
    await this.assetRepository.remove(asset);
  }
}
