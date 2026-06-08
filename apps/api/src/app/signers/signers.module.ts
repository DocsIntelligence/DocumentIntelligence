import { Module } from '@nestjs/common';
import { SignersController } from './signers.controller';
import { SignersService } from './signers.service';

@Module({
  controllers: [SignersController],
  providers: [SignersService],
  exports: [SignersService],
})
export class SignersModule {}
