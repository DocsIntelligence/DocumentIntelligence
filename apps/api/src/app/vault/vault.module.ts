import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { ParsingService } from '../intelligence/parsing.service';
import { VaultAdminController } from './vault-admin.controller';
import { VaultController } from './vault.controller';
import { VaultConfigService } from './vault-config.service';
import { VaultCryptoService } from './vault-crypto.service';
import { VaultService } from './vault.service';

/** Document Vault (docs/10) — secure entity + document store with autofill,
 *  plus an admin-configurable field catalog + document kinds. */
@Module({
  imports: [StorageModule, AiModule],
  controllers: [VaultController, VaultAdminController],
  providers: [VaultService, VaultCryptoService, VaultConfigService, ParsingService],
  exports: [VaultService],
})
export class VaultModule {}
