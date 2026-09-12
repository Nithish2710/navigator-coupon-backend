import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ==========================================
  // STOREFRONT PUBLIC ENDPOINTS
  // ==========================================

  @Get('api/products')
  async findAll(
    @Query('category') category?: string,
    @Query('fabric') fabric?: string,
    @Query('badge') badge?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findAll({
      category,
      fabric,
      badge,
      search,
      page,
      limit,
    });
  }

  @Get('api/products/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  // ==========================================
  // ADMIN PANEL ENDPOINTS
  // ==========================================

  @Get('api/admin/products')
  async findAllAdmin(
    @Query('category') category?: string,
    @Query('fabric') fabric?: string,
    @Query('badge') badge?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findAll({
      category,
      fabric,
      badge,
      search,
      page,
      limit,
    });
  }

  @Post('api/admin/products')
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get('api/admin/products/:id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch('api/admin/products/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete('api/admin/products/:id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch('api/admin/products/:id/stock')
  async updateStock(@Param('id') id: string, @Body('stock') stock: number) {
    return this.productsService.updateStock(id, stock);
  }
}
