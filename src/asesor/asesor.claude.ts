import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import type { Desglose } from './asesor.calculos';
import {
  CONSEJO_SCHEMA,
  Consejo,
  SYSTEM_PROMPT,
  construirMensaje,
  parseConsejo,
} from './asesor.prompt';

export const MODELO_POR_DEFECTO = 'claude-opus-5-5';
const ERROR_GENERICO = 'No se pudo generar el consejo, intenta de nuevo';

@Injectable()
export class ClaudeAsesorClient {
  private readonly logger = new Logger(ClaudeAsesorClient.name);
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {}

  async generarConsejo(
    fecha: string,
    desglose: Desglose,
  ): Promise<{ consejo: Consejo; modelo: string }> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'El asesor no está configurado (falta ANTHROPIC_API_KEY en el backend)',
      );
    }
    const modelo =
      this.config.get<string>('ASESOR_MODEL') || MODELO_POR_DEFECTO;
    this.client ??= new Anthropic({ apiKey });

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: modelo,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: CONSEJO_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: construirMensaje(fecha, desglose) },
        ],
      });
    } catch (error) {
      this.logger.error(`Error llamando a Claude: ${String(error)}`);
      throw new BadGatewayException(ERROR_GENERICO);
    }

    if (response.stop_reason !== 'end_turn') {
      this.logger.warn(
        `Claude terminó con stop_reason=${response.stop_reason}`,
      );
      throw new BadGatewayException(ERROR_GENERICO);
    }

    const texto = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
    const consejo = parseConsejo(texto);
    if (!consejo) {
      this.logger.warn('Claude devolvió un consejo con formato inválido');
      throw new BadGatewayException(ERROR_GENERICO);
    }

    return { consejo, modelo: response.model };
  }
}
