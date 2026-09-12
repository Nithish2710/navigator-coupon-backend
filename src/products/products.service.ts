import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeJsonField(field: any): string {
    if (typeof field === 'string') {
      try {
        JSON.parse(field);
        return field;
      } catch {
        return JSON.stringify([field]);
      }
    }
    if (Array.isArray(field)) {
      return JSON.stringify(field);
    }
    return JSON.stringify([]);
  }

  async findAll(query?: {
    category?: string;
    fabric?: string;
    badge?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (query?.category && query.category !== 'all') {
      where.category = { slug: query.category };
    }
    if (query?.fabric) {
      where.fabric = { contains: query.fabric };
    }
    if (query?.badge) {
      where.badge = query.badge;
    }
    if (query?.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { fabric: { contains: query.search } },
        { sku: { contains: query.search } },
      ];
    }

    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 100;
    const skip = (page - 1) * limit;

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Parse images and details JSON string for frontend ease
    const formatted = products.map((p) => {
      let images: string[] = [];
      let details: string[] = [];
      try {
        images = JSON.parse(p.images || '[]');
      } catch {
        images = [p.images];
      }
      try {
        details = JSON.parse(p.details || '[]');
      } catch {
        details = p.details ? [p.details] : [];
      }
      return {
        ...p,
        images,
        details,
      };
    });

    return {
      data: formatted,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found.`);
    }

    let images: string[] = [];
    let details: string[] = [];
    try {
      images = JSON.parse(product.images || '[]');
    } catch {
      images = [product.images];
    }
    try {
      details = JSON.parse(product.details || '[]');
    } catch {
      details = product.details ? [product.details] : [];
    }

    return {
      ...product,
      images,
      details,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }

    let images: string[] = [];
    let details: string[] = [];
    try {
      images = JSON.parse(product.images || '[]');
    } catch {
      images = [product.images];
    }
    try {
      details = JSON.parse(product.details || '[]');
    } catch {
      details = product.details ? [product.details] : [];
    }

    return {
      ...product,
      images,
      details,
    };
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug ? this.slugify(dto.slug) : this.slugify(dto.title);
    const sku = dto.sku.toUpperCase().trim();

    // Check SKU or slug uniqueness
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ sku }, { slug }],
      },
    });
    if (existing) {
      if (existing.sku === sku) {
        throw new ConflictException(`Product with SKU "${sku}" already exists.`);
      }
      throw new ConflictException(`Product with slug "${slug}" already exists.`);
    }

    // Verify category
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) {
      throw new BadRequestException(`Category with ID "${dto.categoryId}" does not exist.`);
    }

    const imagesJson = this.normalizeJsonField(dto.images);
    const detailsJson = this.normalizeJsonField(dto.details);

    const product = await this.prisma.product.create({
      data: {
        title: dto.title.trim(),
        slug,
        description: dto.description.trim(),
        price: Number(dto.price),
        compareAtPrice: dto.compareAtPrice ? Number(dto.compareAtPrice) : null,
        sku,
        stock: dto.stock !== undefined ? Number(dto.stock) : 100,
        fabric: dto.fabric?.trim() || null,
        color: dto.color?.trim() || null,
        colourHex: dto.colourHex?.trim() || null,
        images: imagesJson,
        details: detailsJson,
        fabricCare: dto.fabricCare?.trim() || null,
        badge: dto.badge?.trim() || null,
        categoryId: dto.categoryId,
      },
      include: { category: true },
    });

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }

    const updateData: any = {};

    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description.trim();
    if (dto.price !== undefined) updateData.price = Number(dto.price);
    if (dto.compareAtPrice !== undefined) {
      updateData.compareAtPrice = dto.compareAtPrice ? Number(dto.compareAtPrice) : null;
    }
    if (dto.stock !== undefined) updateData.stock = Number(dto.stock);
    if (dto.fabric !== undefined) updateData.fabric = dto.fabric?.trim() || null;
    if (dto.color !== undefined) updateData.color = dto.color?.trim() || null;
    if (dto.colourHex !== undefined) updateData.colourHex = dto.colourHex?.trim() || null;
    if (dto.fabricCare !== undefined) updateData.fabricCare = dto.fabricCare?.trim() || null;
    if (dto.badge !== undefined) updateData.badge = dto.badge?.trim() || null;

    if (dto.slug !== undefined) {
      const newSlug = this.slugify(dto.slug);
      const slugConflict = await this.prisma.product.findFirst({
        where: { slug: newSlug, id: { not: id } },
      });
      if (slugConflict) {
        throw new ConflictException(`Product slug "${newSlug}" is already used by another item.`);
      }
      updateData.slug = newSlug;
    }

    if (dto.sku !== undefined) {
      const newSku = dto.sku.toUpperCase().trim();
      const skuConflict = await this.prisma.product.findFirst({
        where: { sku: newSku, id: { not: id } },
      });
      if (skuConflict) {
        throw new ConflictException(`Product SKU "${newSku}" is already used by another item.`);
      }
      updateData.sku = newSku;
    }

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException(`Category with ID "${dto.categoryId}" does not exist.`);
      }
      updateData.categoryId = dto.categoryId;
    }

    if (dto.images !== undefined) {
      updateData.images = this.normalizeJsonField(dto.images);
    }

    if (dto.details !== undefined) {
      updateData.details = this.normalizeJsonField(dto.details);
    }

    return this.prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { orderItems: true },
    });
    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }

    // If product has order items, we soft zero-stock it to preserve historical orders integrity
    if (existing.orderItems.length > 0) {
      return this.prisma.product.update({
        where: { id },
        data: { stock: 0, badge: 'ARCHIVED' },
      });
    }

    return this.prisma.product.delete({ where: { id } });
  }

  async updateStock(id: string, stock: number) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found.`);
    }

    return this.prisma.product.update({
      where: { id },
      data: { stock: Math.max(0, Math.floor(stock)) },
    });
  }
}
