import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CouponEngineService } from '../coupons/coupon-engine.service';
import { OrderStatus, PaymentStatus } from '../common/types';
import { Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly couponEngineService: CouponEngineService,
  ) {}

  /**
   * Transactional Order Creation and Coupon Redemption.
   * Executes inside an atomic Prisma transaction to guarantee consistency and concurrency safety.
   */
  async createOrder(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch trusted product details from database (resilient to id, slug, and sku)
      const rawIdentifiers = Array.from(new Set(dto.items.map((i) => i.productId)));
      const dbProducts = await tx.product.findMany({
        where: {
          OR: [
            { id: { in: rawIdentifiers } },
            { slug: { in: rawIdentifiers } },
            { sku: { in: rawIdentifiers } },
          ],
        },
        include: { category: true },
      });

      const productMap = new Map<string, typeof dbProducts[0]>();
      for (const prod of dbProducts) {
        productMap.set(prod.id, prod);
        productMap.set(prod.slug, prod);
        productMap.set(prod.sku, prod);
      }

      for (const item of dto.items) {
        if (!productMap.has(item.productId)) {
          throw new BadRequestException(`One or more products in the order could not be found.`);
        }
      }

      // Validate total quantity per product across all chosen sizes
      const totalRequestedQuantities = new Map<string, number>();
      for (const item of dto.items) {
        const prod = productMap.get(item.productId)!;
        const current = totalRequestedQuantities.get(prod.id) || 0;
        totalRequestedQuantities.set(prod.id, current + item.quantity);
      }

      for (const [prodId, totalQty] of totalRequestedQuantities.entries()) {
        const prod = dbProducts.find((p) => p.id === prodId);
        if (!prod) {
          throw new BadRequestException(`Product ${prodId} not found.`);
        }
        if (prod.stock < totalQty) {
          throw new BadRequestException(`Insufficient stock for "${prod.title}". Available: ${prod.stock}`);
        }
      }

      // 2. Validate line items & compute authoritative subtotal
      let authoritativeSubtotal = 0;
      const orderItemsData: {
        productId: string;
        title: string;
        price: number;
        quantity: number;
        size?: string;
        subtotal: number;
        categoryId?: string;
      }[] = [];

      for (const item of dto.items) {
        const prod = productMap.get(item.productId)!;
        const itemSubtotal = prod.price * item.quantity;
        authoritativeSubtotal += itemSubtotal;

        orderItemsData.push({
          productId: prod.id,
          title: prod.title,
          price: prod.price,
          quantity: item.quantity,
          size: item.size,
          subtotal: itemSubtotal,
          categoryId: prod.categoryId,
        });
      }

      authoritativeSubtotal = Math.round(authoritativeSubtotal * 100) / 100;

      // 3. Coupon Validation & Transactional Redemption Logic
      let authoritativeDiscount = 0;
      let appliedCoupon: any = null;

      if (dto.couponCode && dto.couponCode.trim()) {
        const normalizedCode = dto.couponCode.trim().toUpperCase();

        // Validate coupon with authoritative engine inside transaction
        const validationResult = await this.couponEngineService.validateCoupon(
          {
            code: normalizedCode,
            cartTotal: authoritativeSubtotal,
            items: orderItemsData.map((it) => ({
              productId: it.productId,
              categoryId: it.categoryId,
              quantity: it.quantity,
              price: it.price,
            })),
          },
          tx,
        );

        if (!validationResult.valid) {
          throw new BadRequestException(validationResult.message);
        }

        // Fetch coupon for atomic update check
        appliedCoupon = await tx.coupon.findUnique({
          where: { id: validationResult.couponId },
          include: { company: true },
        });

        if (!appliedCoupon) {
          throw new BadRequestException('Coupon not found.');
        }

        // Enforce concurrency limit: atomic check before increment
        if (
          appliedCoupon.usageLimit !== null &&
          appliedCoupon.usageLimit !== undefined &&
          appliedCoupon.usageCount >= appliedCoupon.usageLimit
        ) {
          throw new BadRequestException('Coupon usage limit reached.');
        }

        // Increment usage count atomically
        await tx.coupon.update({
          where: { id: appliedCoupon.id },
          data: {
            usageCount: { increment: 1 },
          },
        });

        authoritativeDiscount = validationResult.discountAmount;
      }

      const finalTotalAmount = Math.max(0, Math.round((authoritativeSubtotal - authoritativeDiscount) * 100) / 100);

      // 4. Find or create Customer
      let customer = await tx.customer.findUnique({
        where: { email: dto.customerEmail.toLowerCase().trim() },
      });

      if (!customer) {
        const nameParts = dto.shippingName.trim().split(' ');
        customer = await tx.customer.create({
          data: {
            email: dto.customerEmail.toLowerCase().trim(),
            firstName: nameParts[0] || 'Guest',
            lastName: nameParts.slice(1).join(' ') || '',
          },
        });
      }

      // 5. Generate Order Number
      const orderCount = await tx.order.count();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `NAV-${new Date().getFullYear()}-${1000 + orderCount + 1}-${randomSuffix}`;

      // 6. Create Order record
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          customerEmail: dto.customerEmail.toLowerCase().trim(),
          shippingName: dto.shippingName.trim(),
          shippingAddress: dto.shippingAddress.trim(),
          shippingCity: dto.shippingCity.trim(),
          shippingPostalCode: dto.shippingPostalCode.trim(),
          shippingCountry: dto.shippingCountry?.trim() || 'India',
          subtotal: authoritativeSubtotal,
          discountAmount: authoritativeDiscount,
          couponCode: appliedCoupon ? appliedCoupon.code : null,
          shippingAmount: 0, // Free shipping
          totalAmount: finalTotalAmount,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              title: item.title,
              price: item.price,
              quantity: item.quantity,
              size: item.size || null,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      // 7. Record Coupon Usage
      if (appliedCoupon && authoritativeDiscount > 0) {
        await tx.couponUsage.create({
          data: {
            couponId: appliedCoupon.id,
            companyId: appliedCoupon.companyId,
            orderId: order.id,
            customerId: customer.id,
            customerEmail: customer.email,
            orderAmount: authoritativeSubtotal,
            discountAmount: authoritativeDiscount,
          },
        });
      }

      // 8. Deduct stock per product
      for (const [prodId, totalQty] of totalRequestedQuantities.entries()) {
        await tx.product.update({
          where: { id: prodId },
          data: {
            stock: { decrement: totalQty },
          },
        });
      }

      this.logger.log(`Order ${order.orderNumber} placed successfully with discount ₹${authoritativeDiscount}`);
      return order;
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

    const where: Prisma.OrderWhereInput = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search } },
        { customerEmail: { contains: search } },
        { shippingName: { contains: search } },
        { couponCode: { contains: search } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          couponUsage: {
            include: { coupon: true, company: true },
          },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        items: {
          include: { product: true },
        },
        couponUsage: {
          include: {
            coupon: true,
            company: true,
          },
        },
        customer: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with identifier ${id} not found.`);
    }

    return order;
  }
}
