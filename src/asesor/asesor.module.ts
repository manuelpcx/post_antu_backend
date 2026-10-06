import { Module } from '@nestjs/common';
import { VentasModule } from '../ventas/ventas.module';
import { AsesorController } from './asesor.controller';
import { AsesorService } from './asesor.service';
import { ClaudeAsesorClient } from './asesor.claude';

@Module({
  imports: [VentasModule],
  controllers: [AsesorController],
  providers: [AsesorService, ClaudeAsesorClient],
})
export class AsesorModule {}
