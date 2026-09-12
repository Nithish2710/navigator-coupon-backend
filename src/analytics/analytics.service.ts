import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCouponDashboardStats() {
    const now = new Date();

    const [
      totalCompanies,
      totalCoupons,
      activeCoupons,
      expiredCoupons,
      totalRedemptions,
      discountAgg,
      orderVolumeAgg,
      recentRedemptions,
      topCompaniesRaw,
      topCouponsRaw,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.coupon.count(),
      this.prisma.coupon.count({
        where: {
          status: 'ACTIVE',
          expiresAt: { gte: now },
        },
      }),
      this.prisma.coupon.count({
        where: {
          expiresAt: { lt: now },
        },
      }),
      this.prisma.couponUsage.count(),
      this.prisma.couponUsage.aggregate({
        _sum: { discountAmount: true },
      }),
      this.prisma.couponUsage.aggregate({
        _sum: { orderAmount: true },
      }),
      this.prisma.couponUsage.findMany({
        take: 10,
        orderBy: { redeemedAt: 'desc' },
        include: {
          coupon: true,
          company: true,
          order: true,
          customer: true,
        },
      }),
      this.prisma.company.findMany({
        take: 5,
        orderBy: {
          usages: {
            _count: 'desc',
          },
        },
        include: {
          _count: {
            select: {
              coupons: true,
              usages: true,
            },
          },
        },
      }),
      this.prisma.coupon.findMany({
        take: 5,
        orderBy: {
          usageCount: 'desc',
        },
        include: {
          company: true,
        },
      }),
    ]);

    const totalDiscountGiven = discountAgg._sum.discountAmount || 0;
    const totalOrderVolume = orderVolumeAgg._sum.orderAmount || 0;
    const avgDiscountPerOrder =
      totalRedemptions > 0 ? Math.round((totalDiscountGiven / totalRedemptions) * 100) / 100 : 0;

    // Top companies with discounts
    const topCompanies = await Promise.all(
      topCompaniesRaw.map(async (comp) => {
        const compDiscount = await this.prisma.couponUsage.aggregate({
          where: { companyId: comp.id },
          _sum: { discountAmount: true },
        });
        return {
          id: comp.id,
          name: comp.name,
          code: comp.code,
          totalCoupons: comp._count.coupons,
          totalRedemptions: comp._count.usages,
          totalDiscountGiven: compDiscount._sum.discountAmount || 0,
        };
      }),
    );

    // Format top coupons
    const topCoupons = topCouponsRaw.map((c) => ({
      id: c.id,
      code: c.code,
      companyName: c.company.name,
      type: c.type,
      value: c.value,
      usageCount: c.usageCount,
      usageLimit: c.usageLimit,
      remaining: c.usageLimit ? Math.max(0, c.usageLimit - c.usageCount) : null,
      status: c.status,
    }));

    return {
      summary: {
        totalCompanies,
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalRedemptions,
        totalDiscountGiven,
        totalOrderVolume,
        avgDiscountPerOrder,
      },
      topCompanies,
      topCoupons,
      recentRedemptions,
    };
  }
}
