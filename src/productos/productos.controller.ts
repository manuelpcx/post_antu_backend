import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { FindProductosDto } from './dto/find-productos.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get()
  findAll(@Query() filters: FindProductosDto) {
    return this.productosService.findAll(filters);
  }

  @Get('sku/:sku')
  findBySku(@Param('sku') sku: string) {
    return this.productosService.findBySku(sku);
  }

  @Get('buscar')
  buscar(@Query('q') q: string) {
    return this.productosService.buscar(q);
  }

  @Post()
  create(@Body() dto: CreateProductoDto) {
    return this.productosService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductoDto) {
    return this.productosService.update(id, dto);
  }

  @Patch(':id/stock')
  updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.productosService.updateStock(id, dto);
  }
}
