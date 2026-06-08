import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Profile, Strategy } from 'passport-linkedin-oauth2';
import { UsersService } from '../../users/users.service';
import { UserIdentityService } from '../user-identity.service';

/**
 * LinkedIn deprecated their v2 People API (which `passport-linkedin-oauth2@2.0.0`
 * calls by default) in favor of OpenID Connect. The library throws
 * `InternalOAuthError: failed to fetch user profile` out of the box.
 *
 * We keep the library for its OAuth2 plumbing but override `userProfile()` to
 * call LinkedIn's OIDC `/v2/userinfo` endpoint and shape the response into the
 * same `Profile` structure downstream code expects.
 *
 * LinkedIn userinfo response shape:
 *   { sub, email, email_verified, given_name, family_name, name, picture, locale }
 */
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  private readonly logger = new Logger(LinkedInStrategy.name);

  constructor(
    private readonly users: UsersService,
    private readonly identities: UserIdentityService,
    config: ConfigService,
  ) {
    super({
      clientID: config.getOrThrow<string>('LINKEDIN_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('LINKEDIN_CALLBACK_URL'),
      scope: ['openid', 'profile', 'email'],
      passReqToCallback: true,
    });

    // Override the library's default userProfile implementation which hits
    // the deprecated v2 /me and /emailAddress endpoints.
    const logger = this.logger;

    const self = this as unknown as {
      userProfile: (
        accessToken: string,
        done: (err: Error | null, profile?: Profile) => void,
      ) => void;
    };

    self.userProfile = (accessToken, done) => {
      void (async () => {
        try {
          const response = await fetch(LINKEDIN_USERINFO_URL, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
            },
          });

          const raw = await response.text();

          if (!response.ok) {
            logger.error(
              `LinkedIn userinfo failed: status=${response.status} body=${raw.slice(0, 500)}`,
            );
            done(
              new Error(
                `LinkedIn userinfo ${response.status}: ${raw.slice(0, 200)}`,
              ),
            );
            return;
          }

          const json = JSON.parse(raw) as {
            sub?: string;
            email?: string;
            email_verified?: boolean;
            given_name?: string;
            family_name?: string;
            name?: string;
            picture?: string;
            locale?: string;
          };

          if (!json.sub) {
            logger.error(
              `LinkedIn userinfo missing 'sub': body=${raw.slice(0, 500)}`,
            );
            done(new Error("LinkedIn userinfo response missing 'sub' claim"));
            return;
          }

          const profile: Profile = {
            provider: 'linkedin',
            id: json.sub,
            displayName:
              json.name ??
              [json.given_name, json.family_name].filter(Boolean).join(' '),
            name: {
              givenName: json.given_name ?? '',
              familyName: json.family_name ?? '',
            },
            emails: json.email ? [{ value: json.email }] : [],
            photos: json.picture ? [{ value: json.picture }] : [],
            _raw: raw,
            _json: json,
          } as unknown as Profile;

          done(null, profile);
        } catch (err) {
          const message = (err as Error).message || String(err);
          logger.error(`LinkedIn userinfo exception: ${message}`);
          done(new Error(`LinkedIn userinfo exception: ${message}`));
        }
      })();
    };
  }

  async validate(
    _req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (err?: Error | null, user?: Express.User) => void,
  ) {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email) throw new BadRequestException('No email from LinkedIn');

      const { id } = await this.identities.findOrCreateFromOAuth({
        provider: 'linkedin',
        providerAccountId: profile.id,
        email,
        name: profile.displayName,
        picture: profile.photos?.[0]?.value,
      });
      done(null, await this.users.findById(id));
    } catch (error) {
      done(error as Error);
    }
  }
}
