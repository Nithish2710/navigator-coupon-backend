import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsArray,
} from 'class-validator';
import { DiscountType, CouponStatus, EligibilityType } from '../../common/types';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  expiresAt: string;

  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @IsOptional()
  @IsEnum(EligibilityType)
  eligibilityType?: EligibilityType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleProductIds?: string[];
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maximumDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsEnum(CouponStatus)
  status?: CouponStatus;

  @IsOptional()
  @IsEnum(EligibilityType)
  eligibilityType?: EligibilityType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleProductIds?: string[];
}
