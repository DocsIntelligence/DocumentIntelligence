import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAiProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { ClaudeProvider } from './providers/claude.provider';

@Module({
  controllers: [AiController],
  providers: [AiService, ClaudeProvider, OpenAiProvider, GeminiProvider],
  exports: [AiService],
})
export class AiModule {}
