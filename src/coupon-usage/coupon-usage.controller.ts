import { Controller, Get, Query } from '@nestjs/common';
import { CouponUsageService } from './coupon-usage.service';

@Controller('api/admin/coupon-usage')
export class CouponUsageController {
  constructor(private readonly couponUsageService: CouponUsageService) {}

  @Get()
  async findAll(
    @Query('couponId') couponId?: string,
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.couponUsageService.findAll({ couponId, companyId, search, page, limit });
  }
}
