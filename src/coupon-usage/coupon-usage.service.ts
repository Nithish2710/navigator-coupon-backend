import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CouponUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: {
    couponId?: string;
    companyId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CouponUsageWhereInput = {};

    if (query?.couponId) {
      where.couponId = query.couponId;
    }

    if (query?.companyId) {
      where.companyId = query.companyId;
    }

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { customerEmail: { contains: search } },
        { coupon: { code: { contains: search } } },
        { company: { name: { contains: search } } },
        { order: { orderNumber: { contains: search } } },
      ];
    }

    const [total, usages] = await Promise.all([
      this.prisma.couponUsage.count({ where }),
      this.prisma.couponUsage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { redeemedAt: 'desc' },
        include: {
          coupon: true,
          company: true,
          order: true,
          customer: true,
        },
      }),
    ]);

    return {
      items: usages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
