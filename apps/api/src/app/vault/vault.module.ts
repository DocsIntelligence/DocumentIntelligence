import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { VaultController } from './vault.controller';
import { VaultCryptoService } from './vault-crypto.service';
import { VaultService } from './vault.service';

/** Document Vault (docs/10) — secure entity + document store with autofill. */
@Module({
  imports: [StorageModule],
  controllers: [VaultController],
  providers: [VaultService, VaultCryptoService],
  exports: [VaultService],
})
export class VaultModule {}
