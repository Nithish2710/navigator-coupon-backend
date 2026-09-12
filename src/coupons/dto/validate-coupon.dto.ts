import { IsString, IsNotEmpty, IsNumber, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  @Min(0)
  cartTotal: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items?: CartItemDto[];
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  couponId?: string;
  companyId?: string;
  companyName?: string;
  discountType?: 'FIXED' | 'PERCENTAGE';
  discountValue?: number;
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  reason?: string;
  message: string;
}
