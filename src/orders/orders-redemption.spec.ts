import { OrdersService } from './orders.service';
import { CouponEngineService } from '../coupons/coupon-engine.service';
import { BadRequestException } from '@nestjs/common';

describe('OrdersService - Transactional Redemption & Concurrency Protection', () => {
  let ordersService: OrdersService;
  let mockPrisma: any;
  let couponEngine: CouponEngineService;

  const sampleProducts = [
    {
      id: 'p1',
      slug: 'coastal-blue-cotton-shirt',
      sku: 'NAV-SHIRT-001',
      title: 'Coastal Blue Cotton Shirt',
      price: 1499,
      stock: 10,
      categoryId: 'cat1',
    },
    {
      id: 'p2',
      slug: 'forest-linen-shirt',
      sku: 'NAV-SHIRT-008',
      title: 'Forest Linen Shirt',
      price: 2299,
      stock: 3,
      categoryId: 'cat2',
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(async (cb) => {
        return cb(mockPrisma);
      }),
      product: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve(sampleProducts)),
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

    expect(mockPrisma.coupon.update).not.toHaveBeenCalled();
    expect(mockPrisma.couponUsage.create).not.toHaveBeenCalled();
  });

  it('should successfully process an order with multiple sizes of the same product and aggregate stock decrements', async () => {
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
        { productId: 'p1', quantity: 2, size: 'L' },
      ],
    });

    expect(order).toBeDefined();
    expect(order.subtotal).toBe(1499 * 3);
    expect(order.discountAmount).toBe(50);
    expect(order.totalAmount).toBe(1499 * 3 - 50);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stock: { decrement: 3 } },
    });
  });

  it('should reject order if requested quantity across all chosen sizes exceeds available stock', async () => {
    await expect(
      ordersService.createOrder({
        customerEmail: 'test@example.com',
        shippingName: 'Vikram Singh',
        shippingAddress: '123 MG Road',
        shippingCity: 'Bengaluru',
        shippingPostalCode: '560001',
        items: [
          { productId: 'p2', quantity: 2, size: 'M' },
          { productId: 'p2', quantity: 2, size: 'L' }, // Total requested = 4, but stock = 3
        ],
      }),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('should reject order if items array is empty', async () => {
    await expect(
      ordersService.createOrder({
        customerEmail: 'test@example.com',
        shippingName: 'Vikram Singh',
        shippingAddress: '123 MG Road',
        shippingCity: 'Bengaluru',
        shippingPostalCode: '560001',
        items: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject order if a product identifier cannot be resolved', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await expect(
      ordersService.createOrder({
        customerEmail: 'test@example.com',
        shippingName: 'Vikram Singh',
        shippingAddress: '123 MG Road',
        shippingCity: 'Bengaluru',
        shippingPostalCode: '560001',
        items: [{ productId: 'non-existent-id', quantity: 1, size: 'M' }],
      }),
    ).rejects.toThrow(/One or more products in the order could not be found/);
  });
});
