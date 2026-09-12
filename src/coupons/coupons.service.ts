import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/create-coupon.dto';
import { CouponStatus, DiscountType, EligibilityType } from '../common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto) {
    const code = dto.code.trim().toUpperCase();

    // Ensure coupon code uniqueness
    const existing = await this.prisma.coupon.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Coupon with code ${code} already exists.`);
    }

    // Verify company exists
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });
    if (!company) {
      throw new NotFoundException(`Company with ID ${dto.companyId} not found.`);
    }

    return this.prisma.coupon.create({
      data: {
        companyId: dto.companyId,
        code,
        type: dto.type,
        value: dto.value,
        minimumOrderAmount: dto.minimumOrderAmount ?? null,
        maximumDiscount: dto.maximumDiscount ?? null,
        usageLimit: dto.usageLimit ?? null,
        startsAt: new Date(dto.startsAt),
        expiresAt: new Date(dto.expiresAt),
        status: dto.status ?? CouponStatus.ACTIVE,
        eligibilityType: dto.eligibilityType ?? EligibilityType.ALL,
        eligibleCategories: dto.eligibleCategoryIds?.length
          ? {
              create: dto.eligibleCategoryIds.map((catId) => ({
                categoryId: catId,
              })),
            }
          : undefined,
        eligibleProducts: dto.eligibleProductIds?.length
          ? {
              create: dto.eligibleProductIds.map((prodId) => ({
                productId: prodId,
              })),
            }
          : undefined,
      },
      include: {
        company: true,
        eligibleCategories: { include: { category: true } },
        eligibleProducts: { include: { product: true } },
      },
    });
  }

  async findAll(query?: {
    search?: string;
    companyId?: string;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CouponWhereInput = {};

    if (query?.companyId) {
      where.companyId = query.companyId;
    }

    if (query?.type) {
      where.type = query.type;
    }

    const now = new Date();

    if (query?.status) {
      if (query.status === 'ACTIVE') {
        where.status = CouponStatus.ACTIVE;
        where.expiresAt = { gte: now };
      } else if (query.status === 'INACTIVE') {
        where.status = CouponStatus.INACTIVE;
      } else if (query.status === 'EXPIRED') {
        where.expiresAt = { lt: now };
      }
    }

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { code: { contains: search } },
        { company: { name: { contains: search } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.coupon.count({ where }),
      this.prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
          _count: {
            select: { usages: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((coupon) => {
        let computedStatus: string = coupon.status;
        if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
          computedStatus = 'EXPIRED';
        } else if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
          computedStatus = 'USAGE_LIMIT_REACHED';
        }
        return {
          ...coupon,
          computedStatus,
          remainingUsage: coupon.usageLimit ? Math.max(0, coupon.usageLimit - coupon.usageCount) : null,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        company: true,
        eligibleCategories: { include: { category: true } },
        eligibleProducts: { include: { product: true } },
        usages: {
          take: 20,
          orderBy: { redeemedAt: 'desc' },
          include: {
            order: true,
            customer: true,
          },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found.`);
    }

    const totalDiscountAgg = await this.prisma.couponUsage.aggregate({
      where: { couponId: id },
      _sum: { discountAmount: true },
    });

    const now = new Date();
    let computedStatus: string = coupon.status;
    if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
      computedStatus = 'EXPIRED';
    } else if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      computedStatus = 'USAGE_LIMIT_REACHED';
    }

    return {
      ...coupon,
      computedStatus,
      totalDiscountGiven: totalDiscountAgg._sum.discountAmount || 0,
      remainingUsage: coupon.usageLimit ? Math.max(0, coupon.usageLimit - coupon.usageCount) : null,
    };
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Coupon with ID ${id} not found.`);
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const codeCheck = await this.prisma.coupon.findUnique({ where: { code } });
      if (codeCheck && codeCheck.id !== id) {
        throw new ConflictException(`Coupon code ${code} is already in use.`);
      }
    }

    if (dto.eligibleCategoryIds !== undefined) {
      await this.prisma.couponEligibleCategory.deleteMany({ where: { couponId: id } });
      if (dto.eligibleCategoryIds.length > 0) {
        await this.prisma.couponEligibleCategory.createMany({
          data: dto.eligibleCategoryIds.map((categoryId) => ({ couponId: id, categoryId })),
        });
      }
    }

    if (dto.eligibleProductIds !== undefined) {
      await this.prisma.couponEligibleProduct.deleteMany({ where: { couponId: id } });
      if (dto.eligibleProductIds.length > 0) {
        await this.prisma.couponEligibleProduct.createMany({
          data: dto.eligibleProductIds.map((productId) => ({ couponId: id, productId })),
        });
      }
    }

    return this.prisma.coupon.update({
      where: { id },
      data: {
        companyId: dto.companyId,
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        type: dto.type,
        value: dto.value,
        minimumOrderAmount: dto.minimumOrderAmount !== undefined ? dto.minimumOrderAmount : undefined,
        maximumDiscount: dto.maximumDiscount !== undefined ? dto.maximumDiscount : undefined,
        usageLimit: dto.usageLimit !== undefined ? dto.usageLimit : undefined,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: dto.status,
        eligibilityType: dto.eligibilityType,
      },
      include: {
        company: true,
        eligibleCategories: { include: { category: true } },
        eligibleProducts: { include: { product: true } },
      },
    });
  }

  async toggleStatus(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found.`);
    }

    const nextStatus = coupon.status === CouponStatus.ACTIVE ? CouponStatus.INACTIVE : CouponStatus.ACTIVE;
    return this.prisma.coupon.update({
      where: { id },
      data: { status: nextStatus },
      include: { company: true },
    });
  }

  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon with ID ${id} not found.`);
    }
    return this.prisma.coupon.delete({ where: { id } });
  }

  async getUsageHistory(id: string, query?: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, usages] = await Promise.all([
      this.prisma.couponUsage.count({ where: { couponId: id } }),
      this.prisma.couponUsage.findMany({
        where: { couponId: id },
        skip,
        take: limit,
        orderBy: { redeemedAt: 'desc' },
        include: {
          order: true,
          customer: true,
          company: true,
        },
      }),
    ]);

    return {
      usages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
