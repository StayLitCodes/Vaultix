import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CursorPaginationDto } from '../../../common/pagination/cursor-pagination.dto';
import { EscrowStatus } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';
import { IsStellarAddress } from '../../../utils/validators';

export class ListEscrowsCursorDto extends CursorPaginationDto {
  @IsEnum(EscrowStatus)
  @IsOptional()
  status?: EscrowStatus;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  @IsOptional()
  assetCode?: string;

  @IsStellarAddress()
  @IsOptional()
  assetIssuer?: string;

  /** Only escrows where the caller holds this party role */
  @IsEnum(PartyRole)
  @IsOptional()
  role?: PartyRole;

  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @IsDateString()
  @IsOptional()
  createdTo?: string;
}
