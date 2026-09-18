import { OrdersService } from './orders.service';
import { CouponEngineService } from '../coupons/coupon-engine.service';
import { BadRequestException } from '@nestjs/common';

describe('OrdersService - Transactional Redemption & Concurrency Protection', () => {
  let ordersService: OrdersService;
  let mockPrisma: any;
  let couponEngine: CouponEngineService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb(mockPrisma);
      }),
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            title: 'Coastal Blue Cotton Shirt',
            price: 1499,
            stock: 10,
            categoryId: 'cat1',
          },
        ]),
        update: jest.fn(),
      },
      coupon: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cust1', email: 'test@example.com' }),
      },
      order: {
        count: jest.fn().mockResolvedValue(5),
        create: jest.fn().mockImplementation((args) => ({
          id: 'ord1',
          ...args.data,
        })),
      },
      couponUsage: {
        create: jest.fn().mockResolvedValue({ id: 'usage1' }),
      },
    };

    couponEngine = new CouponEngineService(mockPrisma as any);
    ordersService = new OrdersService(mockPrisma as any, couponEngine);
  });

  it('should successfully place an order and record transactional coupon redemption', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      companyId: 'comp1',
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

    const order = await ordersService.createOrder({
      customerEmail: 'test@example.com',
      shippingName: 'Vikram Singh',
      shippingAddress: '123 MG Road',
      shippingCity: 'Bengaluru',
      shippingPostalCode: '560001',
      couponCode: 'STELLAR50',
      items: [{ productId: 'p1', quantity: 1, size: 'M' }],
    });

    expect(order).toBeDefined();
    expect(order.subtotal).toBe(1499);
    expect(order.discountAmount).toBe(50);
    expect(order.totalAmount).toBe(1449);
    expect(mockPrisma.coupon.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { usageCount: { increment: 1 } },
    });
    expect(mockPrisma.couponUsage.create).toHaveBeenCalled();
  });

  it('should reject order if coupon usage limit has been reached at checkout time', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      companyId: 'comp1',
      code: 'STELLAR50',
      status: 'ACTIVE',
      type: 'FIXED',
      value: 50,
      minimumOrderAmount: 500,
      usageLimit: 100,
      usageCount: 100, // Reached limit
      startsAt: new Date('2026-01-01'),
      expiresAt: new Date('2026-12-31'),
      company: { id: 'comp1', name: 'Stellar Solutions', status: 'ACTIVE' },
      eligibleCategories: [],
      eligibleProducts: [],
    });

    await expect(
      ordersService.createOrder({
        customerEmail: 'test@example.com',
        shippingName: 'Vikram Singh',
        shippingAddress: '123 MG Road',
        shippingCity: 'Bengaluru',
        shippingPostalCode: '560001',
        couponCode: 'STELLAR50',
        items: [{ productId: 'p1', quantity: 1, size: 'M' }],
      }),
    ).rejects.toThrow(BadRequestException);

    // Coupon increment and usage record must NOT be created
    expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
    expect(mockPrisma.couponUsage.create).not.toHaveBeenCalled();
  });

  it('should successfully process an order with multiple sizes of the same product', async () => {
    mockPrisma.coupon.findUnique.mockResolvedValue({
      id: 'c1',
      companyId: 'comp1',
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

    const order = await ordersService.createOrder({
      customerEmail: 'test@example.com',
      shippingName: 'Vikram Singh',
      shippingAddress: '123 MG Road',
      shippingCity: 'Bengaluru',
      shippingPostalCode: '560001',
      couponCode: 'STELLAR50',
      items: [
        { productId: 'p1', quantity: 1, size: 'M' },
        { productId: 'p1', quantity: 1, size: 'L' },
      ],
    });

    expect(order).toBeDefined();
    expect(order.subtotal).toBe(2998);
    expect(order.discountAmount).toBe(50);
    expect(order.totalAmount).toBe(2948);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stock: { decrement: 2 } },
    });
  });
});
