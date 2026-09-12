import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponEngineService } from './coupon-engine.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/create-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller()
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly couponEngineService: CouponEngineService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ==========================================
  // CUSTOMER STOREFRONT ENDPOINTS
  // ==========================================

  @Post('api/coupons/validate')
  @HttpCode(HttpStatus.OK)
  async validateCoupon(@Body() dto: ValidateCouponDto) {
    return this.couponEngineService.validateCoupon(dto);
  }

  // ==========================================
  // ADMIN PANEL ENDPOINTS
  // ==========================================

  @Get('api/admin/coupons/analytics')
  async getDashboardAnalytics() {
    return this.analyticsService.getCouponDashboardStats();
  }

  @Get('api/admin/coupons')
  async findAll(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.couponsService.findAll({ search, companyId, status, type, page, limit });
  }

  @Post('api/admin/coupons')
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Get('api/admin/coupons/:id')
  async findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @Patch('api/admin/coupons/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @Patch('api/admin/coupons/:id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return this.couponsService.toggleStatus(id);
  }

  @Delete('api/admin/coupons/:id')
  async remove(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }

  @Get('api/admin/coupons/:id/usage')
  async getUsageHistory(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.couponsService.getUsageHistory(id, { page, limit });
  }
}
