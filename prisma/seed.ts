import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Navigator database with authentic garments catalog...');

  // 1. Clean existing records in sequence
  await prisma.couponUsage.deleteMany();
  await prisma.couponEligibleProduct.deleteMany();
  await prisma.couponEligibleCategory.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.company.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();

  // 2. Create Categories
  const cottonCategory = await prisma.category.create({
    data: {
      name: 'Cotton Shirts',
      slug: 'cotton-shirts',
      description: 'Thoughtful fabrics. Easy silhouettes. Made for wherever the day takes you.',
    },
  });

  const linenCategory = await prisma.category.create({
    data: {
      name: 'Linen Shirts',
      slug: 'linen-shirts',
      description: 'Thoughtful fabrics. Easy silhouettes. Made for wherever the day takes you.',
    },
  });

  const monsoonCategory = await prisma.category.create({
    data: {
      name: 'The Monsoon Edit',
      slug: 'the-monsoon-edit',
      description: 'Layering pieces and weather-ready cotton twills engineered for seasonal shifts.',
    },
  });

  // 3. Create 8 Authentic Products matching screenshots
  const coastalBlue = await prisma.product.create({
    data: {
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
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '100% Long-staple Giza Cotton · Gentle machine wash cold with similar colors · Do not bleach · Tumble dry low · Warm iron if needed.',
      categoryId: cottonCategory.id,
    },
  });

  const trailOlive = await prisma.product.create({
    data: {
      title: 'Trail Olive Overshirt',
      slug: 'trail-olive-overshirt',
      description: 'A versatile midweight layer with a clean collar and understated utility feel.',
      price: 1799,
      compareAtPrice: null,
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
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Clean utility collar',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: 'Heavyweight Organic Cotton Twill · Machine wash cold inside out · Hang dry in shade · Medium iron.',
      categoryId: cottonCategory.id,
    },
  });

  const sunsetCheck = await prisma.product.create({
    data: {
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
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '100% Pre-washed Madras Cotton · Machine wash cold · Do not wring · Warm iron.',
      categoryId: cottonCategory.id,
    },
  });

  const harbourStripe = await prisma.product.create({
    data: {
      title: 'Harbour Stripe Shirt',
      slug: 'harbour-stripe-shirt',
      description: 'Crisp stripes, a relaxed fit and a smooth hand feel for warm afternoons.',
      price: 1399,
      compareAtPrice: null,
      sku: 'NAV-LIN-004',
      stock: 109,
      fabric: 'Linen-Cotton Blend',
      color: 'Harbour Stripe',
      colourHex: '#5E6D62',
      badge: null,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=900&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=900&auto=format&fit=crop&q=85',
      ]),
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '55% French Linen, 45% Organic Cotton · Cold gentle cycle · Tumble dry delicate · Warm steam iron.',
      categoryId: cottonCategory.id,
    },
  });

  const stoneTexture = await prisma.product.create({
    data: {
      title: 'Stone Texture Shirt',
      slug: 'stone-texture-shirt',
      description: 'A tactile cotton weave with a neat silhouette and subtle vacation energy.',
      price: 1699,
      compareAtPrice: null,
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
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '100% Jacquard Textured Cotton · Machine wash cold · Do not bleach · Iron on reverse side.',
      categoryId: cottonCategory.id,
    },
  });

  const midnightRoute = await prisma.product.create({
    data: {
      title: 'Midnight Route Shirt',
      slug: 'midnight-route-shirt',
      description: 'A confident dark shirt with a modern fit made for dinner plans and late departures.',
      price: 1899,
      compareAtPrice: null,
      sku: 'NAV-COT-006',
      stock: 60,
      fabric: 'Premium Compact Cotton',
      color: 'Midnight',
      colourHex: '#364F59',
      badge: null,
      images: JSON.stringify([
        'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=900&auto=format&fit=crop&q=85',
        'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=900&auto=format&fit=crop&q=85',
      ]),
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '100% High-twist Compact Cotton · Gentle cycle cold · Hang to dry · Medium heat iron.',
      categoryId: cottonCategory.id,
    },
  });

  const duneLinen = await prisma.product.create({
    data: {
      title: 'Dune Linen Shirt',
      slug: 'dune-linen-shirt',
      description: 'Naturally breathable linen with a relaxed drape and softly structured finish.',
      price: 2199,
      compareAtPrice: null,
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
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '100% Pure French Flax Linen · Hand or machine wash cold on delicate · Line dry in shade · Steam iron damp.',
      categoryId: linenCategory.id,
    },
  });

  const forestLinen = await prisma.product.create({
    data: {
      title: 'Forest Linen Shirt',
      slug: 'forest-linen-shirt',
      description: 'An elevated linen staple in a deep green tone inspired by wet-season landscapes.',
      price: 2299,
      compareAtPrice: null,
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
      details: JSON.stringify([
        'Regular fit',
        'Full sleeves',
        'Curved hem',
        'Machine wash cold',
        'Made in India',
      ]),
      fabricCare: '100% European Linen · Machine wash cold with mild detergent · Do not bleach · Warm iron.',
      categoryId: linenCategory.id,
    },
  });

  // 4. Create Companies
  const stellar = await prisma.company.create({
    data: {
      name: 'Stellar Solutions',
      code: 'STELLAR',
      contactPerson: 'Aarav Mehta',
      email: 'corporate-benefits@stellarsolutions.example',
      phone: '+91 98765 43210',
      status: 'ACTIVE',
    },
  });

  const techcorp = await prisma.company.create({
    data: {
      name: 'TechCorp India',
      code: 'TECHCORP',
      contactPerson: 'Pooja Sharma',
      email: 'perks@techcorp.example',
      phone: '+91 98111 22334',
      status: 'ACTIVE',
    },
  });

  const nexus = await prisma.company.create({
    data: {
      name: 'Nexus Dynamics',
      code: 'NEXUS',
      contactPerson: 'Rohan Verma',
      email: 'hr@nexusdynamics.example',
      phone: '+91 99887 76655',
      status: 'ACTIVE',
    },
  });

  // 5. Create Coupons
  const stellar50 = await prisma.coupon.create({
    data: {
      companyId: stellar.id,
      code: 'STELLAR50',
      type: 'FIXED',
      value: 50,
      minimumOrderAmount: 500,
      maximumDiscount: null,
      usageLimit: 500,
      usageCount: 0,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      status: 'ACTIVE',
      eligibilityType: 'ALL',
    },
  });

  const stellar200 = await prisma.coupon.create({
    data: {
      companyId: stellar.id,
      code: 'STELLAR200',
      type: 'FIXED',
      value: 200,
      minimumOrderAmount: 2000,
      maximumDiscount: null,
      usageLimit: 100,
      usageCount: 0,
      startsAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      status: 'ACTIVE',
      eligibilityType: 'ALL',
    },
  });

  const techcorp20 = await prisma.coupon.create({
    data: {
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
  });

  const monsoonSale = await prisma.coupon.create({
    data: {
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
  });

  // 6. Create Customers
  const customer1 = await prisma.customer.create({
    data: {
      email: 'vikram.singh@stellarsolutions.example',
      firstName: 'Vikram',
      lastName: 'Singh',
      phone: '+91 98450 11223',
    },
  });

  console.log('Seeding completed successfully with 8 authentic garments!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
