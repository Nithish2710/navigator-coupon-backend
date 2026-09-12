import { Controller, Get } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('api/admin/coupons/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get()
  async getDashboardAnalytics() {
    return this.analyticsService.getCouponDashboardStats();
  }
}
