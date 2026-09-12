import { Module } from '@nestjs/common';
import { CouponUsageService } from './coupon-usage.service';
import { CouponUsageController } from './coupon-usage.controller';

@Module({
  controllers: [CouponUsageController],
  providers: [CouponUsageService],
  exports: [CouponUsageService],
})
export class CouponUsageModule {}
