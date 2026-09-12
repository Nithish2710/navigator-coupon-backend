import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('api/orders')
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get('api/orders/:id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get('api/admin/orders')
  async findAllAdmin(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.ordersService.findAll({ search, status, page, limit });
  }

  @Get('api/admin/orders/:id')
  async findOneAdmin(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
