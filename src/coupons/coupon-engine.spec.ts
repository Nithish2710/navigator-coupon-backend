import { CouponEngineService } from './coupon-engine.service';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

describe('CouponEngineService', () => {
  let service: CouponEngineService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      coupon: {
        findUnique: jest.fn(),
      },
    };
    service = new CouponEngineService(mockPrisma as any);
  });

  it('should return valid=false for empty or non-existent coupon', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue(null);

    const result = await service.validateCoupon({
      code: 'NONEXISTENT',
      cartTotal: 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_NOT_FOUND');
    expect(result.discountAmount).toBe(0);
  });

  it('should return valid=false when company is inactive', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'STELLAR50',
      status: 'ACTIVE',
      type: 'FIXED',
      value: 50,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'Stellar', status: 'INACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'STELLAR50',
      cartTotal: 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COMPANY_INACTIVE');
  });

  it('should return valid=false when coupon itself is inactive', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'STELLAR50',
      status: 'INACTIVE',
      type: 'FIXED',
      value: 50,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'Stellar', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'STELLAR50',
      cartTotal: 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_INACTIVE');
  });

  it('should return valid=false when coupon is expired', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'EXPIRED10',
      status: 'ACTIVE',
      type: 'FIXED',
      value: 10,
      startsAt: new Date('2025-01-01'),
      expiresAt: new Date('2025-12-31'), // in the past
      company: { id: 'comp1', name: 'Stellar', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'EXPIRED10',
      cartTotal: 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('COUPON_EXPIRED');
  });

  it('should return valid=false when usage limit is reached', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'LIMITED',
      status: 'ACTIVE',
      type: 'FIXED',
      value: 50,
      usageLimit: 100,
      usageCount: 100, // maxed out
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'Stellar', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'LIMITED',
      cartTotal: 1000,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('USAGE_LIMIT_REACHED');
  });

  it('should return valid=false when minimum order amount is not met', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'STELLAR50',
      status: 'ACTIVE',
      type: 'FIXED',
      value: 50,
      minimumOrderAmount: 500,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'Stellar', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'STELLAR50',
      cartTotal: 400, // less than 500
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('MINIMUM_ORDER_NOT_MET');
  });

  it('should calculate FIXED discount correctly for valid scenario (STELLAR50 on ₹1,100)', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      code: 'STELLAR50',
      status: 'ACTIVE',
      type: 'FIXED',
      value: 50,
      minimumOrderAmount: 500,
      usageLimit: 500,
      usageCount: 0,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'Stellar Solutions', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'STELLAR50',
      cartTotal: 1100,
    });

    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(50);
    expect(result.originalAmount).toBe(1100);
    expect(result.finalAmount).toBe(1050);
    expect(result.companyName).toBe('Stellar Solutions');
  });

  it('should calculate PERCENTAGE discount and enforce maximumDiscount ceiling', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c2',
      code: 'SAVE20',
      status: 'ACTIVE',
      type: 'PERCENTAGE',
      value: 20, // 20% of 2000 = 400
      maximumDiscount: 250, // Capped at 250
      minimumOrderAmount: 1000,
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'TechCorp', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    const result = await service.validateCoupon({
      code: 'SAVE20',
      cartTotal: 2000,
    });

    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(250); // Capped by maximumDiscount
    expect(result.finalAmount).toBe(1750);
  });
});
