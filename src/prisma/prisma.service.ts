import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PrismaService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to database. Checking schema & initial seed data...');

    try {
      // 1. Ensure SQLite schema tables exist
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Company" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "name" TEXT NOT NULL,
          "code" TEXT NOT NULL UNIQUE,
          "contactPerson" TEXT,
          "email" TEXT,
          "phone" TEXT,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Category" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "name" TEXT NOT NULL,
          "slug" TEXT NOT NULL UNIQUE,
          "description" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Product" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "title" TEXT NOT NULL,
          "slug" TEXT NOT NULL UNIQUE,
          "description" TEXT NOT NULL,
          "price" REAL NOT NULL,
          "compareAtPrice" REAL,
          "sku" TEXT NOT NULL UNIQUE,
          "stock" INTEGER NOT NULL DEFAULT 100,
          "fabric" TEXT,
          "color" TEXT,
          "colourHex" TEXT,
          "images" TEXT NOT NULL DEFAULT '[]',
          "details" TEXT DEFAULT '[]',
          "fabricCare" TEXT,
          "badge" TEXT,
          "categoryId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Coupon" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "companyId" TEXT NOT NULL,
          "code" TEXT NOT NULL UNIQUE,
          "type" TEXT NOT NULL,
          "value" REAL NOT NULL,
          "minimumOrderAmount" REAL,
          "maximumDiscount" REAL,
          "usageLimit" INTEGER,
          "usageCount" INTEGER NOT NULL DEFAULT 0,
          "startsAt" DATETIME NOT NULL,
          "expiresAt" DATETIME NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "eligibilityType" TEXT NOT NULL DEFAULT 'ALL',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CouponEligibleCategory" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "couponId" TEXT NOT NULL,
          "categoryId" TEXT NOT NULL,
          FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          UNIQUE("couponId", "categoryId")
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CouponEligibleProduct" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "couponId" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          UNIQUE("couponId", "productId")
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Customer" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "email" TEXT NOT NULL UNIQUE,
          "firstName" TEXT,
          "lastName" TEXT,
          "phone" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Order" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "orderNumber" TEXT NOT NULL UNIQUE,
          "customerId" TEXT,
          "customerEmail" TEXT NOT NULL,
          "shippingName" TEXT NOT NULL,
          "shippingAddress" TEXT NOT NULL,
          "shippingCity" TEXT NOT NULL,
          "shippingPostalCode" TEXT NOT NULL,
          "shippingCountry" TEXT NOT NULL DEFAULT 'India',
          "subtotal" REAL NOT NULL,
          "discountAmount" REAL NOT NULL DEFAULT 0,
          "couponCode" TEXT,
          "shippingAmount" REAL NOT NULL DEFAULT 0,
          "totalAmount" REAL NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
          "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OrderItem" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "orderId" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "price" REAL NOT NULL,
          "quantity" INTEGER NOT NULL,
          "size" TEXT,
          "subtotal" REAL NOT NULL,
          FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);

      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CouponUsage" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "couponId" TEXT NOT NULL,
          "companyId" TEXT NOT NULL,
          "orderId" TEXT NOT NULL UNIQUE,
          "customerId" TEXT,
          "customerEmail" TEXT,
          "orderAmount" REAL NOT NULL,
          "discountAmount" REAL NOT NULL,
          "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);

      // 2. Auto-seed if database is empty
      const count = await this.product.count();
      if (count === 0) {
        this.logger.log('Database is empty. Running automatic seed of 8 garments & partner companies...');
        await this.autoSeed();
        this.logger.log('Auto-seed completed successfully!');
      } else {
        this.logger.log(`Database ready with ${count} products.`);
      }
    } catch (e) {
      this.logger.error('Error ensuring database tables or seed:', e);
    }
  }

  private async autoSeed() {
    // Categories
    const cotton = await this.category.create({
      data: {
        name: 'Cotton Shirts',
        slug: 'cotton-shirts',
        description: 'Thoughtful fabrics. Easy silhouettes. Made for wherever the day takes you.',
      },
    });

    const linen = await this.category.create({
      data: {
        name: 'Linen Shirts',
        slug: 'linen-shirts',
        description: 'Thoughtful fabrics. Easy silhouettes. Made for wherever the day takes you.',
      },
    });

    const monsoon = await this.category.create({
      data: {
        name: 'The Monsoon Edit',
        slug: 'the-monsoon-edit',
        description: 'Layering pieces and weather-ready cotton twills engineered for seasonal shifts.',
      },
    });

    // 8 Authentic Products
    await this.product.createMany({
      data: [
        {
          title: 'Coastal Blue Cotton Shirt',
          slug: 'coastal-blue-cotton-shirt',
          description: 'A soft, breathable cotton shirt cut for easy movement and everyday polish.',
          price: 1499,
          compareAtPrice: 1899,
          sku: 'NAV-COT-001',
          stock: 120,
          fabric: '100% Giza Cotton',
          color: 'Coastal Blue',
          colourHex: '#5B7B88',
          badge: 'BESTSELLER',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '100% Long-staple Giza Cotton · Gentle machine wash cold with similar colors · Do not bleach · Tumble dry low · Warm iron if needed.',
          categoryId: cotton.id,
        },
        {
          title: 'Trail Olive Overshirt',
          slug: 'trail-olive-overshirt',
          description: 'A versatile midweight layer with a clean collar and understated utility feel.',
          price: 1799,
          sku: 'NAV-OVR-002',
          stock: 80,
          fabric: 'Organic Cotton Twill',
          color: 'Trail Olive',
          colourHex: '#616D5A',
          badge: 'NEW',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Clean utility collar', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: 'Heavyweight Organic Cotton Twill · Machine wash cold inside out · Hang dry in shade · Medium iron.',
          categoryId: cotton.id,
        },
        {
          title: 'Sunset Check Shirt',
          slug: 'sunset-check-shirt',
          description: 'A warm-toned check designed to work from weekday commutes to weekend drives.',
          price: 1599,
          compareAtPrice: 1999,
          sku: 'NAV-COT-003',
          stock: 95,
          fabric: 'Madras Cotton',
          color: 'Burnt Orange',
          colourHex: '#C06C3E',
          badge: '20% OFF',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '100% Pre-washed Madras Cotton · Machine wash cold · Do not wring · Warm iron.',
          categoryId: cotton.id,
        },
        {
          title: 'Harbour Stripe Shirt',
          slug: 'harbour-stripe-shirt',
          description: 'Crisp stripes, a relaxed fit and a smooth hand feel for warm afternoons.',
          price: 1399,
          sku: 'NAV-LIN-004',
          stock: 109,
          fabric: 'Linen-Cotton Blend',
          color: 'Harbour Stripe',
          colourHex: '#5E6D62',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '55% French Linen, 45% Organic Cotton · Cold gentle cycle · Tumble dry delicate · Warm steam iron.',
          categoryId: cotton.id,
        },
        {
          title: 'Stone Texture Shirt',
          slug: 'stone-texture-shirt',
          description: 'A tactile cotton weave with a neat silhouette and subtle vacation energy.',
          price: 1699,
          sku: 'NAV-COT-005',
          stock: 75,
          fabric: 'Textured Cotton Weave',
          color: 'Stone',
          colourHex: '#5C615E',
          badge: 'LIMITED',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '100% Jacquard Textured Cotton · Machine wash cold · Do not bleach · Iron on reverse side.',
          categoryId: cotton.id,
        },
        {
          title: 'Midnight Route Shirt',
          slug: 'midnight-route-shirt',
          description: 'A confident dark shirt with a modern fit made for dinner plans and late departures.',
          price: 1899,
          sku: 'NAV-COT-006',
          stock: 60,
          fabric: 'Premium Compact Cotton',
          color: 'Midnight',
          colourHex: '#364F59',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '100% High-twist Compact Cotton · Gentle cycle cold · Hang to dry · Medium heat iron.',
          categoryId: cotton.id,
        },
        {
          title: 'Dune Linen Shirt',
          slug: 'dune-linen-shirt',
          description: 'Naturally breathable linen with a relaxed drape and softly structured finish.',
          price: 2199,
          sku: 'NAV-LIN-007',
          stock: 65,
          fabric: '100% French Flax Linen',
          color: 'Natural Dune',
          colourHex: '#5C7B70',
          badge: 'PURE LINEN',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '100% Pure French Flax Linen · Hand or machine wash cold on delicate · Line dry in shade · Steam iron damp.',
          categoryId: linen.id,
        },
        {
          title: 'Forest Linen Shirt',
          slug: 'forest-linen-shirt',
          description: 'An elevated linen staple in a deep green tone inspired by wet-season landscapes.',
          price: 2299,
          sku: 'NAV-LIN-008',
          stock: 50,
          fabric: '100% European Linen',
          color: 'Deep Forest',
          colourHex: '#4A3C31',
          badge: 'PURE LINEN',
          images: JSON.stringify([
            'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&auto=format&fit=crop&q=85',
            'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=900&auto=format&fit=crop&q=85',
          ]),
          details: JSON.stringify(['Regular fit', 'Full sleeves', 'Curved hem', 'Machine wash cold', 'Made in India']),
          fabricCare: '100% European Linen · Machine wash cold with mild detergent · Do not bleach · Warm iron.',
          categoryId: linen.id,
        },
      ],
    });

    // Partner Companies
    const stellar = await this.company.create({
      data: {
        name: 'Stellar Solutions',
        code: 'STELLAR',
        contactPerson: 'Aarav Mehta',
        email: 'corporate-benefits@stellarsolutions.example',
        phone: '+91 98765 43210',
        status: 'ACTIVE',
      },
    });

    const techcorp = await this.company.create({
      data: {
        name: 'TechCorp India',
        code: 'TECHCORP',
        contactPerson: 'Pooja Sharma',
        email: 'perks@techcorp.example',
        phone: '+91 98111 22334',
        status: 'ACTIVE',
      },
    });

    const nexus = await this.company.create({
      data: {
        name: 'Nexus Dynamics',
        code: 'NEXUS',
        contactPerson: 'Rohan Verma',
        email: 'hr@nexusdynamics.example',
        phone: '+91 99887 76655',
        status: 'ACTIVE',
      },
    });

    // Coupons
    await this.coupon.createMany({
      data: [
        {
          companyId: stellar.id,
          code: 'STELLAR50',
          type: 'FIXED',
          value: 50,
          minimumOrderAmount: 500,
          usageLimit: 500,
          usageCount: 0,
          startsAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: new Date('2026-12-31T23:59:59Z'),
          status: 'ACTIVE',
          eligibilityType: 'ALL',
        },
        {
          companyId: stellar.id,
          code: 'STELLAR200',
          type: 'FIXED',
          value: 200,
          minimumOrderAmount: 2000,
          usageLimit: 100,
          usageCount: 0,
          startsAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: new Date('2026-12-31T23:59:59Z'),
          status: 'ACTIVE',
          eligibilityType: 'ALL',
        },
        {
          companyId: techcorp.id,
          code: 'TECH20',
          type: 'PERCENTAGE',
          value: 20,
          minimumOrderAmount: 1000,
          maximumDiscount: 500,
          usageLimit: 250,
          usageCount: 0,
          startsAt: new Date('2026-01-01T00:00:00Z'),
          expiresAt: new Date('2026-11-30T23:59:59Z'),
          status: 'ACTIVE',
          eligibilityType: 'ALL',
        },
        {
          companyId: nexus.id,
          code: 'MONSOON15',
          type: 'PERCENTAGE',
          value: 15,
          minimumOrderAmount: 1200,
          maximumDiscount: 400,
          usageLimit: 300,
          usageCount: 0,
          startsAt: new Date('2026-06-01T00:00:00Z'),
          expiresAt: new Date('2026-10-31T23:59:59Z'),
          status: 'ACTIVE',
          eligibilityType: 'ALL',
        },
      ],
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
