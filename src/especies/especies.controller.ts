import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EspeciesService } from './especies.service';
import { CreateEspecieDto } from './dto/create-especie.dto';
import { UpdateEspecieDto } from './dto/update-especie.dto';

@Controller('especies')
export class EspeciesController {
  constructor(private readonly especiesService: EspeciesService) {}

  @Get()
  findAll(@Query('activo') activo?: string) {
    const parsedActivo = activo === undefined ? undefined : activo === 'true';
    return this.especiesService.findAll(parsedActivo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.especiesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateEspecieDto) {
    return this.especiesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEspecieDto) {
    return this.especiesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.especiesService.softDelete(id);
  }
}
