import { DynamicModule, Logger, Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { HeadlessBrowserService } from '../common/headless-browser.service';
import { ParsingService } from '../intelligence/parsing.service';
import { VaultModule } from '../vault/vault.module';
import { VaultCryptoService } from '../vault/vault-crypto.service';
import { AssetService } from './services/asset.service';
import { AssetDocumentService } from './services/asset-document.service';
import { EstateDocumentAnalysisService } from './services/estate-document-analysis.service';
import { PortfolioAnalysisService } from './services/portfolio-analysis.service';
import { EstateEnvelopeService } from './services/estate-envelope.service';
import { EstateProfileService } from './services/estate-profile.service';
import { EstateAdminController } from './controllers/estate-admin.controller';
import { EstateController } from './controllers/estate.controller';
import { EstateDocumentController } from './controllers/estate-document.controller';
import { EstateNomineeController } from './controllers/estate-nominee.controller';
import { EstateLivenessService } from './services/estate-liveness.service';
import { EstateReportService } from './services/estate-report.service';
import { EstateReportPdfService } from './services/estate-report-pdf.service';
import { EstateSearchService } from './services/estate-search.service';
import { EstateVaultConfigService } from './services/estate-vault-config.service';
import { GapService } from './services/gap.service';
import { NomineeService } from './services/nominee.service';
import { ReleaseService } from './services/release.service';
import { ESTATE_VAULT_ENABLED } from './estate.constants';

/**
 * Estate & Wealth Vault (docs/13) — a self-contained, toggleable module.
 * `ESTATE_VAULT_ENABLED=false` mounts NOTHING (no controllers), leaving the
 * Estate* tables untouched (kill switch, §0.1/§0.4). Depends only on shared
 * seams via DI (VaultCryptoService for at-rest encryption, the global
 * DatabaseService), keeping the edge clean for a future standalone extraction.
 */
@Module({})
export class EstateVaultModule {
  private static readonly logger = new Logger(EstateVaultModule.name);

  static forRoot(): DynamicModule {
    const enabled = process.env[ESTATE_VAULT_ENABLED] !== 'false';
    if (!enabled) {
      this.logger.warn(
        'EstateVault disabled (ESTATE_VAULT_ENABLED=false) — no routes mounted.',
      );
      return { module: EstateVaultModule };
    }
    return {
      module: EstateVaultModule,
      imports: [StorageModule, AiModule, VaultModule],
      controllers: [
        EstateController,
        EstateAdminController,
        EstateNomineeController,
        EstateDocumentController,
      ],
      providers: [
        EstateVaultConfigService,
        EstateEnvelopeService,
        EstateProfileService,
        AssetService,
        AssetDocumentService,
        EstateDocumentAnalysisService,
        PortfolioAnalysisService,
        EstateSearchService,
        GapService,
        ParsingService,
        VaultCryptoService,
        NomineeService,
        ReleaseService,
        EstateReportService,
        EstateReportPdfService,
        HeadlessBrowserService,
        EstateLivenessService,
      ],
      exports: [EstateVaultConfigService],
    };
  }
}
