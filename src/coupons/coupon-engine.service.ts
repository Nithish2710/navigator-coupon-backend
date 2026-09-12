import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ValidateCouponDto, CouponValidationResult } from './dto/validate-coupon.dto';
import { CompanyStatus, CouponStatus, DiscountType, EligibilityType } from '../common/types';

@Injectable()
export class CouponEngineService {
  private readonly logger = new Logger(CouponEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Authoritative coupon validation engine.
   * Performs read-only evaluation without modifying usage counts.
   */
  async validateCoupon(
    dto: ValidateCouponDto,
    prismaClient: any = this.prisma,
  ): Promise<CouponValidationResult> {
    const rawCode = dto.code ? dto.code.trim().toUpperCase() : '';
    const cartTotal = Number(dto.cartTotal) || 0;

    if (!rawCode) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        originalAmount: cartTotal,
        finalAmount: cartTotal,
        reason: 'INVALID_CODE',
        message: 'Please enter a valid coupon code.',
      };
    }

    // 1. Find coupon by code with company and eligibility relations
    const coupon = await prismaClient.coupon.findUnique({
      where: { code: rawCode },
      include: {
        company: true,
        eligibleCategories: true,
        eligibleProducts: true,
      },
    });

    // 2. Check: Coupon exists
    if (!coupon) {
      return {
        valid: false,
        code: rawCode,
        discountAmount: 0,
        originalAmount: cartTotal,
        finalAmount: cartTotal,
        reason: 'COUPON_NOT_FOUND',
        message: 'Invalid coupon code.',
      };
    }

    // 3. Check: Company exists and is active
    if (!coupon.company || coupon.company.status !== CompanyStatus.ACTIVE) {
      return {
        valid: false,
        code: coupon.code,
        discountAmount: 0,
        originalAmount: cartTotal,
        finalAmount: cartTotal,
        reason: 'COMPANY_INACTIVE',
        message: 'The corporate partner for this coupon is currently inactive.',
      };
    }

    // 4. Check: Coupon status is active
    if (coupon.status !== CouponStatus.ACTIVE) {
      return {
        valid: false,
        code: coupon.code,
        discountAmount: 0,
        originalAmount: cartTotal,
        finalAmount: cartTotal,
        reason: 'COUPON_INACTIVE',
        message: 'This coupon is inactive.',
      };
    }

    // 5. Check: Date validity
    const now = new Date();
    if (coupon.startsAt && now < new Date(coupon.startsAt)) {
      return {
        valid: false,
        code: coupon.code,
        discountAmount: 0,
        originalAmount: cartTotal,
        finalAmount: cartTotal,
        reason: 'COUPON_NOT_STARTED',
        message: `This coupon will become active on ${new Date(coupon.startsAt).toLocaleDateString()}.`,
      };
    }

    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
      return {
        valid: false,
        code: coupon.code,
        discountAmount: 0,
        originalAmount: cartTotal,
        finalAmount: cartTotal,
        reason: 'COUPON_EXPIRED',
        message: 'Coupon has expired.',
      };
    }

    // 6. Check: Usage limit
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
      if (coupon.usageCount >= coupon.usageLimit) {
        return {
          valid: false,
          code: coupon.code,
          discountAmount: 0,
          originalAmount: cartTotal,
          finalAmount: cartTotal,
          reason: 'USAGE_LIMIT_REACHED',
          message: 'Coupon usage limit reached.',
        };
      }
    }

    // 7. Check: Minimum order amount
    if (coupon.minimumOrderAmount !== null && coupon.minimumOrderAmount !== undefined) {
      if (cartTotal < coupon.minimumOrderAmount) {
        return {
          valid: false,
          code: coupon.code,
          discountAmount: 0,
          originalAmount: cartTotal,
          finalAmount: cartTotal,
          reason: 'MINIMUM_ORDER_NOT_MET',
          message: `Minimum order amount is ₹${coupon.minimumOrderAmount.toLocaleString('en-IN')}.`,
        };
      }
    }

    // 8. Check: Product and Category Eligibility
    let applicableSubtotal = cartTotal;

    if (dto.items && dto.items.length > 0) {
      if (coupon.eligibilityType === EligibilityType.CATEGORY) {
        const allowedCatIds = new Set(coupon.eligibleCategories.map((c: any) => c.categoryId));
        const eligibleItems = dto.items.filter((item) => item.categoryId && allowedCatIds.has(item.categoryId));

        if (eligibleItems.length === 0) {
          return {
            valid: false,
            code: coupon.code,
            discountAmount: 0,
            originalAmount: cartTotal,
            finalAmount: cartTotal,
            reason: 'NOT_ELIGIBLE_CATEGORY',
            message: 'Coupon is not applicable to the categories in your cart.',
          };
        }
        applicableSubtotal = eligibleItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      } else if (coupon.eligibilityType === EligibilityType.PRODUCT) {
        const allowedProdIds = new Set(coupon.eligibleProducts.map((p: any) => p.productId));
        const eligibleItems = dto.items.filter((item) => allowedProdIds.has(item.productId));

        if (eligibleItems.length === 0) {
          return {
            valid: false,
            code: coupon.code,
            discountAmount: 0,
            originalAmount: cartTotal,
            finalAmount: cartTotal,
            reason: 'NOT_ELIGIBLE_PRODUCT',
            message: 'Coupon is not applicable to the selected products in your cart.',
          };
        }
        applicableSubtotal = eligibleItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
      }
    }

    // 9. Calculate discount
    let calculatedDiscount = 0;
    if (coupon.type === DiscountType.PERCENTAGE) {
      calculatedDiscount = (applicableSubtotal * coupon.value) / 100;
    } else if (coupon.type === DiscountType.FIXED) {
      calculatedDiscount = Math.min(coupon.value, applicableSubtotal);
    }

    // 10. Apply Maximum Discount ceiling if configured
    if (coupon.maximumDiscount !== null && coupon.maximumDiscount !== undefined && coupon.maximumDiscount > 0) {
      calculatedDiscount = Math.min(calculatedDiscount, coupon.maximumDiscount);
    }

    // Format & Round
    calculatedDiscount = Math.round(calculatedDiscount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((cartTotal - calculatedDiscount) * 100) / 100);

    return {
      valid: true,
      code: coupon.code,
      couponId: coupon.id,
      companyId: coupon.companyId,
      companyName: coupon.company.name,
      discountType: coupon.type,
      discountValue: coupon.value,
      discountAmount: calculatedDiscount,
      originalAmount: cartTotal,
      finalAmount,
      message: `Coupon ${coupon.code} applied successfully.`,
    };
  }
}
