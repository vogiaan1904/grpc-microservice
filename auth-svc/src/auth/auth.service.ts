import { HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ClientGrpc } from '@nestjs/microservices';
import * as bcrypt from 'bcryptjs';
import { firstValueFrom } from 'rxjs';
import { TokenService } from 'src/token/token.service';
import { RegisterRequestDto, ValidateRequestDto } from './dto/auth-request.dto';
import { TokenPayload } from './interfaces/token.interface';
import { RegisterResponse, ValidateResponse } from './proto-buffers/auth.pb';
import {
  CreateUserRequest,
  CreateUserResponse,
  FindOneResponse,
  USER_SERVICE_NAME,
  UserServiceClient,
} from './proto-buffers/user.pb';
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly SALT_ROUND: number = 10;
  private userService: UserServiceClient;

  @Inject(USER_SERVICE_NAME)
  private readonly userServiceClient: ClientGrpc;

  public onModuleInit(): void {
    this.userService =
      this.userServiceClient.getService<UserServiceClient>(USER_SERVICE_NAME);
  }
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterRequestDto): Promise<RegisterResponse> {
    const { email, password, firstName, lastName, gender } = dto;
    const existingUserWithEmail: FindOneResponse = await firstValueFrom(
      this.userService.findOne({ email }),
    );

    console.log(existingUserWithEmail);

    if (existingUserWithEmail.status >= HttpStatus.NOT_FOUND) {
      return {
        status: HttpStatus.CONFLICT,
        error: ['Email already exists'],
      };
    }

    const hashedPassword: string = await bcrypt.hash(password, this.SALT_ROUND);

    const createUserData: CreateUserRequest = {
      email: email,
      password: hashedPassword,
      firstName: firstName,
      lastName: lastName,
      gender: gender,
    };

    const response: CreateUserResponse = await firstValueFrom(
      this.userService.createUser(createUserData),
    );

    return {
      status: response.status,
      error: response.error,
    };
  }

  public async validate({
    token,
  }: ValidateRequestDto): Promise<ValidateResponse> {
    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET_KEY');

      const decoded: TokenPayload = await this.jwtService.verifyAsync(token, {
        secret,
      });

      const user = await firstValueFrom(
        this.userService.findOne({ id: decoded.userId }),
      );
      if (!user) {
        return {
          status: HttpStatus.CONFLICT,
          error: ['User not found'],
          userId: null,
        };
      }

      return { status: HttpStatus.OK, error: null, userId: decoded.userId };
    } catch (error) {
      const status =
        error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError'
          ? HttpStatus.FORBIDDEN
          : HttpStatus.INTERNAL_SERVER_ERROR;

      return {
        status,
        error: [error.message],
        userId: null,
      };
    }
  }

  generateAccessToken(payload: TokenPayload): string {
    return this.jwtService.sign(payload, {
      algorithm: 'HS256',
      secret: this.configService.get<string>('JWT_ACCESS_SECRET_KEY'),
      expiresIn: `${this.configService.get<string>(
        'JWT_ACCESS_TOKEN_EXPIRATION_TIME',
      )}s`,
    });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return this.jwtService.sign(payload, {
      algorithm: 'HS256',
      secret: this.configService.get<string>('JWT_REFRESH_SECRET_KEY'),
      expiresIn: `${this.configService.get<string>(
        'JWT_REFRESH_TOKEN_EXPIRATION_TIME',
      )}s`,
    });
  }

  // async login(dto: LoginRequestDto): Promise<LoginResponse> {}
}
