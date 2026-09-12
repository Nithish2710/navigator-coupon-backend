import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { CouponEngineService } from './coupon-engine.service';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AnalyticsModule],
  controllers: [CouponsController],
  providers: [CouponsService, CouponEngineService],
  exports: [CouponsService, CouponEngineService],
})
export class CouponsModule {}
