import { ConfigService } from '@nestjs/config';
import { Strategy } from 'passport-jwt';
import { TokenPayload } from 'src/auth/interfaces/token.interface';
declare const JwtAccessTokenStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithoutRequest] | [opt: import("passport-jwt").StrategyOptionsWithRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtAccessTokenStrategy extends JwtAccessTokenStrategy_base {
    private readonly configService;
    private readonly jwtService;
    constructor(configService: ConfigService);
    validate({ userId }: TokenPayload): void;
}
export {};
