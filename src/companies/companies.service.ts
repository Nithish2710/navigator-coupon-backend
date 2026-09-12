import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/create-company.dto';
import { CompanyStatus } from '../common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.company.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Company with code ${code} already exists.`);
    }

    return this.prisma.company.create({
      data: {
        name: dto.name.trim(),
        code,
        contactPerson: dto.contactPerson?.trim() ?? null,
        email: dto.email?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        status: dto.status ?? CompanyStatus.ACTIVE,
      },
    });
  }

  async findAll(query?: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { contactPerson: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              coupons: true,
              usages: true,
            },
          },
        },
      }),
    ]);

    // Calculate total discount given per company
    const enhancedItems = await Promise.all(
      items.map(async (company) => {
        const discountAgg = await this.prisma.couponUsage.aggregate({
          where: { companyId: company.id },
          _sum: { discountAmount: true },
        });

        const activeCouponsCount = await this.prisma.coupon.count({
          where: {
            companyId: company.id,
            status: 'ACTIVE',
            expiresAt: { gte: new Date() },
          },
        });

        return {
          ...company,
          totalCoupons: company._count.coupons,
          activeCoupons: activeCouponsCount,
          totalRedemptions: company._count.usages,
          totalDiscountGiven: discountAgg._sum.discountAmount || 0,
        };
      }),
    );

    return {
      items: enhancedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        coupons: {
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { usages: true } },
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found.`);
    }

    const discountAgg = await this.prisma.couponUsage.aggregate({
      where: { companyId: id },
      _sum: { discountAmount: true },
    });

    const now = new Date();
    const activeCouponsCount = company.coupons.filter(
      (c) => c.status === 'ACTIVE' && (!c.expiresAt || new Date(c.expiresAt) >= now),
    ).length;

    return {
      ...company,
      totalCoupons: company.coupons.length,
      activeCoupons: activeCouponsCount,
      totalRedemptions: company.coupons.reduce((acc, c) => acc + c.usageCount, 0),
      totalDiscountGiven: discountAgg._sum.discountAmount || 0,
    };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Company with ID ${id} not found.`);
    }

    if (dto.code) {
      const code = dto.code.trim().toUpperCase();
      const codeCheck = await this.prisma.company.findUnique({ where: { code } });
      if (codeCheck && codeCheck.id !== id) {
        throw new ConflictException(`Company code ${code} is already in use.`);
      }
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        contactPerson: dto.contactPerson !== undefined ? dto.contactPerson?.trim() : undefined,
        email: dto.email !== undefined ? dto.email?.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
        status: dto.status,
      },
    });
  }

  async toggleStatus(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found.`);
    }

    const nextStatus = company.status === CompanyStatus.ACTIVE ? CompanyStatus.INACTIVE : CompanyStatus.ACTIVE;
    return this.prisma.company.update({
      where: { id },
      data: { status: nextStatus },
    });
  }

  async remove(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found.`);
    }
    return this.prisma.company.delete({ where: { id } });
  }

  async getAnalytics(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found.`);
    }

    const [totalDiscountAgg, totalOrderAgg, usages] = await Promise.all([
      this.prisma.couponUsage.aggregate({
        where: { companyId: id },
        _sum: { discountAmount: true },
      }),
      this.prisma.couponUsage.aggregate({
        where: { companyId: id },
        _sum: { orderAmount: true },
      }),
      this.prisma.couponUsage.findMany({
        where: { companyId: id },
        orderBy: { redeemedAt: 'desc' },
        take: 50,
        include: { coupon: true, order: true },
      }),
    ]);

    return {
      companyId: id,
      companyName: company.name,
      totalRedemptions: usages.length,
      totalDiscountGiven: totalDiscountAgg._sum.discountAmount || 0,
      totalOrderVolume: totalOrderAgg._sum.orderAmount || 0,
      recentUsages: usages,
    };
  }
}
